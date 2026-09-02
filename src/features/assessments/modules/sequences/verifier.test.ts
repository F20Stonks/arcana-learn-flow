import { describe, expect, it } from "vitest";
import {
  complexityScore,
  fitAffine1,
  fitAlternating,
  fitArithmetic,
  fitGeometric,
  fitInterleaved,
  fitLinearRecurrence2,
  fitQuadratic,
  runFitters,
} from "./fitters";
import { checkAmbiguityLetters, checkAmbiguityNumeric, EXOTIC_COMPLEXITY } from "./verifier";

describe("individual fitters", () => {
  it("fits a clean arithmetic sequence", () => {
    const fit = fitArithmetic([3, 7, 11, 15]);
    expect(fit).not.toBeNull();
    expect(fit!.nextTerm).toBe(19);
  });

  it("rejects arithmetic when the differences aren't constant", () => {
    expect(fitArithmetic([2, 4, 8])).toBeNull();
  });

  it("fits a clean geometric sequence", () => {
    const fit = fitGeometric([2, 4, 8]);
    expect(fit).not.toBeNull();
    expect(fit!.nextTerm).toBe(16);
  });

  it("fits the classic ambiguous prefix as a constant-second-difference quadratic predicting 14", () => {
    // 2, 4, 8 also has a constant second difference (2): 2,4 -> diff 2; 4,8 -> diff 4; second
    // difference 4-2=2, so the next first-difference is 4+2=6, giving 8+6=14 — the textbook
    // "differences double" ambiguity the task calls out.
    const fit = fitQuadratic([2, 4, 8]);
    expect(fit).not.toBeNull();
    expect(fit!.nextTerm).toBe(14);
  });

  it("fits multiply-then-add and confirms against a fourth term", () => {
    // a(n) = 2a(n-1) + 1
    const fit = fitAffine1([2, 5, 11, 23]);
    expect(fit).not.toBeNull();
    expect(fit!.nextTerm).toBe(47);
  });

  it("rejects multiply-then-add when a later term breaks the fit", () => {
    expect(fitAffine1([2, 5, 11, 24])).toBeNull();
  });

  it("fits an order-2 linear recurrence and confirms against a fifth term", () => {
    // Fibonacci itself: p=1, q=1.
    const fit = fitLinearRecurrence2([1, 1, 2, 3, 5]);
    expect(fit).not.toBeNull();
    expect(fit!.nextTerm).toBe(8);
  });

  it("rejects an order-2 linear recurrence when a later term breaks the fit", () => {
    expect(fitLinearRecurrence2([1, 1, 2, 3, 6])).toBeNull();
  });

  it("fits alternating sign around an arithmetic magnitude", () => {
    // magnitudes 3, 7, 11, 15, 19, 23 (d=4), signs +,-,+,-,+,-
    const fit = fitAlternating([3, -7, 11, -15, 19, -23]);
    expect(fit).not.toBeNull();
    expect(fit!.nextTerm).toBe(27);
  });

  it("does not fit alternating sign when signs don't actually alternate", () => {
    expect(fitAlternating([3, -7, -11, -15, 19, -23])).toBeNull();
  });

  it("fits interleaved arithmetic branches and predicts the correct next branch", () => {
    // branch A (positions 0,2,4): 1, 4, 7 (d=3) -> next 10
    // branch B (positions 1,3,5): 100, 90, 80 (d=-10) -> next 70
    const fit = fitInterleaved([1, 100, 4, 90, 7, 80]);
    expect(fit).not.toBeNull();
    // seq.length (6) is even, so index 6 continues branch A.
    expect(fit!.nextTerm).toBe(10);
  });

  it("runFitters finds every rule that matches a plain arithmetic prefix", () => {
    const fits = runFitters([3, 7, 11, 15]);
    const arithmetic = fits.find((f) => f.name === "arithmetic");
    expect(arithmetic?.nextTerm).toBe(19);
    expect(fits.find((f) => f.name === "geometric")).toBeUndefined();
  });
});

describe("checkAmbiguityNumeric — the classic 2, 4, 8 ambiguity", () => {
  it("rejects when the intended rule is the higher-complexity quadratic one, since the strictly simpler geometric fit disagrees", () => {
    const intendedComplexity = complexityScore(3, [2]); // fitQuadratic's own second-difference coefficient
    const result = checkAmbiguityNumeric([2, 4, 8], 14, intendedComplexity);
    expect(result.ambiguous).toBe(true);
    expect(result.conflicts.some((c) => c.name === "geometric" && c.nextTerm === 16)).toBe(true);
  });

  it("does not reject when the intended rule is the lower-complexity geometric one", () => {
    // Nothing at or below geometric's own complexity (paramCount 2) disagrees: arithmetic doesn't
    // fit 2, 4, 8 at all, and quadratic (paramCount 3) is strictly *more* complex, so under the
    // "<=" rule it is never grounds to reject a simpler, well-supported rule — a more elaborate
    // alternative explanation can always be found for any short prefix.
    const intendedComplexity = complexityScore(2, [2]);
    const result = checkAmbiguityNumeric([2, 4, 8], 16, intendedComplexity);
    expect(result.ambiguous).toBe(false);
  });
});

describe("checkAmbiguityNumeric — other cases", () => {
  it("rejects a too-short prefix where two equally-simple rules agree on what's shown but disagree on what's next", () => {
    // With only two terms shown, arithmetic (d=2, predicting 6) and geometric (r=2, predicting 8)
    // are equally well supported (paramCount 2 each) and genuinely disagree — exactly why every
    // family in this module shows at least four terms before asking for the next one.
    const intendedComplexity = complexityScore(2, [2]);
    const result = checkAmbiguityNumeric([2, 4], 6, intendedComplexity);
    expect(result.ambiguous).toBe(true);
    expect(result.conflicts.some((c) => c.name === "geometric" && c.nextTerm === 8)).toBe(true);
  });

  it("accepts plain arithmetic once there are enough confirming terms", () => {
    const intendedComplexity = complexityScore(2, [4]);
    const result = checkAmbiguityNumeric([3, 7, 11, 15], 19, intendedComplexity);
    expect(result.ambiguous).toBe(false);
  });

  it("accepts plain geometric once there are enough confirming terms", () => {
    const intendedComplexity = complexityScore(2, [3]);
    const result = checkAmbiguityNumeric([2, 6, 18, 54], 162, intendedComplexity);
    expect(result.ambiguous).toBe(false);
  });

  it("never rejects on agreement, however many fits succeed", () => {
    // 2,4,6,8,10 is arithmetic (d=2) AND (degenerately) a constant-second-difference quadratic
    // (second difference 0) — both predict 12, so this must NOT be flagged ambiguous even though
    // more than one fitter matches.
    const intendedComplexity = complexityScore(2, [2]);
    const result = checkAmbiguityNumeric([2, 4, 6, 8, 10], 12, intendedComplexity);
    expect(result.ambiguous).toBe(false);
  });
});

describe("checkAmbiguityLetters", () => {
  it("accepts an unambiguous letter arithmetic progression", () => {
    const intendedComplexity = complexityScore(2, [2]);
    const result = checkAmbiguityLetters(["A", "C", "E", "G"], "I", intendedComplexity);
    expect(result.ambiguous).toBe(false);
  });

  it("rejects a too-short letter prefix the same way the numeric case is rejected", () => {
    // C, E (offsets 2, 4): arithmetic (+2, predicting G/offset 6) and geometric (*2, predicting
    // I/offset 8) are equally well supported with only two letters shown — the same short-prefix
    // trap as the numeric [2, 4] case above, spelled out in letters.
    const intendedComplexity = complexityScore(2, [2]);
    const result = checkAmbiguityLetters(["C", "E"], "G", intendedComplexity);
    expect(result.ambiguous).toBe(true);
    expect(result.conflicts.some((c) => c.name === "geometric" && c.nextTerm === 8)).toBe(true);
  });
});

describe("EXOTIC_COMPLEXITY", () => {
  it("is a sentinel no real fit complexity can reach", () => {
    expect(EXOTIC_COMPLEXITY).toBe(Number.POSITIVE_INFINITY);
    expect(complexityScore(4, [999])).toBeLessThan(EXOTIC_COMPLEXITY);
  });
});
