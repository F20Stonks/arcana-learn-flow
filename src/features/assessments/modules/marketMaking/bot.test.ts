import { describe, expect, it } from "vitest";
import { seededRng } from "../../engine/rng";
import { decide, estimateFairValue, gaussian, DEFAULT_BOT_CONFIG } from "./bot";

describe("decide (the trade policy)", () => {
  it("lifts a too-low ask", () => {
    // estimate = 50, ask = 40 < 50 → the candidate is giving away value.
    expect(decide({ bid: 30, ask: 40 }, 50)).toEqual({ action: "lift", price: 40 });
  });

  it("hits a too-high bid", () => {
    expect(decide({ bid: 60, ask: 70 }, 50)).toEqual({ action: "hit", price: 60 });
  });

  it("does neither on a fair, tight market that brackets the estimate", () => {
    expect(decide({ bid: 49, ask: 51 }, 50)).toEqual({ action: "pass" });
  });

  it("passes on the exact boundary — a quote touching the estimate is not mispriced", () => {
    // Strict inequality both ways: ask === estimate is not "below" it.
    expect(decide({ bid: 40, ask: 50 }, 50)).toEqual({ action: "pass" });
    expect(decide({ bid: 50, ask: 60 }, 50)).toEqual({ action: "pass" });
  });

  it("never satisfies both conditions for a valid (bid < ask) market", () => {
    // If ask < estimate < bid were both true, ask < estimate < bid would force ask < bid to fail
    // the other way — i.e. it's algebraically impossible for a non-crossed market, but assert it
    // directly across a spread of estimates as a guard against a future refactor breaking that.
    for (let estimate = 0; estimate <= 100; estimate += 1) {
      const bid = estimate - 0.001;
      const ask = estimate + 0.001;
      const d = decide({ bid, ask }, estimate);
      expect(d.action).toBe("pass");
    }
  });
});

describe("gaussian", () => {
  it("is deterministic given a seed", () => {
    const a = gaussian(seededRng(42));
    const b = gaussian(seededRng(42));
    expect(a).toBe(b);
  });

  it("is approximately standard normal over many draws", () => {
    const rng = seededRng(7);
    const n = 20000;
    const draws = Array.from({ length: n }, () => gaussian(rng));
    const mean = draws.reduce((a, b) => a + b, 0) / n;
    const variance = draws.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    expect(mean).toBeGreaterThan(-0.05);
    expect(mean).toBeLessThan(0.05);
    expect(variance).toBeGreaterThan(0.9);
    expect(variance).toBeLessThan(1.1);
  });
});

describe("estimateFairValue", () => {
  it("is deterministic given a seed", () => {
    const a = estimateFairValue(50, 5, DEFAULT_BOT_CONFIG, seededRng(123));
    const b = estimateFairValue(50, 5, DEFAULT_BOT_CONFIG, seededRng(123));
    expect(a).toBe(b);
  });

  it("is unbiased: mean estimate over many draws is close to the true fair value", () => {
    const rng = seededRng(99);
    const n = 20000;
    const draws = Array.from({ length: n }, () => estimateFairValue(50, 5, DEFAULT_BOT_CONFIG, rng));
    const mean = draws.reduce((a, b) => a + b, 0) / n;
    expect(mean).toBeGreaterThan(49.8);
    expect(mean).toBeLessThan(50.2);
  });

  it("is not exact — it is not a perfect oracle", () => {
    const rng = seededRng(11);
    const draws = Array.from({ length: 50 }, () => estimateFairValue(50, 5, DEFAULT_BOT_CONFIG, rng));
    expect(draws.some((d) => d !== 50)).toBe(true);
  });

  it("shrinks its noise as stdDev shrinks — less uncertainty, less room to be wrong", () => {
    const wideRng = seededRng(1);
    const narrowRng = seededRng(1);
    const wide = Array.from({ length: 5000 }, () => estimateFairValue(50, 10, DEFAULT_BOT_CONFIG, wideRng));
    const narrow = Array.from({ length: 5000 }, () => estimateFairValue(50, 0.5, DEFAULT_BOT_CONFIG, narrowRng));
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(spread(narrow)).toBeLessThan(spread(wide));
  });
});
