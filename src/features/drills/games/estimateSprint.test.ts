import { describe, expect, it } from "vitest";
import { estimateSprint } from "./estimateSprint";

function seededRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sampleTag(tag: string, needed: number, seedStart = 1) {
  const out: ReturnType<typeof estimateSprint.generate>[] = [];
  let seed = seedStart;
  while (out.length < needed) {
    const rng = seededRng(seed);
    const level = seed % 6;
    const p = estimateSprint.generate({ level, rng });
    if (p.tag === tag) out.push(p);
    seed++;
  }
  return out;
}

describe("estimateSprint", () => {
  it("every generated answer is a bare integer NumericAnswerInput can accept", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const rng = seededRng(seed);
      const p = estimateSprint.generate({ level: seed % 8, rng });
      expect(p.answer).toMatch(/^-?\d+$/);
    }
  });

  it("sqrt-round: n is never a perfect square, and the answer is round(sqrt(n))", () => {
    for (const p of sampleTag("sqrt-round", 100)) {
      const m = p.prompt.match(/sqrt\{(\d+)\}/);
      expect(m).toBeTruthy();
      const n = Number(m![1]);
      const root = Math.sqrt(n);
      expect(Number.isInteger(root)).toBe(false);
      expect(Number(p.answer)).toBe(Math.round(root));
    }
  });

  it("percent-round: answer matches the rounded value, with no exact halfway tie", () => {
    for (const p of sampleTag("percent-round", 150)) {
      const m = p.prompt.match(/(\d+)% of (\d+), nearest 10\?/);
      expect(m).toBeTruthy();
      const [, pctStr, nStr] = m!;
      const pct = Number(pctStr);
      const n = Number(nStr);
      expect((pct * n) % 1000).not.toBe(500);
      expect(Number(p.answer)).toBe(Math.round((pct * n) / 1000) * 10);
      expect(Number(p.answer) % 10).toBe(0);
    }
  });

  it("product-round: answer matches the rounded product, with no exact halfway tie", () => {
    for (const p of sampleTag("product-round", 150)) {
      const m = p.prompt.match(/(\d+) × (\d+), nearest 100\?/);
      expect(m).toBeTruthy();
      const [, aStr, bStr] = m!;
      const a = Number(aStr);
      const b = Number(bStr);
      expect((a * b) % 100).not.toBe(50);
      expect(Number(p.answer)).toBe(Math.round((a * b) / 100) * 100);
      expect(Number(p.answer) % 100).toBe(0);
    }
  });

  it("division-round: divides unevenly, has no exact halfway tie, and answer is round(a/b)", () => {
    for (const p of sampleTag("division-round", 150)) {
      const m = p.prompt.match(/(\d+) ÷ (\d+), nearest whole number\?/);
      expect(m).toBeTruthy();
      const [, aStr, bStr] = m!;
      const a = Number(aStr);
      const b = Number(bStr);
      expect(a % b).not.toBe(0);
      expect((a % b) * 2).not.toBe(b);
      expect(Number(p.answer)).toBe(Math.round(a / b));
    }
  });

  it("weak-spot bias tags are honored most of the time", () => {
    let matches = 0;
    const trials = 200;
    for (let seed = 1; seed <= trials; seed++) {
      const rng = seededRng(seed * 31 + 7);
      const p = estimateSprint.generate({ level: 0, rng, biasTags: ["sqrt-round"] });
      if (p.tag === "sqrt-round") matches++;
    }
    expect(matches / trials).toBeGreaterThan(0.4);
  });
});
