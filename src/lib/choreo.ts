/**
 * Choreography resolver — lowers step tweens onto the primitive tree as plain
 * mathjs expressions in the reserved scope variable `uu` (the current step's
 * 0→1 playback progress, driven by Scene3D's step clock).
 *
 * Design invariant: the rendered state is a PURE function of
 * (spec, stepIdx, uu). Completed steps are baked (their tweens' final values
 * applied outright), the current step's tweens become blend expressions, and
 * future steps contribute nothing. Scrubbing, replaying and revisiting a
 * step are therefore deterministic and side-effect free — object identity
 * persists across beats because the state an object morphed into is exactly
 * the state later steps inherit.
 *
 * Per-frame cost: zero. The resolver runs only when (spec, stepIdx) changes.
 * During playback only the scope VALUE of `uu` changes; the generated blend
 * strings are stable, so the renderer's dependency-tracked memos recompile
 * nothing and rebuild geometry solely for primitives whose expressions
 * actually reference uu.
 */
import type { SceneSpec, Primitive, TweenSpec } from "./sceneSpec";

/** Params that never blend numerically — they snap when their step is reached. */
const SNAP_KEYS = new Set([
  "color", "label", "content", "kind", "id", "step", "exitStep", "drag",
  "palette", "colorBy", "latex", "dash", "right", "plane", "labels",
]);

const fmt = (n: number): string => {
  const s = String(n);
  return s.includes("e") ? n.toFixed(8) : s;
};

const paren = (v: number | string): string => (typeof v === "number" ? fmt(v) : `(${v})`);

/** The eased 0→1 window for one tween, as an expression in uu. */
function windowExpr(tw: TweenSpec, stepDuration: number): string {
  const d0 = Math.max(0, tw.delay ?? 0);
  const dt = Math.max(0.001, tw.duration ?? stepDuration - d0);
  const raw =
    d0 === 0 && Math.abs(dt - stepDuration) < 1e-9
      ? "min(1,max(0,uu))"
      : `min(1,max(0,(uu*${fmt(stepDuration)}-${fmt(d0)})/${fmt(dt)}))`;
  return tw.ease === "linear" ? raw : `(${raw})^2*(3-2*(${raw}))`;
}

/** Blend a single scalar param. W === null means "bake": apply `to` outright. */
function blendScalar(from: unknown, to: unknown, W: string | null): unknown {
  if (to === undefined) return from;
  if (W === null) return to;
  const fromOk = typeof from === "number" || typeof from === "string";
  const toOk = typeof to === "number" || typeof to === "string";
  if (!fromOk || !toOk) return to;
  return `((1-(${W}))*${paren(from as number | string)}+(${W})*${paren(to as number | string)})`;
}

function blendValue(key: string, from: unknown, to: unknown, W: string | null): unknown {
  if (SNAP_KEYS.has(key)) return to; // snap on arrival at the step
  if (Array.isArray(to)) {
    const f = Array.isArray(from) ? from : [];
    return to.map((tv, i) => blendScalar(f[i] ?? 0, tv, W));
  }
  return blendScalar(from, to, W);
}

function applyTween(
  obj: Record<string, unknown>,
  to: Record<string, unknown>,
  W: string | null,
): Record<string, unknown> {
  const out = { ...obj };
  for (const [k, v] of Object.entries(to)) out[k] = blendValue(k, obj[k], v, W);
  return out;
}

/** Does any step declare tweens (i.e. is the resolver non-trivial)? */
export function sceneHasTweens(spec: SceneSpec): boolean {
  return (spec.steps ?? []).some((s) => (s.tweens?.length ?? 0) > 0);
}

/**
 * Resolve the primitive tree for the given step. Objects untouched by any
 * tween keep reference identity (memo-friendly); tweened objects come back
 * as new objects with baked values (completed steps) and/or uu-blend
 * expressions (the current step).
 */
export function resolveChoreography(spec: SceneSpec, stepIdx: number): Primitive[] {
  if (!sceneHasTweens(spec)) return spec.objects;
  const steps = spec.steps ?? [];

  // Ordered edit list per target id: bakes (W = null) from completed steps —
  // and from instant (durationless) steps up to and including the current
  // one — then blend windows for the current timed step.
  const edits = new Map<string, Array<{ to: Record<string, unknown>; W: string | null }>>();
  steps.forEach((s, j) => {
    if (j > stepIdx) return;
    const D = s.duration ?? 0;
    for (const tw of s.tweens ?? []) {
      if (!tw || typeof tw.target !== "string" || !tw.to || typeof tw.to !== "object") continue;
      const list = edits.get(tw.target) ?? [];
      list.push({
        to: tw.to as Record<string, unknown>,
        W: j < stepIdx || D <= 0.05 ? null : windowExpr(tw, D),
      });
      edits.set(tw.target, list);
    }
  });
  if (edits.size === 0) return spec.objects;

  const walk = (p: Primitive): Primitive => {
    let q = p as unknown as Record<string, unknown>;
    const id = q.id;
    if (typeof id === "string" && edits.has(id)) {
      for (const e of edits.get(id)!) q = applyTween(q, e.to, e.W);
    }
    if (q.kind === "group" && Array.isArray(q.children)) {
      const children = (q.children as Primitive[]).map(walk);
      const changed = q !== (p as unknown) || children.some((c, i) => c !== (q.children as Primitive[])[i]);
      if (changed) q = { ...q, children };
    }
    return q as unknown as Primitive;
  };
  return spec.objects.map(walk);
}
