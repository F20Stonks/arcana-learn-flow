import { describe, it, expect } from "vitest";
import type { SceneSpec } from "./sceneSpec";
import { validateScene } from "./sceneValidate";
import { mechanicalRepair } from "./sceneRepair";

/** Minimal valid scene shell — tests add only the objects they care about. */
function scene(partial: Partial<SceneSpec>): SceneSpec {
  return {
    title: "test",
    view: "2d",
    objects: [],
    ...partial,
  } as SceneSpec;
}

const goodCurve = { kind: "curve", x: "t", y: "t^2", tMin: -2, tMax: 2, color: "#3b82f6" };
const brokenCurve = { kind: "curve", x: "t", y: "t^^2 +", tMin: -2, tMax: 2, color: "#ef4444" };

describe("validateScene", () => {
  it("hard-fails a scene whose expression cannot compile", () => {
    const r = validateScene(scene({ objects: [brokenCurve] as never }), 0);
    expect(r.hardFail).toBe(true);
    expect(r.exprIssues.some((i) => i.kind === "compile-error")).toBe(true);
  });

  it("attaches an index path to the failing primitive", () => {
    const r = validateScene(scene({ objects: [goodCurve, brokenCurve] as never }), 0);
    const issue = r.exprIssues.find((i) => i.kind === "compile-error");
    expect(issue?.path).toEqual([1]);
  });

  // Regression: `count` may be a mathjs expression (the live-count family). Deriving sample indices
  // arithmetically from that string produced NaN indices, so every expression reading `i` evaluated
  // to NaN and was reported as nan-at-default — a false hard-failure on exactly the dynamic scenes
  // the primitive exists for.
  it("does not false-fail a points family whose count is an expression", () => {
    const s = scene({
      sliders: [{ key: "n", label: "n", min: 1, max: 20, default: 8, step: 1 }],
      objects: [{ kind: "points", count: "n", x: "i", y: "i^2", color: "#3b82f6" }] as never,
    });
    const r = validateScene(s, 0);
    expect(r.exprIssues.filter((i) => i.kind === "nan-at-default")).toEqual([]);
    expect(r.hardFail).toBe(false);
  });
});

describe("mechanicalRepair", () => {
  it("prunes only the broken primitive and leaves the scene renderable", () => {
    const s = scene({ objects: [goodCurve, brokenCurve] as never });
    const before = validateScene(s, 0);
    expect(before.hardFail).toBe(true);

    const { scene: fixed, actions } = mechanicalRepair(s, before);
    const after = validateScene(fixed, 0);

    expect(after.hardFail).toBe(false);
    expect(fixed.objects).toHaveLength(1);
    expect((fixed.objects[0] as { y: string }).y).toBe("t^2");
    expect(actions.some((a) => a.kind === "pruned-primitive")).toBe(true);
  });

  it("does not mutate the scene it was given", () => {
    const s = scene({ objects: [goodCurve, brokenCurve] as never });
    const report = validateScene(s, 0);
    mechanicalRepair(s, report);
    expect(s.objects).toHaveLength(2);
  });

  it("drops a slider no expression reads", () => {
    const s = scene({
      sliders: [
        { key: "a", label: "a", min: 0, max: 5, default: 1, step: 1 },
        { key: "unused", label: "unused", min: 0, max: 5, default: 1, step: 1 },
      ],
      objects: [{ kind: "curve", x: "t", y: "a*t", tMin: -2, tMax: 2, color: "#3b82f6" }] as never,
    });
    const report = validateScene(s, 0);
    expect(report.flags).toContain("inert-slider:unused");

    const { scene: fixed, actions } = mechanicalRepair(s, report);
    expect(fixed.sliders?.map((x) => x.key)).toEqual(["a"]);
    expect(actions.some((a) => a.kind === "dropped-inert-slider")).toBe(true);
  });

  it("clamps a step tag pointing past the last declared step", () => {
    const s = scene({
      steps: [{ label: "one" }, { label: "two" }] as never,
      objects: [{ ...goodCurve, step: 7 }] as never,
    });
    const report = validateScene(s, 0);
    const { scene: fixed, actions } = mechanicalRepair(s, report);
    expect((fixed.objects[0] as { step: number }).step).toBe(2);
    expect(actions.some((a) => a.kind === "clamped-step")).toBe(true);
  });

  it("prunes a nested broken child without destroying its group", () => {
    const s = scene({
      objects: [{ kind: "group", children: [goodCurve, brokenCurve] }] as never,
    });
    const report = validateScene(s, 0);
    const issue = report.exprIssues.find((i) => i.kind === "compile-error");
    expect(issue?.path).toEqual([0, 1]);

    const { scene: fixed } = mechanicalRepair(s, report);
    expect(validateScene(fixed, 0).hardFail).toBe(false);
    expect((fixed.objects[0] as { children: unknown[] }).children).toHaveLength(1);
  });
});
