import { describe, expect, it } from "vitest";
import { defaultCheck, normaliseNumeric, parseNumericAnswer } from "./check";
import { accuracy, barVerdict, medianLatency, scoreSection, tagBreakdown } from "./scoring";
import { seededRng, shuffle, weightedPick } from "./rng";
import type { AssessmentItem, ItemResult, ModuleSpec, RunResult } from "../types";

const item = (over: Partial<AssessmentItem> = {}): AssessmentItem => ({
  id: "i1",
  tag: "add",
  prompt: "2 + 2",
  answer: "4",
  ...over,
});

const result = (over: Partial<ItemResult> = {}): ItemResult => ({
  itemId: "i1",
  tag: "add",
  prompt: "2 + 2",
  given: "4",
  expected: "4",
  correct: true,
  skipped: false,
  latencyMs: 1000,
  ...over,
});

const module = (over: Partial<ModuleSpec> = {}): ModuleSpec => ({
  id: "m",
  name: "M",
  kind: "arithmetic",
  blurb: "",
  rules: [],
  itemCount: 4,
  durationS: 60,
  perItemMs: null,
  input: "typed-number",
  negativeMarking: false,
  allowSkip: false,
  allowBack: false,
  calculator: false,
  passMark: null,
  generate: () => item(),
  ...over,
});

describe("answer checking", () => {
  it("accepts the forms a hurrying candidate actually types", () => {
    expect(parseNumericAnswer("  16.1 ")).toBeCloseTo(16.1);
    expect(parseNumericAnswer(".25")).toBeCloseTo(0.25);
    expect(parseNumericAnswer("1/4")).toBeCloseTo(0.25);
    expect(parseNumericAnswer("-7/2")).toBeCloseTo(-3.5);
    expect(parseNumericAnswer("+8")).toBe(8);
    expect(parseNumericAnswer("1,250")).toBe(1250);
  });

  it("reads a real minus sign as a minus sign", () => {
    // The prompts render −, so candidates copy − back. Rejecting it would be a grading bug.
    expect(parseNumericAnswer("−3")).toBe(-3);
    expect(normaliseNumeric("−3")).toBe("-3");
  });

  it("refuses what it cannot read rather than guessing", () => {
    expect(parseNumericAnswer("")).toBeNull();
    expect(parseNumericAnswer("abc")).toBeNull();
    expect(parseNumericAnswer("1/0")).toBeNull();
    expect(parseNumericAnswer("2+2")).toBeNull();
  });

  it("does not treat a decimal comma as a thousands separator", () => {
    expect(parseNumericAnswer("1,25")).toBeNull();
  });

  it("accepts any spelling of the same number", () => {
    expect(defaultCheck(item({ answer: "5/6" }), "5/6")).toBe(true);
    expect(defaultCheck(item({ answer: "0.5" }), "1/2")).toBe(true);
    expect(defaultCheck(item({ answer: "16.1" }), "16.10")).toBe(true);
    // A decimal given to enough places is the same answer; a rounded one is a different number,
    // and these tests are marked on the number.
    expect(defaultCheck(item({ answer: "5/6" }), "0.8333333333")).toBe(true);
    expect(defaultCheck(item({ answer: "5/6" }), "0.83")).toBe(false);
  });

  it("compares choice items by id, not by text", () => {
    const choiceItem = item({ answer: "b", choices: [{ id: "a", label: "3" }, { id: "b", label: "4" }] });
    expect(defaultCheck(choiceItem, "b")).toBe(true);
    expect(defaultCheck(choiceItem, "4")).toBe(false);
  });
});

describe("scoring", () => {
  it("applies negative marking only where the module sets it", () => {
    const items = [result(), result({ correct: false }), result({ correct: false })];
    expect(scoreSection(module({ negativeMarking: false }), items, 60).rawScore).toBe(1);
    expect(scoreSection(module({ negativeMarking: true }), items, 60).rawScore).toBe(0);
  });

  it("scores an unanswered question as zero either way", () => {
    const items = [result(), result({ skipped: true, correct: false, given: "" })];
    const section = scoreSection(module({ negativeMarking: true }), items, 60);
    expect(section.rawScore).toBe(1);
    expect(section.skipped).toBe(1);
    expect(section.wrong).toBe(0);
  });

  it("never reports a negative headline score", () => {
    const items = Array.from({ length: 5 }, () => result({ correct: false }));
    expect(scoreSection(module({ negativeMarking: true }), items, 60).rawScore).toBe(0);
  });

  it("measures accuracy over attempted questions, not over the paper", () => {
    const items = [result(), result({ correct: false }), result({ skipped: true, correct: false })];
    expect(accuracy(scoreSection(module(), items, 60))).toBeCloseTo(0.5);
  });

  it("calls a score just under the bar borderline rather than a failure", () => {
    const mod = module({ passMark: 50 });
    const at = (score: number) =>
      barVerdict({ ...scoreSection(mod, [], 60), rawScore: score, passMark: 50 });
    expect(at(50)).toBe("above");
    expect(at(46)).toBe("near");
    expect(at(30)).toBe("below");
    expect(barVerdict({ ...scoreSection(module(), [], 60), rawScore: 10 })).toBe("unknown");
  });

  it("takes the median latency over answered questions only", () => {
    const items = [
      result({ latencyMs: 1000 }),
      result({ latencyMs: 3000 }),
      result({ latencyMs: 5000 }),
      result({ skipped: true, latencyMs: 0 }),
    ];
    expect(medianLatency(scoreSection(module(), items, 60))).toBe(3000);
  });

  it("ranks the weakest tag first in the breakdown", () => {
    const run: RunResult = {
      firmId: "f",
      specVersion: 1,
      startedAt: 0,
      finishedAt: 1,
      tabBlurCount: 0,
      sections: [
        scoreSection(
          module(),
          [
            result({ tag: "add" }),
            result({ tag: "add" }),
            result({ tag: "div_exact", correct: false }),
            result({ tag: "div_exact", correct: false }),
          ],
          60,
        ),
      ],
    };
    expect(tagBreakdown(run)[0].tag).toBe("div_exact");
  });
});

describe("seeded rng", () => {
  it("reproduces a run from its seed", () => {
    const draw = () => {
      const rng = seededRng(2026);
      return Array.from({ length: 20 }, () => rng());
    };
    expect(draw()).toEqual(draw());
  });

  it("never picks an operation a profile has switched off", () => {
    const rng = seededRng(5);
    const weights = { add: 3, sub: 0, mul: 1 };
    const picks = new Set(Array.from({ length: 500 }, () => weightedPick(weights, rng)));
    expect(picks.has("sub")).toBe(false);
    expect(picks.has("add")).toBe(true);
  });

  it("shuffles without losing or duplicating anything", () => {
    const source = Array.from({ length: 50 }, (_, i) => i);
    const out = shuffle(source, seededRng(9));
    expect(out).toHaveLength(50);
    expect(new Set(out).size).toBe(50);
    expect(out).not.toEqual(source);
  });
});
