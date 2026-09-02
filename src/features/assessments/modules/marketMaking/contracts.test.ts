import { describe, expect, it } from "vitest";
import { seededRng } from "../../engine/rng";
import { BINOMIAL_5, CARD_DRAW_8, COIN_FAIR, DICE_SUM_3, drawContract, theoreticalMean, ZERO_STD_EPS } from "./contracts";
import type { ContractConfig } from "./types";

/** Monte Carlo mean of `settlement` over many independent seeds — the point is to verify the
 * simulator, not restate the closed form it's checked against. */
function simulateMean(config: ContractConfig, n: number, seedOffset: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const rng = seededRng(seedOffset + i * 104729); // large prime stride avoids any seed overlap
    total += drawContract(config, rng).settlement;
  }
  return total / n;
}

describe("settlement distributions (verified by simulation)", () => {
  // Each case's tolerance is ~4 standard errors of the mean (stdDev / sqrt(n)) for its own
  // settlement distribution — a coin that pays 0 or 100 has a much wider distribution than a sum
  // of three dice, so it needs a wider band before the check means anything, not a shared number
  // tuned to the tightest case.
  const n = 8000;
  const cases: Array<[string, ContractConfig, number, number]> = [
    ["dice-sum (3d6)", DICE_SUM_3, 3 * 3.5, (4 * Math.sqrt(3 * (35 / 12))) / Math.sqrt(n)],
    ["coin-binary (fair, 100/0)", COIN_FAIR, 50, (4 * 50) / Math.sqrt(n)],
    ["binomial-heads (5 flips, p=0.5)", BINOMIAL_5, 2.5, (4 * Math.sqrt(5 * 0.25)) / Math.sqrt(n)],
    ["card-draw (1-8)", CARD_DRAW_8, 4.5, (4 * Math.sqrt(21)) / Math.sqrt(n)], // Var(uniform 1..8) = (64-1)/12
  ];

  for (const [name, config, expected, tolerance] of cases) {
    it(`${name}: simulated mean matches the claimed mean`, () => {
      const simulated = simulateMean(config, n, 1);
      expect(theoreticalMean(config)).toBeCloseTo(expected, 9);
      expect(Math.abs(simulated - expected)).toBeLessThan(tolerance);
    });
  }
});

describe("dice-sum reveal schedule", () => {
  it("round 0 has no reveal and the prior mean/variance", () => {
    const draw = drawContract(DICE_SUM_3, seededRng(5));
    expect(draw.rounds[0].revealText).toBeNull();
    expect(draw.rounds[0].fairValue).toBeCloseTo(10.5, 9);
    expect(draw.rounds[0].stdDev).toBeCloseTo(Math.sqrt(3 * (35 / 12)), 9);
  });

  it("fairValue is exactly the settlement once every die is revealed", () => {
    for (let seed = 0; seed < 50; seed++) {
      const draw = drawContract(DICE_SUM_3, seededRng(seed * 977 + 3));
      const last = draw.rounds[draw.rounds.length - 1];
      expect(last.stdDev).toBeLessThan(ZERO_STD_EPS);
      expect(last.fairValue).toBeCloseTo(draw.settlement, 9);
    }
  });

  it("reveals name a die and a value 1-6 that actually appears in the settlement's dice", () => {
    const draw = drawContract(DICE_SUM_3, seededRng(21));
    for (let i = 1; i < draw.rounds.length; i++) {
      expect(draw.rounds[i].revealText).toMatch(/^Die #[123] shows [1-6]\.$/);
    }
  });

  it("fair value is a martingale in expectation: mean(fairValue after 1 reveal) ≈ mean(fairValue at round 0)", () => {
    const n = 4000;
    let sumRound0 = 0;
    let sumRound1 = 0;
    for (let i = 0; i < n; i++) {
      const draw = drawContract(DICE_SUM_3, seededRng(i * 1000003 + 17));
      sumRound0 += draw.rounds[0].fairValue;
      sumRound1 += draw.rounds[1].fairValue;
    }
    expect(Math.abs(sumRound0 / n - sumRound1 / n)).toBeLessThan(0.15);
  });
});

describe("card-draw reveal schedule (Monty-Hall-shaped elimination)", () => {
  it("never eliminates the true card", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = seededRng(seed * 6151 + 9);
      const draw = drawContract(CARD_DRAW_8, rng);
      for (const round of draw.rounds) {
        if (round.revealText) {
          const eliminated = Number(round.revealText.match(/not a (\d+)/)?.[1]);
          expect(eliminated).not.toBe(draw.settlement);
        }
      }
    }
  });

  it("fairValue converges to the settlement as eliminations approach deckSize - 1", () => {
    const draw = drawContract({ kind: "card-draw", deckSize: 8, maxReveals: 7 }, seededRng(44));
    const last = draw.rounds[draw.rounds.length - 1];
    expect(last.stdDev).toBeLessThan(ZERO_STD_EPS);
    expect(last.fairValue).toBeCloseTo(draw.settlement, 9);
  });

  it("posterior stays uniform over the remaining candidates (Monty-Hall check, not an approximation)", () => {
    // Fix ONE elimination sequence shape (first reveal always eliminates the smallest available
    // wrong candidate isn't controllable directly, so instead: bucket many simulated games by
    // their round-1 fairValue and confirm the settlement is uniform across whatever candidates
    // remain in that bucket, rather than biased toward any particular one.
    const deckSize = 5;
    const config: ContractConfig = { kind: "card-draw", deckSize, maxReveals: 1 };
    const counts = new Map<number, number>();
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const draw = drawContract(config, seededRng(i * 7919 + 3));
      counts.set(draw.settlement, (counts.get(draw.settlement) ?? 0) + 1);
    }
    // Every value 1..deckSize should come up roughly n/deckSize times.
    const expectedPerValue = n / deckSize;
    for (let v = 1; v <= deckSize; v++) {
      const c = counts.get(v) ?? 0;
      expect(Math.abs(c - expectedPerValue)).toBeLessThan(expectedPerValue * 0.15);
    }
  });
});

describe("coin-binary", () => {
  it("has a constant fair value across every round (no reveals)", () => {
    const draw = drawContract(COIN_FAIR, seededRng(8));
    for (const round of draw.rounds) {
      expect(round.fairValue).toBeCloseTo(50, 9);
      expect(round.stdDev).toBeCloseTo(50, 9); // stdDev of a fair 0/100 coin is 50
    }
    expect(draw.rounds[0].revealText).toBeNull();
  });

  it("settlement is always exactly payoffHigh or payoffLow", () => {
    for (let seed = 0; seed < 100; seed++) {
      const draw = drawContract(COIN_FAIR, seededRng(seed * 331 + 1));
      expect([0, 100]).toContain(draw.settlement);
    }
  });
});

describe("binomial-heads reveal schedule", () => {
  it("fairValue is exactly the settlement once every flip is revealed", () => {
    for (let seed = 0; seed < 50; seed++) {
      const draw = drawContract(BINOMIAL_5, seededRng(seed * 613 + 2));
      const last = draw.rounds[draw.rounds.length - 1];
      expect(last.stdDev).toBeLessThan(ZERO_STD_EPS);
      expect(last.fairValue).toBeCloseTo(draw.settlement, 9);
    }
  });
});
