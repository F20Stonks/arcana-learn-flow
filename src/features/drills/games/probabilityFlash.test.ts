import { describe, expect, it } from "vitest";
import { probabilityFlash } from "./probabilityFlash";

/** Deterministic LCG so each sample is reproducible without depending on Math.random. */
function seededRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bruteDiceCount(cmp: "exactly" | "at least" | "at most", target: number): number {
  let count = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const sum = a + b;
      if (cmp === "exactly" ? sum === target : cmp === "at least" ? sum >= target : sum <= target) count++;
    }
  }
  return count;
}

/** Pascal's-triangle nCr — a genuinely different method from the source's multiplicative formula,
 *  and exact (integer additions only) well past the n this drill ever generates. */
function pascalChoose(n: number, r: number): number {
  const C: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= n; i++) {
    C[i][0] = 1;
    for (let j = 1; j <= i; j++) C[i][j] = C[i - 1][j - 1] + (j <= i - 1 ? C[i - 1][j] : 0);
  }
  return C[n][r] ?? 0;
}

/** Collects `needed` samples of one tag by generating fresh (independently seeded) problems
 *  until enough land on that tag — avoids assuming anything about the internal kind-selection
 *  draw order. */
function sampleTag(tag: string, needed: number, seedStart = 1) {
  const out: ReturnType<typeof probabilityFlash.generate>[] = [];
  let seed = seedStart;
  while (out.length < needed) {
    const rng = seededRng(seed);
    const level = seed % 6;
    const p = probabilityFlash.generate({ level, rng });
    if (p.tag === tag) out.push(p);
    seed++;
  }
  return out;
}

describe("probabilityFlash", () => {
  it("every generated answer is a bare integer NumericAnswerInput can accept", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const rng = seededRng(seed);
      const p = probabilityFlash.generate({ level: seed % 8, rng });
      expect(p.answer).toMatch(/^-?\d+$/);
      expect(Number.isInteger(Number(p.answer))).toBe(true);
    }
  });

  it("dice-sum matches an independently brute-forced count", () => {
    for (const p of sampleTag("dice-sum", 60)) {
      const m = p.prompt.match(/sum to (exactly|at least|at most) (\d+)/);
      expect(m).toBeTruthy();
      const [, cmp, targetStr] = m!;
      expect(Number(p.answer)).toBe(bruteDiceCount(cmp as "exactly" | "at least" | "at most", Number(targetStr)));
    }
  });

  it("ncr matches Pascal's triangle", () => {
    for (const p of sampleTag("ncr", 60)) {
      const m = p.prompt.match(/Ways to choose (\d+) items from (\d+)/);
      expect(m).toBeTruthy();
      const [, rStr, nStr] = m!;
      expect(Number(p.answer)).toBe(pascalChoose(Number(nStr), Number(rStr)));
    }
  });

  it("bayes-freq's natural-frequency counts are internally consistent and every divide is exact", () => {
    for (const p of sampleTag("bayes-freq", 80)) {
      const m = p.prompt.match(
        /1000 people; (\d+) have it\. Test flags (\d+)% of true cases, clears (\d+)% of clean ones\. Of the (\d+) testing positive/,
      );
      expect(m).toBeTruthy();
      const [, affectedStr, sensStr, specStr, totalPosStr] = m!;
      const affected = Number(affectedStr);
      const healthy = 1000 - affected;
      const truePos = (affected * Number(sensStr)) / 100;
      const trueNeg = (healthy * Number(specStr)) / 100;
      expect(Number.isInteger(truePos)).toBe(true);
      expect(Number.isInteger(trueNeg)).toBe(true);
      expect(Number(totalPosStr)).toBe(truePos + (healthy - trueNeg));
      expect(Number(p.answer)).toBe(truePos);
    }
  });

  it("ev-coin's expected value matches (win - lose) / 2 with positive stakes", () => {
    for (const p of sampleTag("ev-coin", 80)) {
      const m = p.prompt.match(/heads win £(-?\d+), tails lose £(-?\d+)/);
      expect(m).toBeTruthy();
      const [, winStr, loseStr] = m!;
      const win = Number(winStr);
      const lose = Number(loseStr);
      expect(win).toBeGreaterThan(0);
      expect(lose).toBeGreaterThan(0);
      expect((win - lose) / 2).toBe(Number(p.answer));
    }
  });

  it("ev-urn's expected value matches winners * payout / total with winners <= total", () => {
    for (const p of sampleTag("ev-urn", 80)) {
      const m = p.prompt.match(/Urn of (\d+) balls: (\d+) pay £(\d+) each/);
      expect(m).toBeTruthy();
      const [, totalStr, winnersStr, payoutStr] = m!;
      const total = Number(totalStr);
      const winners = Number(winnersStr);
      const payout = Number(payoutStr);
      expect(winners).toBeLessThanOrEqual(total);
      const ev = (winners * payout) / total;
      expect(Number.isInteger(ev)).toBe(true);
      expect(ev).toBe(Number(p.answer));
    }
  });

  it("weak-spot bias tags are honored most of the time", () => {
    let matches = 0;
    const trials = 200;
    for (let seed = 1; seed <= trials; seed++) {
      const rng = seededRng(seed * 31 + 7);
      const p = probabilityFlash.generate({ level: 0, rng, biasTags: ["ncr"] });
      if (p.tag === "ncr") matches++;
    }
    // Baseline unbiased rate is 1/5; the 0.7 bias-override roll should push this well above chance.
    expect(matches / trials).toBeGreaterThan(0.4);
  });

  it("config.focusTag pins every generated problem to that one kind", () => {
    for (const tag of ["dice-sum", "ncr", "bayes-freq", "ev-coin", "ev-urn"]) {
      for (let seed = 1; seed <= 40; seed++) {
        const rng = seededRng(seed * 17 + 3);
        const p = probabilityFlash.generate({ level: seed % 6, rng, config: { focusTag: tag } });
        expect(p.tag).toBe(tag);
      }
    }
  });

  it("an unrecognized focusTag falls back to normal random selection instead of throwing", () => {
    const rng = seededRng(99);
    const p = probabilityFlash.generate({ level: 0, rng, config: { focusTag: "not-a-real-tag" } });
    expect(["dice-sum", "ncr", "bayes-freq", "ev-coin", "ev-urn"]).toContain(p.tag);
  });
});
