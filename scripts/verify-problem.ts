/**
 * Verify-a-problem — turns the manual, easy-to-get-wrong middle of CLAUDE.md's own content
 * Workflow (steps 2-3: "write a throwaway verify script", "grep for duplicates before adding it")
 * into one command, so adding a sourced problem to the bank is faster and harder to get wrong.
 *
 * This does NOT invent content and NEVER decides a problem is "real" — per standing directive #2,
 * that's still a human (or a session) transcribing something from an actual source document. What
 * it automates is the mechanical, error-prone part that always followed: does the stored answer
 * actually satisfy the integral, and does an equivalent integrand already exist in the bank.
 *
 * Usage:
 *   npx vite-node scripts/verify-problem.ts -- path/to/draft.json
 *   npm run verify:problem -- path/to/draft.json
 *
 * draft.json shape (see scripts/verify-problem.example.json for a worked example):
 *   {
 *     "kind": "indefinite" | "definite",
 *     "integrandExpr": "1/(1+x^2)",       // gradeable syntax, same as Problem.integrandExpr
 *     "answer": "atan(x)",                 // antiderivative (indefinite) or exact value (definite)
 *     "domain": [0.4, 2.2],                // where to sample; Infinity/-Infinity allowed for definite
 *     "id": "my-new-problem",              // optional — a slug is derived if omitted
 *     "difficulty": 3,                     // optional, 1-5, defaults to 3 with a warning
 *     "techniques": ["partial-fractions"], // optional but strongly recommended — validated against
 *                                          //   the real TechniqueId union and used to suggest a bank file
 *     "source": {"name": "MIT Integration Bee", "year": 2024, "round": "Qualifying Round"}
 *   }
 *
 * Runs the exact same numeric methods problems.test.ts uses (derivative()/quadrature(), copied
 * verbatim rather than imported — matching this repo's own convention in lessonExamples.test.ts
 * and errorTaxonomy.ts, so importing this script can never re-trigger another file's test
 * registrations) at the same tolerances, PLUS the real answer.ts grading path
 * (gradeAnswer(problem, problem.answer) must come back "correct" — the exact self-check
 * problems.test.ts itself runs on every bank entry), so a problem that passes this script passes
 * for the identical reasons a bank entry does.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../src/features/integrals/mathEngine";
import { gradeAnswer, normalize } from "../src/features/integrals/answer";
import { TECHNIQUE_BY_ID } from "../src/features/integrals/techniques";
import type { Problem, ProblemKind, ProblemSource, TechniqueId } from "../src/features/integrals/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const BANK_DIR = join(REPO_ROOT, "src/features/integrals/bank");

interface Draft {
  kind: ProblemKind;
  integrandExpr: string;
  answer: string;
  domain: [number, number];
  id?: string;
  difficulty?: number;
  techniques?: string[];
  source?: ProblemSource;
}

// ── the exact numeric methods problems.test.ts uses — see that file's own doc comments for why
//    each tolerance and substitution is what it is. Copied verbatim, not imported (see file doc). ──

function fn(expr: string): (x: number) => number | null {
  const compiled = parse(normalize(expr)).compile();
  return (x: number) => {
    try {
      const v = compiled.evaluate({ x });
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  };
}

function derivative(f: (x: number) => number | null, x: number, h: number): number | null {
  const [a, b, c, d] = [f(x - 2 * h), f(x - h), f(x + h), f(x + 2 * h)];
  if (a === null || b === null || c === null || d === null) return null;
  return (a - 8 * b + 8 * c - d) / (12 * h);
}

function quadrature(f: (x: number) => number | null, a: number, b: number, n = 4000): number {
  if (a === -Infinity && b === Infinity) {
    return quadrature((t) => {
      const x = t / (1 - t * t);
      const v = f(x);
      return v === null ? null : v * ((1 + t * t) / (1 - t * t) ** 2);
    }, -1, 1, n);
  }
  if (b === Infinity) {
    return quadrature((t) => {
      const x = a + t / (1 - t);
      const v = f(x);
      return v === null ? null : v / (1 - t) ** 2;
    }, 0, 1, n);
  }
  if (a === -Infinity) {
    return quadrature((t) => {
      const x = b - t / (1 - t);
      const v = f(x);
      return v === null ? null : v / (1 - t) ** 2;
    }, 0, 1, n);
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const s = t * t * (3 - 2 * t);
    const jac = 6 * t * (1 - t);
    const v = f(a + (b - a) * s);
    if (v === null) continue;
    total += v * jac;
  }
  return (total / n) * (b - a);
}

// ── the script itself ──────────────────────────────────────────────────────────────────────────

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function warn(msg: string) {
  console.warn(`  ! ${msg}`);
}

function slugify(expr: string, kind: ProblemKind): string {
  const base = expr
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${kind === "definite" ? "def" : "indef"}-${base || "problem"}`;
}

function loadDraft(path: string): Draft {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    fail(`Couldn't read ${path}`);
  }
  let draft: Draft;
  try {
    draft = JSON.parse(raw!) as Draft;
  } catch (e) {
    fail(`${path} isn't valid JSON: ${(e as Error).message}`);
  }
  if (draft!.kind !== "indefinite" && draft!.kind !== "definite") {
    fail(`"kind" must be "indefinite" or "definite", got ${JSON.stringify(draft!.kind)}`);
  }
  if (typeof draft!.integrandExpr !== "string" || !draft!.integrandExpr.trim()) {
    fail(`"integrandExpr" is required and must be a non-empty string`);
  }
  if (typeof draft!.answer !== "string" || !draft!.answer.trim()) {
    fail(`"answer" is required and must be a non-empty string`);
  }
  if (
    !Array.isArray(draft!.domain) ||
    draft!.domain.length !== 2 ||
    typeof draft!.domain[0] !== "number" ||
    typeof draft!.domain[1] !== "number"
  ) {
    fail(`"domain" must be a [number, number] pair (Infinity/-Infinity allowed for "definite")`);
  }
  return draft!;
}

/** Deterministic, irregular sample points strictly inside the domain — mirrors
 *  problems.test.ts's own indefinite-check sampling closely enough for this purpose. */
function samplePoints([a, b]: [number, number], n = 9): number[] {
  const lo = Number.isFinite(a) ? a : b - 10;
  const hi = Number.isFinite(b) ? b : a + 10;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = 0.06 + 0.88 * ((i * 0.6180339887498949 + 0.1) % 1);
    pts.push(lo + (hi - lo) * t);
  }
  return pts;
}

function verifyIndefinite(draft: Draft): { ok: boolean; detail: string } {
  const integrand = fn(draft.integrandExpr);
  const answer = fn(draft.answer);
  const h = 1e-4;
  let checked = 0;
  let worstRel = 0;
  for (const x of samplePoints(draft.domain)) {
    const target = integrand(x);
    const got = derivative(answer, x, h);
    if (target === null || got === null) continue;
    checked++;
    const tol = 1e-5 * (1 + Math.abs(target));
    const err = Math.abs(got - target);
    worstRel = Math.max(worstRel, err / tol);
    if (err > tol) {
      return {
        ok: false,
        detail: `at x=${x.toFixed(4)}: d/dx[answer] = ${got.toFixed(6)}, integrand = ${target.toFixed(6)} (off by ${err.toExponential(2)}, tolerance ${tol.toExponential(2)})`,
      };
    }
  }
  if (checked < 4) {
    return { ok: false, detail: `only ${checked} of ${samplePoints(draft.domain).length} sample points were usable — domain may not be safe for both the integrand and the answer` };
  }
  return { ok: true, detail: `${checked} sample points checked, worst case ${(worstRel * 100).toFixed(2)}% of tolerance` };
}

function verifyDefinite(draft: Draft): { ok: boolean; detail: string } {
  const integrand = fn(draft.integrandExpr);
  const expectedFn = fn(draft.answer);
  const expected = expectedFn(0); // a definite answer must be a closed expression, x unused
  if (expected === null || !Number.isFinite(expected)) {
    return { ok: false, detail: `"answer" didn't evaluate to a finite number — a definite answer must contain no free x` };
  }
  const got = quadrature(integrand, draft.domain[0], draft.domain[1]);
  const tol = 1e-4 * (1 + Math.abs(expected));
  const err = Math.abs(got - expected);
  if (err > tol) {
    return {
      ok: false,
      detail: `quadrature gives ${got.toFixed(6)}, stated answer is ${expected.toFixed(6)} (off by ${err.toExponential(2)}, tolerance ${tol.toExponential(2)})`,
    };
  }
  return { ok: true, detail: `quadrature = ${got.toFixed(8)} vs stated ${expected.toFixed(8)}, ${((err / tol) * 100).toFixed(2)}% of tolerance` };
}

function findLikelyDuplicates(integrandExpr: string): string[] {
  const needle = normalize(integrandExpr).replace(/\s+/g, "");
  const hits: string[] = [];
  for (const file of readdirSync(BANK_DIR, { recursive: true }) as string[]) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const full = join(BANK_DIR, file);
    const text = readFileSync(full, "utf8");
    // A loose substring check on the raw integrandExpr string, the same first line of defense
    // CLAUDE.md's Workflow describes — not a semantic equivalence check, just a fast flag.
    if (text.includes(integrandExpr) || text.replace(/\s+/g, "").includes(needle)) {
      hits.push(`src/features/integrals/bank/${file}`);
    }
  }
  return hits;
}

function suggestBankFile(primaryTechnique: string | undefined): string | null {
  if (!primaryTechnique) return null;
  const counts = new Map<string, number>();
  for (const file of readdirSync(BANK_DIR, { recursive: true }) as string[]) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const text = readFileSync(join(BANK_DIR, file), "utf8");
    const matches = text.match(new RegExp(`techniques:\\s*\\[\\s*"${primaryTechnique}"`, "g"));
    if (matches) counts.set(file, (counts.get(file) ?? 0) + matches.length);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [file, count] of counts) {
    if (count > bestCount) {
      best = file;
      bestCount = count;
    }
  }
  return best ? `src/features/integrals/bank/${best}` : null;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx vite-node scripts/verify-problem.ts -- path/to/draft.json");
    process.exit(1);
  }
  const draft = loadDraft(path);

  console.log(`\nVerifying ${draft.kind}: ∫ ${draft.integrandExpr} → ${draft.answer}`);
  console.log(`  domain [${draft.domain[0]}, ${draft.domain[1]}]\n`);

  const numeric = draft.kind === "indefinite" ? verifyIndefinite(draft) : verifyDefinite(draft);
  if (!numeric.ok) fail(`Numeric check failed — ${numeric.detail}`);
  console.log(`✓ Numeric check passed — ${numeric.detail}`);

  // The exact self-check problems.test.ts runs on every real bank entry: the live grader must
  // accept the stored answer as its own answer. Domain and kind matter here (checkDefinite never
  // reads .domain; checkIndefinite does), so this is built as a real, minimal Problem.
  const scratchProblem: Problem = {
    id: "scratch",
    kind: draft.kind,
    integrand: draft.integrandExpr,
    integrandExpr: draft.integrandExpr,
    answer: draft.answer,
    answerLatex: draft.answer,
    domain: draft.domain,
    difficulty: 3,
    techniques: ["power" as TechniqueId],
    source: { name: "original" },
    hints: ["placeholder"],
    steps: ["placeholder"],
  };
  const selfGrade = gradeAnswer(scratchProblem, scratchProblem.answer);
  if (selfGrade.status !== "correct") {
    fail(
      `The live grader (answer.ts) does not accept this answer against itself — status "${selfGrade.status}"${"reason" in selfGrade ? `: ${selfGrade.reason}` : ""}. This would confuse a student even if the numeric check above passed.`,
    );
  }
  console.log(`✓ Live grader accepts the answer against itself (gradeAnswer → "correct")`);

  const duplicates = findLikelyDuplicates(draft.integrandExpr);
  if (duplicates.length) {
    warn(`Possible duplicate — "${draft.integrandExpr}" (or a close variant) already appears in:`);
    for (const d of duplicates) warn(`  ${d}`);
    warn(`Check by hand before adding — this is a substring flag, not a semantic equivalence check.`);
  } else {
    console.log(`✓ No existing bank file contains this integrand string`);
  }

  if (draft.techniques) {
    for (const t of draft.techniques) {
      if (!(t in TECHNIQUE_BY_ID)) fail(`"${t}" is not a real TechniqueId — check types.ts`);
    }
  } else {
    warn(`No "techniques" given — add at least the primary technique before this can be graded live.`);
  }

  if (draft.difficulty === undefined) warn(`No "difficulty" given — defaulting the scaffold below to 3, adjust by hand.`);
  const difficulty = draft.difficulty ?? 3;
  if (difficulty < 1 || difficulty > 5) fail(`"difficulty" must be 1-5`);

  const primary = draft.techniques?.[0];
  const suggestedFile = suggestBankFile(primary);
  if (suggestedFile) {
    console.log(`\n→ Most "${primary}" problems live in ${suggestedFile} — add it there.`);
  } else if (primary) {
    warn(`No existing bank file has "${primary}" as a primary technique yet — check techniques.ts for where this belongs.`);
  }

  const id = draft.id ?? slugify(draft.integrandExpr, draft.kind);
  const source = draft.source ?? { name: "original" };
  const scaffold = `{
  id: ${JSON.stringify(id)},
  kind: ${JSON.stringify(draft.kind)},
  integrand: /* TODO: LaTeX, no \\int or dx */ ${JSON.stringify(draft.integrandExpr)},
  integrandExpr: ${JSON.stringify(draft.integrandExpr)},${draft.kind === "definite" ? `\n  lower: /* TODO: LaTeX lower bound */ ${JSON.stringify(String(draft.domain[0]))},\n  upper: /* TODO: LaTeX upper bound */ ${JSON.stringify(String(draft.domain[1]))},` : ""}
  answer: ${JSON.stringify(draft.answer)},
  answerLatex: /* TODO: LaTeX */ ${JSON.stringify(draft.answer)},
  domain: [${draft.domain[0]}, ${draft.domain[1]}],
  difficulty: ${difficulty},
  techniques: ${JSON.stringify(draft.techniques ?? [])},
  source: ${JSON.stringify(source)},
  hints: [/* TODO */],
  steps: [/* TODO: the worked solution, LaTeX-in-prose lines */],
},`;

  console.log(`\n✓ All checks passed. Scaffold Problem entry (fill in the TODOs by hand):\n`);
  console.log(scaffold);
  console.log();
}

main();
