import { describe, it, expect } from "vitest";
import { checkNumericAnswer, checkMatrixAnswer } from "./answerCheck";

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
