/**
 * Mechanical scene repair — the rung of the ladder that costs nothing.
 *
 * Most validator hard-failures are LOCAL: one curve whose expression doesn't compile, one point that
 * evaluates to NaN at the default state. Before this existed, any single one of those failed the
 * WHOLE scene and the student saw nothing at all — a broken tangent line took the parabola down with
 * it. Every repair here is deterministic, needs no model call, and is deliberately conservative: it
 * only ever REMOVES something already proven broken or inert, never invents geometry.
 *
 * The honest cost is that a repaired scene is a degraded scene — it teaches with fewer parts than the
 * Director intended. That is strictly better than a blank canvas, and `RepairAction[]` is returned so
 * the outcome log records the degradation instead of quietly passing it off as a clean render.
 */
import type { Primitive, SceneSpec } from "./sceneSpec";
import { walkPrims, type ValidationReport } from "./sceneValidate";

export interface RepairAction {
  kind: "pruned-primitive" | "clamped-step" | "dropped-inert-slider";
  detail: string;
}

export interface RepairResult {
  scene: SceneSpec;
  actions: RepairAction[];
}

/** The issue kinds that make a primitive genuinely unrenderable rather than merely imperfect. */
const FATAL_KINDS = new Set(["compile-error", "runtime-error", "nan-at-default"]);

function clone<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);
}

/**
 * Rebuilds the primitive tree without the doomed paths. Paths were computed against the ORIGINAL
 * tree and this walks that same tree in the same order, so indices stay in agreement even as
 * siblings are dropped.
 */
function pruneByPaths(prims: Primitive[], doomed: Set<string>, base: number[] = []): Primitive[] {
  const out: Primitive[] = [];
  prims.forEach((p, i) => {
    const path = [...base, i];
    if (doomed.has(path.join("."))) return;
    if (p.kind === "group") {
      out.push({ ...p, children: pruneByPaths(p.children ?? [], doomed, path) } as Primitive);
    } else {
      out.push(p);
    }
  });
  return out;
}

export function mechanicalRepair(scene: SceneSpec, report: ValidationReport): RepairResult {
  const actions: RepairAction[] = [];
  const next = clone(scene);

  // ---- 1. drop primitives whose own expressions cannot render ----
  const doomed = new Set<string>();
  for (const issue of report.exprIssues) {
    if (!FATAL_KINDS.has(issue.kind) || !issue.path) continue;
    doomed.add(issue.path.join("."));
    actions.push({
      kind: "pruned-primitive",
      detail: `${issue.where} (${issue.kind}): ${issue.expr}`,
    });
  }
  if (doomed.size) next.objects = pruneByPaths(next.objects, doomed);

  // ---- 2. clamp step tags that point past the last declared step ----
  // A primitive tagged for step 5 of a 3-step scene is never revealed at all. Clamping shows it on
  // the final beat, which is where an off-by-one author almost always meant it to land.
  const maxStep = next.steps?.length ?? 0;
  if (maxStep > 0) {
    walkPrims(next.objects, (p) => {
      const withStep = p as Primitive & { step?: number };
      if (withStep.step !== undefined && withStep.step > maxStep) {
        actions.push({ kind: "clamped-step", detail: `${p.kind} step ${withStep.step} -> ${maxStep}` });
        withStep.step = maxStep;
      }
    });
  }

  // ---- 3. remove sliders no expression reads ----
  // An inert control is worse than no control: the student moves it, nothing happens, and they learn
  // the scene is fake. The validator already identified these by name.
  const inertKeys = report.flags
    .filter((f) => f.startsWith("inert-slider:"))
    .map((f) => f.slice("inert-slider:".length));
  if (inertKeys.length && next.sliders?.length) {
    next.sliders = next.sliders.filter((s) => {
      if (!inertKeys.includes(s.key)) return true;
      actions.push({ kind: "dropped-inert-slider", detail: s.key });
      return false;
    });
  }

  return { scene: next, actions };
}
