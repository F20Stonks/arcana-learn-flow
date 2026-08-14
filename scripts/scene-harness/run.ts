/**
 * Coverage harness runner.
 *
 *   npx vite-node scripts/scene-harness/run.ts               # full sweep
 *   npx vite-node scripts/scene-harness/run.ts -- --only id1,id2
 *
 * Pipeline per concept: REAL deployed Director call → REAL production
 * parser/sanitizer → deterministic validator (mathjs) → LLM rubric grader.
 * Results land in scripts/scene-harness/results/ as JSON + a markdown
 * summary aggregated by failure class — the artifact that decides which
 * GENERAL framework fix (primitive or Director principle) comes next.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BATTERY, type BatteryConcept } from "./battery";
import { runDirector } from "./director";
import { validateScene, type ValidationReport } from "../../src/lib/sceneValidate";
import { gradeScene, type Grade } from "./grade";
import type { SceneSpec } from "../../src/lib/sceneSpec";

const here = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(here, "results");

interface ConceptResult {
  id: string;
  level: string;
  domain: string;
  gapProbe?: string;
  directorAttempts: number;
  directorError?: string;
  rawHead?: string;
  scene: SceneSpec | null;
  validation: ValidationReport | null;
  grade: Grade | null;
  /** overall: deterministic hardFail OR grader fail → fail */
  outcome: "pass" | "weak" | "fail" | "no-scene";
}

function outcomeOf(v: ValidationReport | null, g: Grade | null, scene: SceneSpec | null): ConceptResult["outcome"] {
  if (!scene) return "no-scene";
  if (v?.hardFail) return "fail";
  if (!g) return "weak"; // scene exists, grader unavailable — count against ourselves, never in favour
  return g.verdict;
}

async function runOne(c: BatteryConcept): Promise<ConceptResult> {
  const t0 = Date.now();
  const d = await runDirector(c);
  let validation: ValidationReport | null = null;
  let grade: Grade | null = null;
  if (d.scene) {
    // count sanitizer drops by re-checking raw object count in the raw text is
    // impractical; sanitizeScene already ran inside the production parser and
    // logged drops. We approximate drops as 0 here and rely on flags instead.
    validation = validateScene(d.scene, 0);
    grade = await gradeScene(c, d.scene, validation);
  }
  const res: ConceptResult = {
    id: c.id,
    level: c.level,
    domain: c.domain,
    gapProbe: c.gapProbe,
    directorAttempts: d.attempts,
    directorError: d.error,
    rawHead: d.scene ? undefined : d.raw.slice(0, 300),
    scene: d.scene,
    validation,
    grade,
    outcome: outcomeOf(validation, grade, d.scene),
  };
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const bars = grade
    ? `M${grade.mechanism} X${grade.manipulation} H${grade.honesty} L${grade.legibility}`
    : "-";
  console.log(
    `[${res.outcome.toUpperCase().padEnd(8)}] ${c.id.padEnd(26)} ${bars.padEnd(12)} ${secs}s${
      grade?.failure_classes.length ? "  " + grade.failure_classes.join(",") : ""
    }${grade?.missing_capability ? `  ⟨needs: ${grade.missing_capability}⟩` : ""}`,
  );
  return res;
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

function summarize(results: ConceptResult[]): string {
  const counts = { pass: 0, weak: 0, fail: 0, "no-scene": 0 } as Record<string, number>;
  const byClass = new Map<string, string[]>();
  const capabilityAsks = new Map<string, string[]>();
  for (const r of results) {
    counts[r.outcome]++;
    for (const fc of r.grade?.failure_classes ?? []) {
      byClass.set(fc, [...(byClass.get(fc) ?? []), r.id]);
    }
    if (r.grade?.missing_capability) {
      const key = r.grade.missing_capability.toLowerCase().trim();
      capabilityAsks.set(key, [...(capabilityAsks.get(key) ?? []), r.id]);
    }
    for (const f of r.validation?.flags ?? []) {
      const key = `flag:${f.split(":")[0]}`;
      byClass.set(key, [...(byClass.get(key) ?? []), r.id]);
    }
    for (const e of r.validation?.exprIssues ?? []) {
      byClass.set(`expr:${e.kind}`, [...(byClass.get(`expr:${e.kind}`) ?? []), r.id]);
    }
  }
  const lines: string[] = [];
  lines.push(`# Scene coverage sweep — ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    `**${results.length} concepts** · pass ${counts.pass} · weak ${counts.weak} · fail ${counts.fail} · no-scene ${counts["no-scene"]}`,
  );
  lines.push("");
  lines.push("## Failure classes (aggregated — fix the GENERAL framework, never per-concept)");
  lines.push("");
  const sorted = [...byClass.entries()].sort((a, b) => b[1].length - a[1].length);
  if (sorted.length === 0) lines.push("_none_");
  for (const [cls, ids] of sorted) {
    const unique = [...new Set(ids)];
    lines.push(`- **${cls}** ×${ids.length} (${unique.length} concept${unique.length === 1 ? "" : "s"}): ${unique.join(", ")}`);
  }
  lines.push("");
  lines.push("## Missing-capability asks (grader, generic phrasing)");
  lines.push("");
  const caps = [...capabilityAsks.entries()].sort((a, b) => b[1].length - a[1].length);
  if (caps.length === 0) lines.push("_none_");
  for (const [cap, ids] of caps) lines.push(`- **${cap}** ×${ids.length}: ${ids.join(", ")}`);
  lines.push("");
  lines.push("## Per-concept");
  lines.push("");
  lines.push("| concept | level | outcome | M | X | H | L | classes | note |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const g = r.grade;
    lines.push(
      `| ${r.id}${r.gapProbe ? " ⚑" : ""} | ${r.level} | ${r.outcome} | ${g?.mechanism ?? "-"} | ${
        g?.manipulation ?? "-"
      } | ${g?.honesty ?? "-"} | ${g?.legibility ?? "-"} | ${(g?.failure_classes ?? []).join(", ")} | ${
        (g?.note ?? r.directorError ?? "").replace(/\|/g, "/")
      } |`,
    );
  }
  lines.push("");
  lines.push("⚑ = deliberately probes a suspected primitive-language gap");
  return lines.join("\n");
}

async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith("--only"));
  let battery = BATTERY;
  if (onlyArg) {
    const ids = (onlyArg.includes("=") ? onlyArg.split("=")[1] : process.argv[process.argv.indexOf(onlyArg) + 1])
      .split(",")
      .map((s) => s.trim());
    battery = BATTERY.filter((c) => ids.includes(c.id));
    if (battery.length === 0) {
      console.error(`--only matched nothing. Known ids:\n${BATTERY.map((c) => c.id).join("\n")}`);
      process.exit(1);
    }
  }
  // Serial with a breather between concepts: the free gateway rate-limits
  // hard enough that parallelism just converts battery entries into 429s.
  console.log(`Sweeping ${battery.length} concept(s), serial…\n`);
  const results = await pool(battery, 1, async (c) => {
    const r = await runOne(c);
    await new Promise((res) => setTimeout(res, 3000));
    return r;
  });

  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const jsonPath = join(RESULTS_DIR, `run-${stamp}.json`);
  const mdPath = join(RESULTS_DIR, `run-${stamp}.md`);
  writeFileSync(jsonPath, JSON.stringify(results, null, 1));
  const md = summarize(results);
  writeFileSync(mdPath, md);
  console.log(`\n${md.split("\n").slice(0, 30).join("\n")}\n…\nFull report: ${mdPath}\nRaw: ${jsonPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
