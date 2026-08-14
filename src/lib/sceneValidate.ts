/**
 * Deterministic scene validation.
 *
 * This lives in src/lib, not in the harness, because PRODUCTION runs it now: a scene is validated
 * before a student ever sees it (see sceneRepair.ts and directScene's ladder). The coverage harness
 * imports this same module, so the offline grader and the live app can never drift apart in what
 * they consider a valid scene.
 *
 * Catches the failures no rubric should have to argue about:
 *   - expressions that don't compile or throw at runtime (mathjs, same
 *     engine the renderer uses);
 *   - objects that evaluate to NaN at the scene's default state (invisible);
 *   - drag params that drive nothing (a non-falsifiable manipulation);
 *   - declared sliders no expression reads (inert controls);
 *   - step tags pointing past the declared steps;
 *   - colour-discipline violations (the house style is ≤4 + one accent);
 *   - no manipulable at all (slider/drag/time) — the Director's own mandate.
 */
import { create, all } from "mathjs";
import type { SceneSpec, Primitive } from "./sceneSpec";
import { resolveChoreography } from "./choreo";

const math = create(all, {});

export interface ExprIssue {
  where: string;
  expr: string;
  kind: "compile-error" | "runtime-error" | "nan-at-default";
  detail?: string;
  /** Index path to the owning primitive (`objects[2].children[0]` -> [2, 0]). Present for issues
   *  raised from a primitive's own fields, absent for scene-level ones. This is what lets the
   *  mechanical repair pass prune EXACTLY the broken object instead of failing the whole scene —
   *  `where` alone is kind-based ("curve.x") and cannot distinguish two curves. */
  path?: number[];
}

export interface ValidationReport {
  primCount: number;
  droppedBySanitizer: number;
  kindsUsed: Record<string, number>;
  exprIssues: ExprIssue[];
  /** NaN fraction across curve samples — some is legal (asymptotes) */
  curveNanFraction: number;
  flags: string[];
  interaction: { sliders: number; draggedPoints: number; usesTime: boolean };
  colorCount: number;
  accentObjectCount: number;
  hardFail: boolean;
}

interface ExprCtx {
  where: string;
  expr: string | number;
  /** extra scope vars this expression may legally use, with sample values */
  samples: Array<Record<string, number>>;
  /** NaN at these samples is tolerated (curves break at asymptotes by design) */
  nanOk?: boolean;
  /** index path of the primitive this expression belongs to — see ExprIssue.path */
  path?: number[];
}

const ACCENT = "#fbbf24";

/** Visits every primitive depth-first, passing the index path that reaches it — `[2, 0]` means
 *  `objects[2].children[0]`. Existing callers that ignore the second argument are unaffected. */
export function walkPrims(prims: Primitive[], visit: (p: Primitive, path: number[]) => void, base: number[] = []) {
  prims.forEach((p, i) => {
    const path = [...base, i];
    visit(p, path);
    if (p.kind === "group") walkPrims(p.children ?? [], visit, path);
  });
}

export function validateScene(scene: SceneSpec, droppedBySanitizer: number): ValidationReport {
  const flags: string[] = [];
  const exprIssues: ExprIssue[] = [];
  const kindsUsed: Record<string, number> = {};

  // ---- base scope: sliders at defaults, drag keys seeded, time samples ----
  const sliderKeys = (scene.sliders ?? []).map((s) => s.key);
  const baseScope: Record<string, number> = {};
  for (const s of scene.sliders ?? []) baseScope[s.key] = s.default;

  const dragPairs: Array<[string, string]> = [];
  walkPrims(scene.objects, (p) => {
    kindsUsed[p.kind] = (kindsUsed[p.kind] ?? 0) + 1;
    if (p.kind === "point" && p.drag) {
      dragPairs.push([p.drag[0], p.drag[1]]);
      // seed like the renderer: from the point's initial position when numeric
      const [ax, ay] = p.at;
      baseScope[p.drag[0]] ??= typeof ax === "number" ? ax : 1;
      baseScope[p.drag[1]] ??= typeof ay === "number" ? ay : 1;
    }
  });
  baseScope["time"] ??= 0;
  baseScope["uu"] ??= 1; // choreography progress — default scope samples the final state

  // slider sweep scopes (min/default/max) to catch range-edge blowups
  const sweeps: Array<Record<string, number>> = [{ ...baseScope }];
  for (const s of scene.sliders ?? []) {
    sweeps.push({ ...baseScope, [s.key]: s.min });
    sweeps.push({ ...baseScope, [s.key]: s.max });
  }
  sweeps.push({ ...baseScope, time: 2.5 });
  sweeps.push({ ...baseScope, uu: 0 });
  sweeps.push({ ...baseScope, uu: 0.5 });

  // ---- collect every expression with its legal extra vars ----
  const ctxs: ExprCtx[] = [];
  const lin = (lo: number, hi: number, n: number) =>
    Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));

  const pushTriple = (where: string, v: ReadonlyArray<number | string | undefined>) => {
    v.slice(0, 3).forEach((c, i) => {
      if (typeof c === "string") ctxs.push({ where: `${where}[${i}]`, expr: c, samples: sweeps });
    });
  };

  walkPrims(scene.objects, (p, path) => {
    const w = p.kind;
    // Everything this visit pushes belongs to THIS primitive; tagged by range at the end rather than
    // threaded through each individual push site.
    const ctxStart = ctxs.length;
    switch (p.kind) {
      case "point":
        pushTriple(`${w}.at`, p.at);
        break;
      case "points": {
        // `count` may itself be an expression (the live-count family, where the family grows with a
        // slider). Arithmetic straight on it produced NaN sample indices, so every expression reading
        // `i` evaluated to NaN and got reported as `nan-at-default` — a FALSE hard-failure on exactly
        // the dynamic scenes this primitive exists for. Resolve it the same way the bars case does.
        let cnt = typeof p.count === "number" ? p.count : 0;
        if (typeof p.count === "string") {
          try {
            cnt = Math.round(Number(math.evaluate(p.count, { ...baseScope })) || 0);
          } catch {
            cnt = 0; // unevaluable count is reported separately as an expression issue below
          }
        }
        const idx = cnt > 1 ? [0, Math.floor((cnt - 1) / 2), cnt - 1] : [0];
        const iSamples = idx.map((i) => ({ ...baseScope, i }));
        for (const key of ["x", "y", "z", "colorBy"] as const) {
          const e = p[key];
          if (typeof e === "string") ctxs.push({ where: `${w}.${key}`, expr: e, samples: iSamples });
        }
        break;
      }
      case "curve": {
        const tSamples = lin(p.tMin, p.tMax, 9).map((t) => ({ ...baseScope, t }));
        for (const key of ["x", "y", "z"] as const) {
          const e = p[key];
          if (typeof e === "string")
            ctxs.push({ where: `${w}.${key}`, expr: e, samples: tSamples, nanOk: true });
        }
        break;
      }
      case "regionFill": {
        // tMin/tMax may be exprs; sample t across their default-scope span
        const tMin = typeof p.tMin === "number" ? p.tMin : math.evaluate(p.tMin, baseScope);
        const tMax = typeof p.tMax === "number" ? p.tMax : math.evaluate(p.tMax, baseScope);
        const span = Number.isFinite(tMin) && Number.isFinite(tMax) && tMin !== tMax ? [tMin, tMax] : [0, 1];
        const tSamples = lin(span[0], span[1], 7).map((t) => ({ ...baseScope, t }));
        for (const key of ["x", "yTop", "yBottom"] as const) {
          const e = p[key];
          if (typeof e === "string") ctxs.push({ where: `${w}.${key}`, expr: e, samples: tSamples, nanOk: true });
        }
        for (const key of ["tMin", "tMax"] as const) {
          const e = p[key];
          if (typeof e === "string") ctxs.push({ where: `${w}.${key}`, expr: e, samples: sweeps });
        }
        break;
      }
      case "bars": {
        const cnt = typeof p.count === "number" ? p.count : Math.round(Number(math.evaluate(p.count, baseScope)) || 0);
        const idxs = [0, Math.max(0, Math.floor((cnt - 1) / 2)), Math.max(0, cnt - 1)];
        const iSamples = idxs.map((i) => ({ ...baseScope, i }));
        for (const key of ["x", "height", "width", "base", "colorBy"] as const) {
          const e = p[key];
          if (typeof e === "string") ctxs.push({ where: `${w}.${key}`, expr: e, samples: iSamples });
        }
        if (typeof p.count === "string") ctxs.push({ where: `${w}.count`, expr: p.count, samples: sweeps });
        break;
      }
      case "segment":
        pushTriple(`${w}.from`, p.from);
        pushTriple(`${w}.to`, p.to);
        break;
      case "arc":
        pushTriple(`${w}.center`, p.center);
        for (const key of ["radius", "from", "to"] as const) {
          const e = p[key];
          if (typeof e === "string") ctxs.push({ where: `${w}.${key}`, expr: e, samples: sweeps });
        }
        break;
      case "angleMark":
        pushTriple(`${w}.at`, p.at);
        pushTriple(`${w}.from`, p.from);
        pushTriple(`${w}.to`, p.to);
        break;
      case "surface": {
        const uv: Array<Record<string, number>> = [];
        for (const u of lin(p.uMin, p.uMax, 4))
          for (const v of lin(p.vMin, p.vMax, 4)) uv.push({ ...baseScope, u, v });
        for (const key of ["x", "y", "z"] as const) {
          const e = p[key];
          if (typeof e === "string") ctxs.push({ where: `${w}.${key}`, expr: e, samples: uv, nanOk: true });
        }
        break;
      }
      case "scalarField": {
        const [xMin, xMax, yMin, yMax] = p.bounds;
        const xy: Array<Record<string, number>> = [];
        for (const x of lin(xMin, xMax, 4))
          for (const y of lin(yMin, yMax, 4)) xy.push({ ...baseScope, x, y });
        // NaN tolerated per-sample: the renderer maps non-finite field values
        // to 0 (a dead pixel), the same contract as curve asymptote breaks.
        ctxs.push({ where: `${w}.f`, expr: p.f, samples: xy, nanOk: true });
        break;
      }
      case "vectorField": {
        const [xMin, xMax, yMin, yMax, zMin, zMax] = p.bounds;
        const xyz: Array<Record<string, number>> = [];
        for (const x of lin(xMin, xMax, 3))
          for (const y of lin(yMin, yMax, 3))
            xyz.push({ ...baseScope, x, y, z: zMin !== undefined && zMax !== undefined ? (zMin + zMax) / 2 : 0 });
        for (const key of ["fx", "fy", "fz"] as const) {
          const e = p[key];
          if (typeof e === "string") ctxs.push({ where: `${w}.${key}`, expr: e, samples: xyz });
        }
        break;
      }
      case "arrow":
        pushTriple(`${w}.from`, p.from);
        pushTriple(`${w}.to`, p.to);
        break;
      case "polygon":
        p.vertices.forEach((v, i) => pushTriple(`${w}.v${i}`, v));
        break;
      case "text":
        pushTriple(`${w}.at`, p.at);
        break;
      case "group":
        (p.matrix ?? []).forEach((m, i) => {
          if (typeof m === "string") ctxs.push({ where: `${w}.matrix[${i}]`, expr: m, samples: sweeps });
        });
        break;
    }
    for (let k = ctxStart; k < ctxs.length; k++) ctxs[k].path ??= path;
  });

  // ---- evaluate everything ----
  const usedVars = new Set<string>();
  let curveSamples = 0;
  let curveNans = 0;
  for (const c of ctxs) {
    if (typeof c.expr !== "string") continue;
    let compiled: { evaluate: (scope: Record<string, number>) => unknown };
    try {
      const node = math.parse(c.expr);
      node.traverse((n: { type: string; name?: string }) => {
        if (n.type === "SymbolNode" && n.name) usedVars.add(n.name);
      });
      compiled = node.compile();
    } catch (e) {
      exprIssues.push({
        where: c.where,
        expr: c.expr,
        kind: "compile-error",
        detail: e instanceof Error ? e.message : String(e),
        path: c.path,
      });
      continue;
    }
    let nanAtDefault = false;
    for (let si = 0; si < c.samples.length; si++) {
      const scope = c.samples[si];
      try {
        const v = compiled.evaluate({ ...scope });
        const n = typeof v === "number" ? v : NaN;
        const bad = !Number.isFinite(n);
        if (c.nanOk) {
          curveSamples++;
          if (bad) curveNans++;
        } else if (bad && si === 0) {
          nanAtDefault = true; // sample 0 is always the default scope
        }
      } catch (e) {
        exprIssues.push({
          where: c.where,
          expr: c.expr,
          kind: "runtime-error",
          detail: e instanceof Error ? e.message : String(e),
          path: c.path,
        });
        break;
      }
    }
    if (nanAtDefault) {
      exprIssues.push({ where: c.where, expr: c.expr, kind: "nan-at-default", path: c.path });
    }
  }

  // ---- structural flags ----
  const draggedPoints: number =
    Object.entries(kindsUsed).length === 0
      ? 0
      : (() => {
          let n = 0;
          walkPrims(scene.objects, (p) => {
            if (p.kind === "point" && p.drag) n++;
          });
          return n;
        })();

  const usesTime = usedVars.has("time");
  const interaction = { sliders: sliderKeys.length, draggedPoints, usesTime };
  if (sliderKeys.length === 0 && draggedPoints === 0 && !usesTime) {
    flags.push("no-manipulable");
  }
  for (const k of sliderKeys) {
    if (!usedVars.has(k)) flags.push(`inert-slider:${k}`);
  }
  // A drag is only truly inert when NEITHER axis param is read anywhere — a
  // point pinned to an axis (drag x, y fixed) legitimately ignores one param.
  for (const [k0, k1] of dragPairs) {
    if (!usedVars.has(k0) && !usedVars.has(k1)) flags.push(`inert-drag:${k0},${k1}`);
  }
  const maxStep = scene.steps?.length ?? 0;
  walkPrims(scene.objects, (p) => {
    if (p.step !== undefined && maxStep > 0 && p.step > maxStep) {
      flags.push(`step-out-of-range:${p.kind}@${p.step}>${maxStep}`);
    }
  });

  // colour discipline
  const colors = new Set<string>();
  let accentObjectCount = 0;
  walkPrims(scene.objects, (p) => {
    const c = (p as { color?: string }).color;
    if (typeof c === "string") {
      colors.add(c.toLowerCase());
      if (c.toLowerCase() === ACCENT) accentObjectCount++;
    }
  });
  if (colors.size > 5) flags.push(`too-many-colors:${colors.size}`);
  if (accentObjectCount > 3) flags.push(`accent-spam:${accentObjectCount}`);

  if (scene.objects.length === 0) flags.push("empty-scene");
  if (droppedBySanitizer > 0) flags.push(`sanitizer-dropped:${droppedBySanitizer}`);

  const hardFail =
    scene.objects.length === 0 ||
    exprIssues.some((i) => i.kind === "compile-error" || i.kind === "runtime-error" || i.kind === "nan-at-default");

  return {
    primCount: scene.objects.length,
    droppedBySanitizer,
    kindsUsed,
    exprIssues,
    curveNanFraction: curveSamples ? curveNans / curveSamples : 0,
    flags,
    interaction,
    colorCount: colors.size,
    accentObjectCount,
    hardFail,
  };
}

/* ---------------- choreography validation ----------------
 * Deterministic checks for step tweens: every tween must target an existing
 * id, motion needs a duration, and the RESOLVED primitive tree of every step
 * (baked values + uu-blend expressions) must survive the same expression
 * checks as the authored tree — a blend that doesn't compile is a scene that
 * silently freezes mid-morph.
 */
export interface ChoreoReport {
  flags: string[];
  exprIssues: ExprIssue[];
  hardFail: boolean;
}

export function validateChoreography(scene: SceneSpec): ChoreoReport {
  const steps = scene.steps ?? [];
  const flags: string[] = [];
  const exprIssues: ExprIssue[] = [];

  const ids = new Set<string>();
  walkPrims(scene.objects, (p) => {
    const id = (p as { id?: unknown }).id;
    if (typeof id === "string") ids.add(id);
  });
  steps.forEach((s, j) => {
    // Tweens on a durationless step are legal (they snap-bake) but usually a
    // Director mistake — motion was intended, none will play. Soft flag.
    if ((s.tweens?.length ?? 0) > 0 && (s.duration ?? 0) <= 0.05) {
      flags.push(`tweens-without-duration:step${j + 1}`);
    }
    for (const tw of s.tweens ?? []) {
      if (!ids.has(tw.target)) flags.push(`tween-unknown-target:step${j + 1}:${tw.target}`);
    }
  });

  for (let j = 0; j < steps.length; j++) {
    const rep = validateScene({ ...scene, objects: resolveChoreography(scene, j) }, 0);
    for (const issue of rep.exprIssues) exprIssues.push({ ...issue, where: `step${j + 1}:${issue.where}` });
  }

  return {
    flags,
    exprIssues,
    hardFail: exprIssues.length > 0 || flags.some((f) => f.startsWith("tween-unknown-target")),
  };
}
