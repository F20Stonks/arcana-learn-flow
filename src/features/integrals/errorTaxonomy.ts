/**
 * Error taxonomy (WS-5, UK_BEE_BURST.md) — classifying an answer already judged wrong.
 *
 * This module never decides correctness. `classifyError` takes the `Verdict` the live grader
 * (`answer.ts`) already produced and only ever labels *why* a non-correct verdict looks the way it
 * does — symbolically (comparing parsed expression trees) and numerically (comparing values across
 * sample points), the same two tools `answer.ts` and `problems.test.ts` already use. Nothing here
 * can turn a wrong answer correct or a correct one wrong; `normalize()` and the grading functions
 * in `answer.ts` are called exactly as they are, never re-implemented or loosened for a real
 * verdict. See `errorTaxonomy.test.ts`'s "every stored answer still grades correct and is never
 * classified" sweep for the test that keeps that true.
 *
 * `compile`/`evalAt`/`samplePoints` below are deliberate near-duplicates of the private helpers of
 * the same name in `answer.ts` (which doesn't export them) — the same "duplicate the small numeric
 * helper rather than reach into another file's internals" pattern `lessonExamples.test.ts` already
 * uses for `derivative()`/`quadrature()`. This file's copies exist purely to gather *diagnostic*
 * evidence about an answer whose correctness was already decided elsewhere.
 */
import type { MathNode } from "mathjs";
import { parse } from "./mathEngine";
import { gradeAnswer, normalize } from "./answer";
import { PROBLEM_BY_ID } from "./problems";
import type { AttemptRecord } from "./attempts";
import type { Problem, TechniqueId, Verdict } from "./types";

export type ErrorClass =
  | "constant-factor"
  | "sign-flip"
  | "missing-absolute-value"
  | "right-family-wrong-parameter"
  | "correct-but-unsimplified"
  | "wrong-method";

export const ERROR_CLASSES: ErrorClass[] = [
  "constant-factor",
  "sign-flip",
  "missing-absolute-value",
  "right-family-wrong-parameter",
  "correct-but-unsimplified",
  "wrong-method",
];

// ── small numeric helpers (see file header for why these are duplicated, not imported) ──────────

interface Compiled {
  node: MathNode;
  fn: { evaluate: (scope: Record<string, number>) => unknown };
  symbols: string[];
}

function compile(expr: string): Compiled | null {
  try {
    const node = parse(expr);
    const symbols = new Set<string>();
    node.traverse((n) => {
      if (n.type === "SymbolNode") {
        const name = (n as unknown as { name: string }).name;
        if (!["pi", "e", "tau", "Infinity"].includes(name)) symbols.add(name);
      }
    });
    return { node, fn: node.compile(), symbols: [...symbols] };
  } catch {
    return null;
  }
}

function evalAt(c: Compiled, x?: number): number | null {
  try {
    const v = c.fn.evaluate(x === undefined ? {} : { x });
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Deterministic, irregular sample points strictly inside [a,b]. A distinct phase from
 *  `answer.ts`'s own `samplePoints` (0.137) so a "relaxed re-check" here is genuinely a second
 *  look at different evidence, not just a looser threshold applied to the identical 11 points. */
function samplePoints(a: number, b: number, n: number, phase: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = 0.04 + 0.92 * ((i * 0.6180339887498949 + phase) % 1);
    pts.push(a + (b - a) * t);
  }
  return pts.sort((p, q) => p - q);
}

// ── factor 1 & 2: constant-factor / sign-flip ─────────────────────────────────────────────────
//
// answer.ts's checkIndefinite/checkDefinite already do the real work here — detecting a constant
// ratio between the student's answer and the reference and attaching the factor to the Verdict.
// A sign-flip is exactly that same signal with the factor pinned near -1; no separate detector.

const SIGN_FLIP_TOLERANCE = 0.02;

// ── factor 5: correct-but-unsimplified ────────────────────────────────────────────────────────
//
// The live grader's tolerance (1e-6/1e-7, see answer.ts) is deliberately tight so a genuinely
// wrong answer can't sneak through. That tightness has a cost: a correct-but-awkwardly-written
// answer that hits a numeric edge case (a near-cancellation, a sample point close to a removable
// singularity) can occasionally read as wrong. This re-checks with a substantially looser
// tolerance and a denser, differently-phased sample — "was this actually right and our normal
// check just got unlucky" — purely as a label shown back to the student, never as a reason to
// change what the live grader already decided.

const RELAXED_DEFINITE_TOL = 1e-5;
const RELAXED_INDEFINITE_TOL = 1e-4;
// Dense on purpose (well beyond answer.ts's own 11 sample points): the missing-absolute-value
// check below needs enough points landing inside a domain's *smaller* side (the one that stays
// defined) to draw a confident conclusion from, and a small side only accumulates real evidence
// with a high enough total count — see errorTaxonomy.test.ts for the domain-skew case this was
// tuned against. Still trivially cheap: this only ever runs once, when classifying an answer
// already judged wrong, not on every keystroke.
const RELAXED_SAMPLE_COUNT = 60;
const RELAXED_PHASE = 0.271;
const MIN_RELAXED_POINTS = 6;

interface DomainScan {
  /** user(x) - reference(x), at every sampled x where *both* evaluate to a real number. */
  overlapDiffs: number[];
  /** How many sampled x had the reference defined but the user's expression not — a genuinely
   *  smaller domain, not just numeric noise at a handful of points. */
  gapCount: number;
}

function scanDomain(user: Compiled, reference: Compiled, a: number, b: number): DomainScan {
  const pts = samplePoints(a, b, RELAXED_SAMPLE_COUNT, RELAXED_PHASE);
  const overlapDiffs: number[] = [];
  let gapCount = 0;
  for (const x of pts) {
    const rv = evalAt(reference, x);
    if (rv === null) continue;
    const uv = evalAt(user, x);
    if (uv === null) {
      gapCount++;
      continue;
    }
    overlapDiffs.push(uv - rv);
  }
  return { overlapDiffs, gapCount };
}

function agreesOnOverlap(diffs: number[]): boolean {
  if (diffs.length < MIN_RELAXED_POINTS) return false;
  const scale = 1 + Math.max(...diffs.map(Math.abs));
  const spread = Math.max(...diffs) - Math.min(...diffs);
  return spread <= RELAXED_INDEFINITE_TOL * scale;
}

/**
 * "Actually right, our checker just got unlucky" — deliberately distinct from
 * missing-absolute-value below by requiring gapCount === 0: this is for an answer that matches
 * the reference *everywhere* sampled, not one that merely agrees on the sub-region it happens to
 * share with the reference (that's the missing-absolute-value shape, and gets its own class
 * rather than being swallowed by this one just because both start from the same "agree where both
 * are defined" evidence).
 */
function isActuallyEquivalent(problem: Problem, user: Compiled, reference: Compiled): boolean {
  if (problem.kind === "definite") {
    const expected = evalAt(reference);
    const got = evalAt(user);
    if (expected === null || got === null) return false;
    return Math.abs(got - expected) <= RELAXED_DEFINITE_TOL * (1 + Math.abs(expected));
  }
  const [a, b] = problem.domain;
  const scan = scanDomain(user, reference, a, b);
  return scan.gapCount === 0 && agreesOnOverlap(scan.overlapDiffs);
}

// ── factor 3: missing-absolute-value ──────────────────────────────────────────────────────────
//
// The classic ∫dx/x = ln|x| + C slip: a student who drops the bars gets log(f(x)) where the real
// antiderivative needs log(abs(f(x))) — matching wherever f(x) > 0, and undefined (mathjs returns
// a Complex rather than throwing) wherever f(x) < 0. This doesn't assume the sign change sits at
// x = 0: it directly checks, across the domain, for the general shape of the mistake — a genuine
// run of points where the *reference* is defined but the student's answer isn't (gapCount, from
// the same scan isActuallyEquivalent uses — a real smaller domain, not the near-zero gapCount that
// makes something count as "actually equivalent" instead), while still matching by a constant
// wherever both values exist. That numeric signal is required together with a textual one (the
// normalized input contains a log(...) call not already wrapped in abs(...) — ln|x| itself
// normalizes straight to log(abs(x)) and would just grade correct) so this stays about the
// mistake it's named after rather than firing on some unrelated domain oddity.

function hasBareLog(expr: string): boolean {
  const re = /log\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) {
    if (!expr.slice(m.index + m[0].length).startsWith("abs(")) return true;
  }
  return false;
}

function looksLikeMissingAbsoluteValue(
  normalizedInput: string,
  user: Compiled,
  reference: Compiled,
  domain: [number, number],
): boolean {
  if (!hasBareLog(normalizedInput)) return false;
  const scan = scanDomain(user, reference, domain[0], domain[1]);
  return scan.gapCount >= MIN_RELAXED_POINTS && agreesOnOverlap(scan.overlapDiffs);
}

// ── factor 4: right-family-wrong-parameter ────────────────────────────────────────────────────
//
// A purely symbolic check: do the student's answer and the reference answer parse to the same
// expression *shape* — same operators, same functions, same arguments in the same arrangement —
// differing only in one or more numeric literals? sin(2x) vs sin(3x), or pi/3 vs pi/4, are exactly
// this: the right technique, the wrong number plugged in. Applies to both problem kinds, since a
// definite answer is itself a parsed expression (a student can type "pi/3", not just a decimal).

interface ShapeCompare {
  shapeMatches: boolean;
  literalDiffers: boolean;
}

function unwrapParens(n: MathNode): MathNode {
  return n.type === "ParenthesisNode" ? unwrapParens((n as unknown as { content: MathNode }).content) : n;
}

function compareChildren(as: MathNode[], bs: MathNode[]): ShapeCompare {
  let shapeMatches = true;
  let literalDiffers = false;
  for (let i = 0; i < as.length; i++) {
    const child = compareShape(as[i], bs[i]);
    if (!child.shapeMatches) shapeMatches = false;
    if (child.literalDiffers) literalDiffers = true;
  }
  return { shapeMatches, literalDiffers };
}

function compareShape(rawA: MathNode, rawB: MathNode): ShapeCompare {
  const a = unwrapParens(rawA);
  const b = unwrapParens(rawB);

  if (a.type === "ConstantNode" && b.type === "ConstantNode") {
    const av = (a as unknown as { value: unknown }).value;
    const bv = (b as unknown as { value: unknown }).value;
    return { shapeMatches: true, literalDiffers: av !== bv };
  }
  if (a.type !== b.type) return { shapeMatches: false, literalDiffers: false };

  if (a.type === "SymbolNode") {
    const an = (a as unknown as { name: string }).name;
    const bn = (b as unknown as { name: string }).name;
    return { shapeMatches: an === bn, literalDiffers: false };
  }
  if (a.type === "FunctionNode") {
    const fa = a as unknown as { fn: { name: string }; args: MathNode[] };
    const fb = b as unknown as { fn: { name: string }; args: MathNode[] };
    if (fa.fn.name !== fb.fn.name || fa.args.length !== fb.args.length) {
      return { shapeMatches: false, literalDiffers: false };
    }
    return compareChildren(fa.args, fb.args);
  }
  if (a.type === "OperatorNode") {
    const oa = a as unknown as { op: string; fn: string; args: MathNode[] };
    const ob = b as unknown as { op: string; fn: string; args: MathNode[] };
    if (oa.op !== ob.op || oa.fn !== ob.fn || oa.args.length !== ob.args.length) {
      return { shapeMatches: false, literalDiffers: false };
    }
    return compareChildren(oa.args, ob.args);
  }
  // Anything else (rare for an answer string — an ObjectNode, ArrayNode, ...): fall back to exact
  // node equality rather than guessing at a shape rule for it.
  try {
    return { shapeMatches: a.equals(b), literalDiffers: false };
  } catch {
    return { shapeMatches: false, literalDiffers: false };
  }
}

function looksLikeRightFamilyWrongParameter(userNode: MathNode, referenceNode: MathNode): boolean {
  const result = compareShape(userNode, referenceNode);
  return result.shapeMatches && result.literalDiffers;
}

// ── factor 6: wrong-method ─────────────────────────────────────────────────────────────────────
//
// The reference answer's own vocabulary of function calls (sin, log, sqrt, ...) is a fingerprint
// of the technique it needed. When the student's answer shares none of it — used entirely
// different building blocks, or none at all where some were required — that's a real signal the
// approach itself was off, not just a numeric slip.

function functionNames(node: MathNode): Set<string> {
  const names = new Set<string>();
  node.traverse((n) => {
    if (n.type === "FunctionNode") names.add((n as unknown as { fn: { name: string } }).fn.name);
  });
  return names;
}

function looksLikeWrongMethod(userNode: MathNode, referenceNode: MathNode): boolean {
  const referenceFns = functionNames(referenceNode);
  if (referenceFns.size === 0) return false; // nothing to compare against — a pure-algebra answer
  const userFns = functionNames(userNode);
  return ![...referenceFns].some((f) => userFns.has(f));
}

// ── the classifier ─────────────────────────────────────────────────────────────────────────────

/**
 * Labels a non-correct `Verdict`, or returns null when nothing below is confident enough to
 * apply — "everything else stays incorrect" per the runbook: an honest unclassified bucket beats
 * a wrong label. Checked in order from most to least certain; the first match wins.
 */
export function classifyError(problem: Problem, verdict: Verdict, rawInput: string): ErrorClass | null {
  if (verdict.status === "correct" || verdict.status === "unparseable") return null;

  if (verdict.status === "off-by-constant-factor") {
    return Math.abs(verdict.factor + 1) < SIGN_FLIP_TOLERANCE ? "sign-flip" : "constant-factor";
  }

  // verdict.status === "incorrect" from here.
  const normalized = normalize(rawInput);
  const user = compile(normalized);
  const reference = compile(normalize(problem.answer));
  if (!user || !reference) return null; // gradeAnswer already parsed both to reach "incorrect" — defensive only

  if (isActuallyEquivalent(problem, user, reference)) return "correct-but-unsimplified";
  if (
    problem.kind === "indefinite" &&
    looksLikeMissingAbsoluteValue(normalized, user, reference, problem.domain)
  ) {
    return "missing-absolute-value";
  }
  if (looksLikeRightFamilyWrongParameter(user.node, reference.node)) return "right-family-wrong-parameter";
  if (looksLikeWrongMethod(user.node, reference.node)) return "wrong-method";
  return null;
}

// ── the profile: "which error class dominates, and in which techniques" ─────────────────────────
//
// Reads the WS-1 attempt log and classifies every non-correct, non-unparseable attempt in it.
// Re-grades each attempt's stored `submitted` string against the problem's *current* reference
// answer rather than persisting a classification on the attempt itself: AttemptRecord only ever
// stored the coarse verdictClass (see attempts.ts), not the off-by-constant-factor factor, so
// re-grading recovers that for free without widening WS-1's already-shipped schema. Cheap enough
// to run on every render of the progress page — classifying the entire ~800-problem bank against
// itself (errorTaxonomy.test.ts's own regression sweep) takes well under a second, and a profile
// only ever processes the non-correct slice of one account's own attempt log.

type ErrorCounts = Partial<Record<ErrorClass, number>>;

export interface TechniqueErrorProfile {
  technique: TechniqueId;
  total: number;
  counts: ErrorCounts;
  dominant: ErrorClass;
}

export interface ErrorProfile {
  /** Non-correct, non-unparseable attempts on a problem still in the bank — the pool this profile
   *  draws from. */
  consideredAttempts: number;
  /** Of those, how many matched one of the six classes below; the rest stayed an honest,
   *  unlabelled "incorrect" per classifyError's own contract. */
  classifiedAttempts: number;
  counts: ErrorCounts;
  dominant: ErrorClass | null;
  /** Only techniques with at least one classified attempt, most-classified first. */
  byTechnique: TechniqueErrorProfile[];
}

function dominantClass(counts: ErrorCounts): ErrorClass | null {
  let best: ErrorClass | null = null;
  let bestCount = 0;
  for (const cls of ERROR_CLASSES) {
    const n = counts[cls] ?? 0;
    if (n > bestCount) {
      best = cls;
      bestCount = n;
    }
  }
  return best;
}

function addCount(counts: ErrorCounts, cls: ErrorClass) {
  counts[cls] = (counts[cls] ?? 0) + 1;
}

export function buildErrorProfile(attempts: readonly AttemptRecord[]): ErrorProfile {
  const counts: ErrorCounts = {};
  const byTechnique = new Map<TechniqueId, ErrorCounts>();
  let consideredAttempts = 0;
  let classifiedAttempts = 0;

  for (const a of attempts) {
    if (a.verdictClass === "correct" || a.verdictClass === "unparseable") continue;
    const problem = PROBLEM_BY_ID[a.problemId];
    if (!problem) continue; // content since renamed or removed — nothing to classify against
    consideredAttempts++;

    const verdict = gradeAnswer(problem, a.submitted);
    const cls = classifyError(problem, verdict, a.submitted);
    if (!cls) continue;
    classifiedAttempts++;

    addCount(counts, cls);
    const technique = problem.techniques[0];
    const techCounts = byTechnique.get(technique) ?? {};
    addCount(techCounts, cls);
    byTechnique.set(technique, techCounts);
  }

  const techniqueProfiles: TechniqueErrorProfile[] = [...byTechnique.entries()]
    .map(([technique, techCounts]) => ({
      technique,
      total: Object.values(techCounts).reduce((sum: number, n) => sum + (n ?? 0), 0),
      counts: techCounts,
      // Safe to assert non-null: byTechnique only ever gets an entry via addCount above, so every
      // bucket here has at least one classified attempt in it.
      dominant: dominantClass(techCounts) as ErrorClass,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    consideredAttempts,
    classifiedAttempts,
    counts,
    dominant: dominantClass(counts),
    byTechnique: techniqueProfiles,
  };
}
