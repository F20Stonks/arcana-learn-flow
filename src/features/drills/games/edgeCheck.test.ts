import { describe, expect, it } from "vitest";
import { edgeCheck } from "./edgeCheck";

function seededRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("edgeCheck", () => {
  it("answer matches the sign of the EV computed from the prompt's own numbers", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const rng = seededRng(seed);
      const p = edgeCheck.generate({ level: seed % 8, rng });
      const m = p.prompt.match(/Win £(\d+) with probability (\d+)\/(\d+), otherwise lose £(\d+)/);
      expect(m).toBeTruthy();
      const [, winStr, kStr, nStr, loseStr] = m!;
      const win = Number(winStr);
      const k = Number(kStr);
      const n = Number(nStr);
      const lose = Number(loseStr);
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThan(n);
      const evNumer = k * win - (n - k) * lose;
      expect(evNumer).not.toBe(0);
      const expected = evNumer > 0 ? "take" : "pass";
      expect(p.answer).toBe(expected);
      expect(p.tag).toBe(expected);
      expect(["take", "pass"]).toContain(p.answer);
    }
  });

  it("answer always matches one of the drill's own binaryOptions values", () => {
    const values = edgeCheck.binaryOptions!.map((o) => o.value);
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seededRng(seed * 13 + 5);
      const p = edgeCheck.generate({ level: 0, rng });
      expect(values).toContain(p.answer);
    }
  });

  it("weak-spot bias toward a specific call is honored most of the time", () => {
    let matches = 0;
    const trials = 200;
    for (let seed = 1; seed <= trials; seed++) {
      const rng = seededRng(seed * 31 + 7);
      const p = edgeCheck.generate({ level: 0, rng, biasTags: ["pass"] });
      if (p.answer === "pass") matches++;
    }
    expect(matches / trials).toBeGreaterThan(0.4);
  });
});
