import { describe, expect, it } from "vitest";
import katex from "katex";
import { normalizeGlyphs, segments, toMathMode } from "./mathText";
import { PROBLEMS } from "./problems";
import { TECHNIQUES } from "./techniques";

const renders = (s: string) => {
  // strict:"error" turns KaTeX's warnings (stray unicode, bad spacing) into failures too.
  katex.renderToString(toMathMode(s), { throwOnError: true, strict: "error", displayMode: false });
  return true;
};

describe("toMathMode", () => {
  it("leaves pure math alone", () => {
    expect(toMathMode("\\int x^n\\,dx = \\frac{x^{n+1}}{n+1}")).toBe(
      "\\int x^n\\,dx = \\frac{x^{n+1}}{n+1}",
    );
  });

  it("wraps a whole sentence of prose", () => {
    expect(toMathMode("Read your derivative table backwards.")).toBe(
      "\\text{Read your derivative table backwards.}",
    );
  });

  it("keeps differentials and short algebra as math", () => {
    expect(toMathMode("\\int u\\,dv = uv - \\int v\\,du.")).toBe("\\int u\\,dv = uv - \\int v\\,du.");
  });

  it("splits a mixed line", () => {
    expect(toMathMode("Put x = 0: A = 1.")).toBe("\\text{Put }x = 0: A = 1.");
  });

  it("treats two-letter English words as prose but dx as math", () => {
    expect(toMathMode("so \\int dx = x")).toBe("\\text{so }\\int dx = x");
  });

  it("does not re-wrap an existing \\text block", () => {
    const out = toMathMode("\\int_{-a}^{a} (\\text{odd})\\,dx = 0.");
    expect(out).toBe("\\int_{-a}^{a} (\\text{odd})\\,dx = 0.");
  });

  it("absorbs an em dash into the following prose", () => {
    expect(toMathMode("x + C — note the four.")).toBe("x + C\\text{ — note the four.}");
  });

  it("keeps a number inside a sentence but leaves a coefficient in math", () => {
    expect(toMathMode("note the 4, from integrating \\cos 2x")).toBe(
      "\\text{note the 4, from integrating }\\cos 2x",
    );
    expect(toMathMode("so 3A = 8")).toBe("\\text{so }3A = 8");
  });

  it("does not swallow a minus sign", () => {
    expect(toMathMode("x - 1 is positive")).toContain("x - 1");
    expect(toMathMode("2x - y so done")).toContain("2x - y");
  });

  it("keeps a real hyphen inside the prose", () => {
    // A dash between two letters is a hyphen; the same character between terms is subtraction.
    // A lone "a" stays math — it really is a variable everywhere else in this material.
    expect(toMathMode("a half-integer power")).toBe("a\\text{ half-integer power}");
    expect(toMathMode("Back-substitute with x")).toBe("\\text{Back-substitute with }x");
    expect(toMathMode("a plain u-substitution works")).toBe("a\\text{ plain }u\\text{-substitution works}");
  });
});

describe("segments", () => {
  it("alternates prose and math so a paragraph can wrap", () => {
    expect(segments("Put x = 0: A = 1.")).toEqual([
      { type: "text", value: "Put " },
      { type: "math", value: "x = 0: A = 1." },
    ]);
  });

  it("returns one math run for a pure formula", () => {
    expect(segments("\\frac{x}{2}")).toEqual([{ type: "math", value: "\\frac{x}{2}" }]);
  });

  it("round-trips to the same string toMathMode produces", () => {
    for (const p of PROBLEMS) {
      for (const step of p.steps) {
        const joined = segments(step)
          .map((s) => s.value)
          .join("");
        expect(joined).toBe(normalizeGlyphs(step));
      }
    }
  });
});

describe("everything in the bank renders", () => {
  it.each(PROBLEMS.map((p) => [p.id, p] as const))("%s", (_id, p) => {
    expect(renders(p.integrand)).toBe(true);
    expect(renders(p.answerLatex)).toBe(true);
    if (p.lower) expect(renders(p.lower)).toBe(true);
    if (p.upper) expect(renders(p.upper)).toBe(true);
    for (const h of p.hints) expect(renders(h)).toBe(true);
    for (const s of p.steps) expect(renders(s)).toBe(true);
  });
});

describe("everything in the curriculum renders", () => {
  it.each(TECHNIQUES.map((t) => [t.id, t] as const))("%s", (_id, t) => {
    expect(renders(t.whenToUse)).toBe(true);
    for (const r of t.recipe) expect(renders(r)).toBe(true);
    for (const w of t.example.work) expect(renders(w)).toBe(true);
    for (const p of t.pitfalls) expect(renders(p)).toBe(true);
    expect(renders(t.example.integrand)).toBe(true);
    expect(renders(t.example.result)).toBe(true);
  });
});
