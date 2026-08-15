/**
 * Projection for `DragConstraint` — the renderer-side half of a glider.
 *
 * Lives in lib, not in Scene3D, for two reasons: it is pure plane geometry with
 * no three.js in it, and it runs in two places that must never disagree — the
 * pointer-move handler while dragging, and MathTheater's param seeding, which
 * has to put a constrained point ON its object from the first frame rather than
 * from the first touch. One implementation, one set of tests.
 *
 * The expression evaluator is injected rather than imported: the renderer holds
 * a compiled-expression cache, and the "curve" case evaluates two expressions
 * per sample — a few hundred mathjs parses per pointer-move would be far too
 * slow. Callers pass whatever compiler they already have.
 */
import type { DragConstraint } from "./sceneSpec";

export type Scope = Record<string, number>;
export type Vec2 = { x: number; y: number };

/** Evaluates a literal-or-expression against the scene scope. */
export type ExprEval = (expr: number | string, scope: Scope) => number;

/** Samples used when snapping to a curve, unless the constraint overrides it. */
const DEFAULT_CURVE_SAMPLES = 160;
const MIN_CURVE_SAMPLES = 16;
const MAX_CURVE_SAMPLES = 400;

/**
 * Snap `raw` onto whatever the constraint allows.
 *
 * `start` is where the point sat when the drag began — the axis locks need it,
 * since "horizontal" means "keep the y you started this drag with", not
 * "keep y = 0". Callers that are seeding rather than dragging can pass the seed
 * position as both `raw` and `start`.
 *
 * Never throws and never returns a non-finite pair for a well-formed
 * constraint: a NaN escaping here would strand the point off-screen.
 */
export function projectDrag(
  raw: Vec2,
  c: DragConstraint,
  scope: Scope,
  start: Vec2,
  evalExpr: ExprEval,
): Vec2 {
  const ev = (e: number | string | undefined, fallback: number) => {
    if (e === undefined) return fallback;
    const v = evalExpr(e, scope);
    return Number.isFinite(v) ? v : fallback;
  };

  switch (c.on) {
    case "horizontal":
      return { x: raw.x, y: start.y };

    case "vertical":
      return { x: start.x, y: raw.y };

    case "grid": {
      // A zero or NaN step would collapse every position onto the origin.
      const step = Math.abs(ev(c.step, 1)) || 1;
      return { x: Math.round(raw.x / step) * step, y: Math.round(raw.y / step) * step };
    }

    case "circle": {
      const cx = c.center ? ev(c.center[0], 0) : 0;
      const cy = c.center ? ev(c.center[1], 0) : 0;
      const r = ev(c.radius, 1);
      const dx = raw.x - cx;
      const dy = raw.y - cy;
      const len = Math.hypot(dx, dy);
      if (len > 1e-9) return { x: cx + (dx / len) * r, y: cy + (dy / len) * r };
      // Dead centre has no direction to project along. Fall back to the angle
      // the drag started at, so a pointer crossing the middle doesn't make the
      // point jump to an arbitrary side.
      const sx = start.x - cx;
      const sy = start.y - cy;
      const slen = Math.hypot(sx, sy);
      if (slen > 1e-9) return { x: cx + (sx / slen) * r, y: cy + (sy / slen) * r };
      return { x: cx + r, y: cy };
    }

    case "segment": {
      const ax = ev(c.from[0], 0);
      const ay = ev(c.from[1], 0);
      const bx = ev(c.to[0], 0);
      const by = ev(c.to[1], 0);
      const vx = bx - ax;
      const vy = by - ay;
      const len2 = vx * vx + vy * vy;
      if (len2 < 1e-12) return { x: ax, y: ay };
      // Clamped scalar projection — a glider on a segment stops at its ends
      // rather than sliding along the infinite line through them.
      const t = Math.min(1, Math.max(0, ((raw.x - ax) * vx + (raw.y - ay) * vy) / len2));
      return { x: ax + t * vx, y: ay + t * vy };
    }

    case "curve": {
      const t0 = ev(c.tMin, 0);
      const t1 = ev(c.tMax, 1);
      const n = Math.min(MAX_CURVE_SAMPLES, Math.max(MIN_CURVE_SAMPLES, Math.round(c.samples ?? DEFAULT_CURVE_SAMPLES)));
      // Nearest sample rather than a closed-form solve: almost no curve worth
      // plotting has an analytic nearest-point, and at this sample count the
      // error is well under a pixel at normal zoom.
      const s: Scope = { ...scope };
      let best: Vec2 | null = null;
      let bestD = Infinity;
      for (let i = 0; i <= n; i++) {
        s.t = t0 + ((t1 - t0) * i) / n;
        const px = evalExpr(c.x, s);
        const py = evalExpr(c.y, s);
        if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
        const d = (px - raw.x) ** 2 + (py - raw.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x: px, y: py };
        }
      }
      // Every sample was NaN (an expression that is broken everywhere, not just
      // at an asymptote) — leave the point where it is rather than teleporting it.
      return best ?? { x: start.x, y: start.y };
    }

    default:
      return raw;
  }
}
