import { describe, it, expect } from "vitest";
import { checkNumericAnswer, checkMatrixAnswer, checkSymbolicAnswer } from "./answerCheck";

describe("checkNumericAnswer", () => {
  it("accepts an exact unitless match", () => {
    expect(checkNumericAnswer("9.8", "", "9.8", "")).toEqual({ numericCorrect: true, unitCorrect: null });
  });

  it("rejects a wrong unitless number", () => {
    expect(checkNumericAnswer("5", "", "9.8", "")).toEqual({ numericCorrect: false, unitCorrect: null });
  });

  it("accepts within tolerance for a unitless number", () => {
    expect(checkNumericAnswer("9.81", "", "9.8", "")).toEqual({ numericCorrect: true, unitCorrect: null });
  });

  it("right number, right unit", () => {
    expect(checkNumericAnswer("9.8", "m/s^2", "9.8", "m/s^2")).toEqual({ numericCorrect: true, unitCorrect: true });
  });

  it("right number, equivalent-but-different unit (N/kg vs m/s^2)", () => {
    expect(checkNumericAnswer("9.8", "N/kg", "9.8", "m/s^2")).toEqual({ numericCorrect: true, unitCorrect: true });
  });

  it("right number, different scale of an equivalent unit (mm/s^2 vs m/s^2)", () => {
    expect(checkNumericAnswer("9800", "mm/s^2", "9.8", "m/s^2")).toEqual({ numericCorrect: true, unitCorrect: true });
  });

  it("right number, missing unit entirely", () => {
    expect(checkNumericAnswer("9.8", "", "9.8", "m/s^2")).toEqual({ numericCorrect: true, unitCorrect: false });
  });

  it("right number, wrong dimension of unit (metres for an acceleration question)", () => {
    expect(checkNumericAnswer("9.8", "m", "9.8", "m/s^2")).toEqual({ numericCorrect: false, unitCorrect: false });
  });

  it("right number, garbage unit string", () => {
    expect(checkNumericAnswer("9.8", "bananas", "9.8", "m/s^2")).toEqual({ numericCorrect: false, unitCorrect: false });
  });

  it("wrong number, right unit", () => {
    expect(checkNumericAnswer("5", "m/s^2", "9.8", "m/s^2")).toEqual({ numericCorrect: false, unitCorrect: true });
  });

  it("handles a zero expected value without dividing by zero", () => {
    expect(checkNumericAnswer("0", "", "0", "")).toEqual({ numericCorrect: true, unitCorrect: null });
    expect(checkNumericAnswer("0.5", "", "0", "")).toEqual({ numericCorrect: false, unitCorrect: null });
  });

  // parseFloat("pi/4") is NaN and parseFloat("2*sqrt(2)") is 2, so an expected answer written as an
  // expression previously marked EVERY student answer wrong, including the correct one.
  it("accepts a decimal against an expected answer written as an expression", () => {
    expect(checkNumericAnswer("0.7854", "", "pi/4", "").numericCorrect).toBe(true);
  });

  it("rejects a wrong decimal against an expression-valued expected answer", () => {
    expect(checkNumericAnswer("2", "", "pi/4", "").numericCorrect).toBe(false);
  });

  it("accepts a student who answers in exact form rather than decimal", () => {
    expect(checkNumericAnswer("pi/4", "", "0.7853981634", "").numericCorrect).toBe(true);
    expect(checkNumericAnswer("2*sqrt(2)", "", "2.828427", "").numericCorrect).toBe(true);
  });

  it("treats an unparseable student value as incorrect, not a crash", () => {
    expect(checkNumericAnswer("not a number", "", "9.8", "")).toEqual({ numericCorrect: false, unitCorrect: null });
  });
});

describe("checkMatrixAnswer", () => {
  it("accepts an exact 2x2 match", () => {
    expect(checkMatrixAnswer(["1", "0", "0", "1"], "1,0;0,1")).toEqual({ correct: true });
  });

  it("rejects a wrong entry", () => {
    expect(checkMatrixAnswer(["1", "0", "0", "-1"], "1,0;0,1")).toEqual({ correct: false });
  });

  it("accepts a vector (cols=1) within tolerance", () => {
    expect(checkMatrixAnswer(["3.001", "4"], "3,4")).toEqual({ correct: true });
  });

  it("rejects a shape mismatch", () => {
    expect(checkMatrixAnswer(["1", "0"], "1,0;0,1")).toEqual({ correct: false });
  });

  it("treats a non-numeric cell as incorrect, not a crash", () => {
    expect(checkMatrixAnswer(["x", "0", "0", "1"], "1,0;0,1")).toEqual({ correct: false });
  });
});

describe("checkSymbolicAnswer", () => {
  const eq = (a: string, b: string) => checkSymbolicAnswer(a, b).equivalent;

  it("accepts a rationalised denominator", () => {
    expect(eq("2*(sqrt(2)-1)", "2/(1+sqrt(2))")).toBe(true);
  });

  it("accepts an expanded binomial", () => {
    expect(eq("x^2+2x+1", "(x+1)^2")).toBe(true);
  });

  it("accepts a trig identity", () => {
    expect(eq("1-cos(x)^2", "sin(x)^2")).toBe(true);
  });

  it("accepts a factorised quadratic", () => {
    expect(eq("(x-2)(x+3)", "x^2+x-6")).toBe(true);
  });

  it("accepts a log rule rewrite", () => {
    expect(eq("log(x)+log(y)", "log(x*y)")).toBe(true);
  });

  it("rejects a genuinely different expression", () => {
    expect(eq("x^2+2x+1", "x^2+2x-1")).toBe(false);
  });

  it("rejects a sign error", () => {
    expect(eq("-sin(x)", "sin(x)")).toBe(false);
  });

  // Only distinguishable off the positive reals — this is why the mixed-sign sampling phase exists.
  it("rejects sqrt(x^2) as equal to x", () => {
    expect(eq("sqrt(x^2)", "x")).toBe(false);
  });

  it("rejects a dropped constant of proportionality", () => {
    expect(eq("2*x", "x")).toBe(false);
  });

  it("accepts multivariable rearrangement", () => {
    expect(eq("(a+b)^2 - (a-b)^2", "4*a*b")).toBe(true);
  });

  it("accepts pure numeric equivalence", () => {
    expect(eq("1/2", "0.5")).toBe(true);
  });

  // MathLive hands us LaTeX, so notation must never be the reason an answer is marked wrong.
  it("accepts a LaTeX fraction against plain text", () => {
    expect(eq("\\frac{1}{2}x^{2}", "x^2/2")).toBe(true);
  });

  it("accepts LaTeX sqrt and pi", () => {
    expect(eq("\\sqrt{4}\\cdot\\pi", "2*pi")).toBe(true);
  });

  it("strips a y= label rather than comparing a relation to an expression", () => {
    expect(eq("y = 2x", "2*x")).toBe(true);
  });

  it("compares two equations by their difference", () => {
    expect(eq("x^2+y^2=1", "x^2+y^2-1=0")).toBe(true);
  });

  it("reports unparseable input as undecided rather than wrong", () => {
    const v = checkSymbolicAnswer("x^^+", "x");
    expect(v.equivalent).toBe(false);
    expect(v.undecided).toBe("unparseable-student");
  });

  it("gives the same verdict every time (seeded sampling)", () => {
    const runs = Array.from({ length: 5 }, () => checkSymbolicAnswer("sin(x)^2", "1-cos(x)^2").equivalent);
    expect(new Set(runs).size).toBe(1);
    expect(runs[0]).toBe(true);
  });
});
