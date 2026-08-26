import { describe, expect, it } from "vitest";
import { checkDefinite, checkIndefinite, describeFactor, normalize } from "./answer";

const D: [number, number] = [0.4, 2.2];

describe("normalize", () => {
  it("strips the constant of integration", () => {
    expect(normalize("x^2/2 + C")).toBe("x^2/2");
    expect(normalize("x^2/2 - c")).toBe("x^2/2");
  });

  it("expands LaTeX fractions and roots", () => {
    expect(normalize("\\frac{1}{2}")).toBe("((1)/(2))");
    expect(normalize("\\sqrt{x}")).toBe("sqrt(x)");
    expect(normalize("\\sqrt[3]{x}")).toBe("nthRoot(x,3)");
  });

  it("rewrites textbook function names", () => {
    expect(normalize("ln(x)")).toBe("log(x)");
    expect(normalize("arctan(x)")).toBe("atan(x)");
  });

  it("turns bars into abs", () => {
    expect(normalize("ln|x|")).toBe("log(abs(x))");
  });

  it("moves powers off function names", () => {
    expect(normalize("sin^2(x)")).toBe("((sin(x))^(2))");
    expect(normalize("sin^-1(x)")).toBe("asin(x)");
  });

  it("treats a variable before a bracket as multiplication", () => {
    expect(normalize("x(x+1)")).toBe("x*(x+1)");
    expect(normalize("2x(x+1)")).toBe("2x*(x+1)");
  });

  it("still sees a function name when a coefficient is jammed against it", () => {
    // A digit is a word character, so /\bln\b/ would miss the `ln` in `2ln|x|` entirely.
    expect(normalize("2ln|x|")).toBe("2log(abs(x))");
    expect(normalize("3arctan(x)")).toBe("3atan(x)");
  });
});

describe("checkIndefinite", () => {
  it("accepts the reference answer itself", () => {
    expect(checkIndefinite("x^3/3", "x^3/3", D).status).toBe("correct");
  });

  it("accepts any additive constant", () => {
    expect(checkIndefinite("x^3/3 + 17", "x^3/3", D).status).toBe("correct");
    expect(checkIndefinite("x^3/3 + C", "x^3/3", D).status).toBe("correct");
  });

  it("accepts genuinely different-looking equivalent forms", () => {
    // ∫ sin x cos x dx — three standard answers, all correct.
    expect(checkIndefinite("sin(x)^2/2", "-cos(x)^2/2", D).status).toBe("correct");
    expect(checkIndefinite("-cos(2x)/4", "-cos(x)^2/2", D).status).toBe("correct");
  });

  it("accepts LaTeX pasted straight from a renderer", () => {
    expect(checkIndefinite("\\frac{1}{2}\\ln|x|", "log(abs(x))/2", D).status).toBe("correct");
  });

  it("rejects a wrong antiderivative", () => {
    expect(checkIndefinite("x^2/2", "x^3/3", D).status).toBe("incorrect");
  });

  it("rejects a constant answer", () => {
    expect(checkIndefinite("5", "x^3/3", D).status).toBe("incorrect");
  });

  it("names the dropped constant factor", () => {
    const v = checkIndefinite("sin(2x)", "sin(2x)/2", D);
    expect(v.status).toBe("off-by-constant-factor");
    if (v.status === "off-by-constant-factor") expect(describeFactor(v.factor)).toBe("2");
  });

  it("only calls it a dropped constant when the factor is a plausible one", () => {
    // 274x is not a dropped constant, it is a wrong answer — say so plainly.
    expect(checkIndefinite("274*x^3/3", "x^3/3", D).status).toBe("incorrect");
    expect(checkIndefinite("pi*x^3/3", "x^3/3", D).status).toBe("incorrect");
    expect(checkIndefinite("3*x^3/3", "x^3/3", D).status).toBe("off-by-constant-factor");
  });

  it("flags stray symbols instead of silently failing", () => {
    const v = checkIndefinite("t^3/3", "x^3/3", D);
    expect(v.status).toBe("unparseable");
  });

  it("flags unbalanced brackets", () => {
    expect(checkIndefinite("sin(x", "x^3/3", D).status).toBe("unparseable");
  });
});

describe("checkDefinite", () => {
  it("accepts an exact symbolic value", () => {
    expect(checkDefinite("pi/4", "pi/4").status).toBe("correct");
    expect(checkDefinite("\\frac{\\pi}{4}", "pi/4").status).toBe("correct");
  });

  it("accepts a numerically equal form", () => {
    expect(checkDefinite("0.7853981633974483", "pi/4").status).toBe("correct");
  });

  it("rejects an answer that still contains x", () => {
    const v = checkDefinite("x^2", "pi/4");
    expect(v.status).toBe("unparseable");
  });

  it("rejects a wrong number", () => {
    expect(checkDefinite("pi/2", "pi/4").status).toBe("off-by-constant-factor");
    expect(checkDefinite("1", "0").status).toBe("incorrect");
    expect(checkDefinite("42", "0.153").status).toBe("incorrect");
  });
});

describe("describeFactor", () => {
  it("reports simple rationals", () => {
    expect(describeFactor(0.5)).toBe("1/2");
    expect(describeFactor(2)).toBe("2");
    expect(describeFactor(-1 / 3)).toBe("-1/3");
  });
});
