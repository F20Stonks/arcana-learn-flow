import { describe, it, expect } from "vitest";
import { evaluate } from "mathjs";
import { projectDrag, type Scope } from "./dragConstraint";
import type { DragConstraint } from "./sceneSpec";

const ev = (expr: number | string, scope: Scope): number => {
  if (typeof expr === "number") return expr;
  try {
    const v = evaluate(expr, scope);
    return typeof v === "number" && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
};

const at = (x: number, y: number) => ({ x, y });
const project = (raw: { x: number; y: number }, c: DragConstraint, scope: Scope = {}, start = raw) =>
  projectDrag(raw, c, scope, start, ev);

/** Distance from the circle the point is supposed to be riding. */
const radialError = (p: { x: number; y: number }, cx: number, cy: number, r: number) =>
  Math.abs(Math.hypot(p.x - cx, p.y - cy) - r);

describe("projectDrag — circle", () => {
  const c: DragConstraint = { on: "circle", center: [0, 0], radius: 2.5 };

  it("puts an outside point on the circle, keeping its direction", () => {
    const p = project(at(10, 0), c);
    expect(radialError(p, 0, 0, 2.5)).toBeLessThan(1e-9);
    expect(p.y).toBeCloseTo(0, 9);
    expect(p.x).toBeCloseTo(2.5, 9);
  });

  it("pushes an inside point outward rather than leaving it inside", () => {
    const p = project(at(0.3, 0.3), c);
    expect(radialError(p, 0, 0, 2.5)).toBeLessThan(1e-9);
  });

  it("is idempotent — projecting an already-constrained point does not move it", () => {
    const once = project(at(3, 4), c);
    const twice = project(once, c);
    expect(twice.x).toBeCloseTo(once.x, 12);
    expect(twice.y).toBeCloseTo(once.y, 12);
  });

  it("respects a non-origin centre", () => {
    const off: DragConstraint = { on: "circle", center: [-3.4, 2], radius: 1.8 };
    const p = project(at(0, 0), off);
    expect(radialError(p, -3.4, 2, 1.8)).toBeLessThan(1e-9);
  });

  it("takes its radius from a slider expression", () => {
    const live: DragConstraint = { on: "circle", radius: "r" };
    expect(radialError(project(at(5, 5), live, { r: 1 }), 0, 0, 1)).toBeLessThan(1e-9);
    expect(radialError(project(at(5, 5), live, { r: 4 }), 0, 0, 4)).toBeLessThan(1e-9);
  });

  it("holds the starting angle when dragged exactly through the centre", () => {
    // No direction to project along — must not jump to an arbitrary side.
    const p = project(at(0, 0), c, {}, at(0, -1));
    expect(radialError(p, 0, 0, 2.5)).toBeLessThan(1e-9);
    expect(p.y).toBeCloseTo(-2.5, 9);
  });
});

describe("projectDrag — segment", () => {
  const c: DragConstraint = { on: "segment", from: [0, 0], to: [4, 0] };

  it("drops a point perpendicularly onto the segment", () => {
    expect(project(at(2, 7), c)).toEqual({ x: 2, y: 0 });
  });

  it("clamps past each end instead of running along the infinite line", () => {
    expect(project(at(-9, 3), c)).toEqual({ x: 0, y: 0 });
    expect(project(at(99, -3), c)).toEqual({ x: 4, y: 0 });
  });

  it("handles a diagonal segment", () => {
    const diag: DragConstraint = { on: "segment", from: [0, 0], to: [2, 2] };
    const p = project(at(2, 0), diag);
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.y).toBeCloseTo(1, 9);
  });

  it("degenerates safely when both endpoints coincide", () => {
    const dot: DragConstraint = { on: "segment", from: [1, 1], to: [1, 1] };
    expect(project(at(50, -50), dot)).toEqual({ x: 1, y: 1 });
  });
});

describe("projectDrag — curve", () => {
  const parabola: DragConstraint = { on: "curve", x: "t", y: "t^2", tMin: -3, tMax: 3, samples: 400 };

  it("snaps onto the curve", () => {
    const p = project(at(1, 8), parabola);
    // Whatever it picked must actually satisfy y = x².
    expect(Math.abs(p.y - p.x * p.x)).toBeLessThan(1e-6);
  });

  it("picks a genuinely near point, not just any point on the curve", () => {
    const p = project(at(2, 4), parabola);
    expect(Math.hypot(p.x - 2, p.y - 4)).toBeLessThan(0.05);
  });

  it("stays inside the declared parameter range", () => {
    const p = project(at(50, 50), parabola);
    expect(p.x).toBeGreaterThanOrEqual(-3);
    expect(p.x).toBeLessThanOrEqual(3);
  });

  it("leaves the point where it was when every sample is NaN", () => {
    const broken: DragConstraint = { on: "curve", x: "t", y: "sqrt(-1-t^2)", tMin: 0, tMax: 1 };
    expect(project(at(9, 9), broken, {}, at(1, 2))).toEqual({ x: 1, y: 2 });
  });
});

describe("projectDrag — axis locks and grid", () => {
  it("horizontal keeps the y the drag started from, not y=0", () => {
    expect(project(at(3, 99), { on: "horizontal" }, {}, at(0, -1.2))).toEqual({ x: 3, y: -1.2 });
  });

  it("vertical keeps the x the drag started from", () => {
    expect(project(at(99, 3), { on: "vertical" }, {}, at(-1.2, 0))).toEqual({ x: -1.2, y: 3 });
  });

  it("grid snaps to the nearest multiple of step", () => {
    expect(project(at(1.4, -2.6), { on: "grid", step: 1 })).toEqual({ x: 1, y: -3 });
    expect(project(at(1.4, -2.6), { on: "grid", step: 0.5 })).toEqual({ x: 1.5, y: -2.5 });
  });

  it("survives a zero or missing step instead of collapsing to the origin", () => {
    expect(project(at(1.4, -2.6), { on: "grid", step: 0 })).toEqual({ x: 1, y: -3 });
    expect(project(at(1.4, -2.6), { on: "grid" })).toEqual({ x: 1, y: -3 });
  });
});

describe("projectDrag — robustness", () => {
  it("never returns NaN when a constraint expression is unresolvable", () => {
    // `r` is not in scope: the radius falls back rather than poisoning the result.
    const p = project(at(3, 4), { on: "circle", radius: "r" }, {});
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it("keeps a seeded point on its object before any drag happens", () => {
    // MathTheater seeds non-literal drag coords to 1, then projects. That seed
    // must already satisfy the constraint, or the point renders off its curve
    // until the student touches it.
    const seed = at(1, 1);
    const p = projectDrag(seed, { on: "circle", radius: 2.5 }, {}, seed, ev);
    expect(radialError(p, 0, 0, 2.5)).toBeLessThan(1e-9);
  });
});
