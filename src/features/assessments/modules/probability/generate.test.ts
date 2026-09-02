import { describe, expect, it } from "vitest";
import { seededRng, shuffle } from "../../engine/rng";
import { defaultCheck } from "../../engine/check";
import { generateChoiceItem } from "./choiceBuilder";
import { PROB_TEMPLATE_LIST, PROB_TEMPLATES } from "./templates";
import { coinAtLeastOneHead, coinExactKHeads } from "./templates/coin";
import { diceSumTwoDice, diceAtLeastOneTarget } from "./templates/dice";
import { cardsConditionalSecondMatch, cardsAtLeastOneAce } from "./templates/cards";
import { bayesBaseRate } from "./templates/bayes";
import { evFairPriceDieBet } from "./templates/ev";
import { comboArrangementsNonAdjacent, comboSelectionAtLeastOne } from "./templates/combinatorics";
import { geometricHHWait, geometricVariance } from "./templates/geometric";
import { orderStatMaxUniform, orderStatMaxDice } from "./templates/orderStats";
import { gamblersRuinBiased, gamblersRuinFair } from "./templates/gamblersRuin";
import { markovAbsorption } from "./templates/markov";
import { birthdayCollisionProb, birthdayExpectedPairs } from "./templates/birthday";
import { varianceSumDice } from "./templates/variance";

/**
 * The bank grades itself — same discipline as src/features/integrals/problems.test.ts.
 *
 * Every template's closed form is checked against an INDEPENDENT computation built from the
 * rendered prompt text alone (parsed back out with its own regex, never by importing the
 * template's formula) plus either:
 *   - Monte Carlo simulation of the actual random process (coin flips, dice rolls, card draws,
 *     a real chain/walk), for templates that describe one, or
 *   - exhaustive brute-force enumeration of the finite outcome space, for templates whose n is
 *     small enough to enumerate exactly (dice-sum, dice-max, and both combinatorics templates) —
 *     stronger than sampling, and used wherever the space is small enough to make it free.
 * Never against a restatement of the same formula.
 *
 * Determinism: every simulation here is driven by `seededRng` with a fixed seed, so a failure
 * reproduces exactly. Tolerances are derived from the sample count (a CLT-based standard-error
 * bound with a generous safety multiplier), not loosened to make a template pass.
 */

// ---------------------------------------------------------------------------------------------
// Simulation helpers (independent of anything in templates/*.ts — these just play out the real
// random process described in the prompt).
// ---------------------------------------------------------------------------------------------

function simulateProportion(trials: number, trial: () => boolean): number {
  let hits = 0;
  for (let t = 0; t < trials; t++) if (trial()) hits++;
  return hits / trials;
}

function simulateMeanVariance(trials: number, trial: () => number): { mean: number; variance: number } {
  let sum = 0;
  let sumSq = 0;
  for (let t = 0; t < trials; t++) {
    const x = trial();
    sum += x;
    sumSq += x * x;
  }
  const mean = sum / trials;
  const variance = Math.max(sumSq / trials - mean * mean, 0);
  return { mean, variance };
}

/** CLT-based tolerance for a proportion estimate, with a generous safety multiplier. */
function proportionTolerance(pEstimate: number, trials: number, sigma = 6): number {
  return sigma * Math.sqrt(Math.max(pEstimate * (1 - pEstimate), 1e-6) / trials) + 1e-4;
}

/** CLT-based tolerance for a sample mean, given the sample variance. */
function meanTolerance(varianceEstimate: number, trials: number, sigma = 6): number {
  return sigma * Math.sqrt(Math.max(varianceEstimate, 1e-6) / trials) + 1e-3;
}

/** CLT-based tolerance for a sample *variance* estimate (rough normal approximation, generous). */
function varianceTolerance(varianceEstimate: number, trials: number, sigma = 8): number {
  return sigma * varianceEstimate * Math.sqrt(2 / trials) + 1e-2;
}

function* permutations<T>(arr: readonly T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield arr.slice();
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) yield [arr[i], ...perm];
  }
}

function* combinations(n: number, k: number): Generator<number[]> {
  if (k > n || k < 0) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.slice();
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

function buildDeck(categorySize: number, total = 52): boolean[] {
  return Array.from({ length: total }, (_, i) => i < categorySize);
}

const dayCount = (label: string): number => (label.includes("months") ? 12 : label.includes("weeks") ? 52 : 365);

// ---------------------------------------------------------------------------------------------
// Generic invariants, applied to every template in the bank.
// ---------------------------------------------------------------------------------------------

describe("probability template bank — generic invariants", () => {
  for (const template of PROB_TEMPLATE_LIST) {
    describe(template.id, () => {
      it("generates valid 4-option and 5-option items across many draws without exhausting retries", () => {
        for (const optionsCount of [4, 5]) {
          const rng = seededRng(1000 + optionsCount);
          for (let i = 0; i < 150; i++) {
            const item = generateChoiceItem(rng, `${template.id}-${i}`, optionsCount, () => template.generate(rng));
            expect(item.choices).toHaveLength(optionsCount);
            const ids = item.choices!.map((c) => c.id);
            const labels = item.choices!.map((c) => c.label);
            expect(new Set(ids).size).toBe(optionsCount);
            expect(new Set(labels).size).toBe(optionsCount);
            expect(ids).toContain(item.answer);
            expect(defaultCheck(item, item.answer)).toBe(true);
          }
        }
      });

      it("shuffles the correct answer's position across draws", () => {
        const rng = seededRng(55);
        const positions = new Set<number>();
        for (let i = 0; i < 60; i++) {
          const item = generateChoiceItem(rng, `${template.id}-pos-${i}`, 4, () => template.generate(rng));
          positions.add(item.choices!.findIndex((c) => c.id === item.answer));
        }
        expect(positions.size, "the correct answer should not always land in the same slot").toBeGreaterThan(1);
      });

      it("is deterministic — the same seed reproduces the same paper", () => {
        const paperPrompts = (seed: number) => {
          const rng = seededRng(seed);
          return Array.from({ length: 20 }, (_, i) =>
            generateChoiceItem(rng, `${template.id}-det-${i}`, 4, () => template.generate(rng)).prompt,
          );
        };
        expect(paperPrompts(909)).toEqual(paperPrompts(909));
      });
    });
  }

  it("registers every template under its own id", () => {
    for (const [key, template] of Object.entries(PROB_TEMPLATES)) {
      expect(template.id).toBe(key);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Per-template closed-form verification.
// ---------------------------------------------------------------------------------------------

describe("coin templates", () => {
  it("coin_at_least_one_head matches simulated fair-coin flips", () => {
    const genRng = seededRng(1);
    for (let draw = 0; draw < 8; draw++) {
      const result = coinAtLeastOneHead.generate(genRng);
      const n = Number(/flipped (\d+) times/.exec(result.prompt)![1]);

      const simRng = seededRng(2000 + draw);
      const trials = 200_000;
      const p = simulateProportion(trials, () => {
        for (let i = 0; i < n; i++) if (simRng() < 0.5) return true;
        return false;
      });
      expect(Math.abs(p - result.correct)).toBeLessThan(proportionTolerance(p, trials));
    }
  });

  it("coin_exact_k_heads matches simulated fair-coin flips", () => {
    const genRng = seededRng(2);
    for (let draw = 0; draw < 8; draw++) {
      const result = coinExactKHeads.generate(genRng);
      const m = /flipped (\d+) times.*exactly (\d+) heads/.exec(result.prompt)!;
      const n = Number(m[1]);
      const k = Number(m[2]);

      const simRng = seededRng(3000 + draw);
      const trials = 300_000;
      const p = simulateProportion(trials, () => {
        let heads = 0;
        for (let i = 0; i < n; i++) if (simRng() < 0.5) heads++;
        return heads === k;
      });
      expect(Math.abs(p - result.correct)).toBeLessThan(proportionTolerance(p, trials));
    }
  });
});

describe("dice templates", () => {
  it("dice_sum_two matches exact enumeration of all 36 outcomes", () => {
    const genRng = seededRng(3);
    for (let draw = 0; draw < 9; draw++) {
      const result = diceSumTwoDice.generate(genRng);
      const s = Number(/sum is (\d+)/.exec(result.prompt)![1]);

      let count = 0;
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) count++;
      const exact = count / 36;
      expect(result.correct).toBeCloseTo(exact, 9);
    }
  });

  it("dice_at_least_one_target matches exact enumeration for small n, simulation otherwise", () => {
    const genRng = seededRng(4);
    for (let draw = 0; draw < 10; draw++) {
      const result = diceAtLeastOneTarget.generate(genRng);
      const n = Number(/^(\d+) fair six-sided dice/.exec(result.prompt)![1]);
      const description = /at least one shows (.+)\?$/.exec(result.prompt)![1];
      const m = (description.match(/\d/g) ?? []).length;
      const threshold = 7 - m; // hits are faces >= threshold

      if (Math.pow(6, n) <= 50_000) {
        // Exact enumeration over all 6^n outcomes.
        const total = Math.pow(6, n);
        let hitCount = 0;
        for (let code = 0; code < total; code++) {
          let rem = code;
          let hit = false;
          for (let d = 0; d < n; d++) {
            const face = (rem % 6) + 1;
            rem = Math.floor(rem / 6);
            if (face >= threshold) hit = true;
          }
          if (hit) hitCount++;
        }
        expect(result.correct).toBeCloseTo(hitCount / total, 9);
      } else {
        const simRng = seededRng(4000 + draw);
        const trials = 200_000;
        const p = simulateProportion(trials, () => {
          let hit = false;
          for (let i = 0; i < n; i++) if (1 + Math.floor(simRng() * 6) >= threshold) hit = true;
          return hit;
        });
        expect(Math.abs(p - result.correct)).toBeLessThan(proportionTolerance(p, trials));
      }
    }
  });
});

describe("card templates", () => {
  it("cards_conditional_second_match matches simulated deals, conditioned via rejection sampling", () => {
    const genRng = seededRng(5);
    for (let draw = 0; draw < 5; draw++) {
      const result = cardsConditionalSecondMatch.generate(genRng);
      const A = Number(/there are (\d+) such cards/.exec(result.prompt)![1]);

      const simRng = seededRng(5000 + draw);
      const targetSuccesses = 30_000;
      let successes = 0;
      let count = 0;
      while (count < targetSuccesses) {
        const deck = shuffle(buildDeck(A), simRng);
        if (deck[0]) {
          count++;
          if (deck[1]) successes++;
        }
      }
      const p = successes / count;
      expect(Math.abs(p - result.correct)).toBeLessThan(proportionTolerance(p, count));
    }
  });

  it("cards_at_least_one_ace matches simulated deals without replacement", () => {
    const genRng = seededRng(6);
    for (let draw = 0; draw < 7; draw++) {
      const result = cardsAtLeastOneAce.generate(genRng);
      const k = Number(/^(\d+) cards are drawn/.exec(result.prompt)![1]);

      const simRng = seededRng(6000 + draw);
      const trials = 60_000;
      const p = simulateProportion(trials, () => shuffle(buildDeck(4), simRng).slice(0, k).some(Boolean));
      expect(Math.abs(p - result.correct)).toBeLessThan(proportionTolerance(p, trials));
    }
  });
});

describe("bayes base-rate template", () => {
  it("matches a simulated screened population", () => {
    const genRng = seededRng(7);
    for (let draw = 0; draw < 6; draw++) {
      const result = bayesBaseRate.generate(genRng);
      const pm = /^([\d.]+)% of a population/.exec(result.prompt)!;
      const sm = /flags a diseased person ([\d.]+)% of the time/.exec(result.prompt)!;
      const fm = /flags a healthy person as positive ([\d.]+)% of the time/.exec(result.prompt)!;
      const prevalence = Number(pm[1]) / 100;
      const sensitivity = Number(sm[1]) / 100;
      const falsePositive = Number(fm[1]) / 100;

      const simRng = seededRng(7000 + draw);
      const population = 400_000;
      let positives = 0;
      let diseasedPositives = 0;
      for (let i = 0; i < population; i++) {
        const diseased = simRng() < prevalence;
        const positive = diseased ? simRng() < sensitivity : simRng() < falsePositive;
        if (positive) {
          positives++;
          if (diseased) diseasedPositives++;
        }
      }
      const p = diseasedPositives / positives;
      expect(Math.abs(p - result.correct)).toBeLessThan(proportionTolerance(p, positives));
    }
  });
});

describe("expected-value / fair-pricing template", () => {
  it("ev_fair_price_die matches the simulated average payout", () => {
    const genRng = seededRng(8);
    for (let draw = 0; draw < 8; draw++) {
      const result = evFairPriceDieBet.generate(genRng);
      const m = /is (\d+) or less, you receive \$(\d+); otherwise, you pay \$(\d+)/.exec(result.prompt)!;
      const k = Number(m[1]);
      const win = Number(m[2]);
      const lose = Number(m[3]);

      const simRng = seededRng(8000 + draw);
      const trials = 300_000;
      const { mean, variance } = simulateMeanVariance(trials, () => {
        const roll = 1 + Math.floor(simRng() * 6);
        return roll <= k ? win : -lose;
      });
      expect(Math.abs(mean - result.correct)).toBeLessThan(meanTolerance(variance, trials));
    }
  });
});

describe("combinatorics templates (exact brute-force enumeration)", () => {
  it("combo_arrangements_non_adjacent matches an exhaustive count over all n! permutations", () => {
    const genRng = seededRng(9);
    for (let draw = 0; draw < 6; draw++) {
      const result = comboArrangementsNonAdjacent.generate(genRng);
      const n = Number(/^(\d+) people/.exec(result.prompt)![1]);

      let notAdjacent = 0;
      for (const perm of permutations(Array.from({ length: n }, (_, i) => i))) {
        const aliceIdx = perm.indexOf(0);
        const bobIdx = perm.indexOf(1);
        if (Math.abs(aliceIdx - bobIdx) !== 1) notAdjacent++;
      }
      expect(result.correct).toBe(notAdjacent);
    }
  });

  it("combo_selection_at_least_one matches an exhaustive count over all C(n,k) committees", () => {
    const genRng = seededRng(10);
    for (let draw = 0; draw < 8; draw++) {
      const result = comboSelectionAtLeastOne.generate(genRng);
      const m = /of (\d+) people is chosen from (\d+) candidates, (\d+) of whom/.exec(result.prompt)!;
      const k = Number(m[1]);
      const n = Number(m[2]);
      const special = Number(m[3]);

      let withSpecial = 0;
      for (const combo of combinations(n, k)) {
        if (combo.some((x) => x < special)) withSpecial++;
      }
      expect(result.correct).toBe(withSpecial);
    }
  });
});

describe("geometric / waiting-time templates", () => {
  it("geometric_hh_wait matches the simulated expected flips to HH", () => {
    const genRng = seededRng(11);
    for (let draw = 0; draw < 8; draw++) {
      const result = geometricHHWait.generate(genRng);
      const label = /probability ([\d/]+)\./.exec(result.prompt)![1];
      const [num, den] = label.split("/").map(Number);
      const p = num / den;

      const simRng = seededRng(11000 + draw);
      const trials = 150_000;
      const { mean, variance } = simulateMeanVariance(trials, () => {
        let flips = 0;
        let lastHead = false;
        for (;;) {
          flips++;
          const head = simRng() < p;
          if (head && lastHead) return flips;
          lastHead = head;
        }
      });
      expect(Math.abs(mean - result.correct)).toBeLessThan(meanTolerance(variance, trials));
    }
  });

  it("geometric_variance matches the simulated variance of flips to first head", () => {
    const genRng = seededRng(12);
    for (let draw = 0; draw < 8; draw++) {
      const result = geometricVariance.generate(genRng);
      const label = /probability ([\d/]+)\./.exec(result.prompt)![1];
      const [num, den] = label.split("/").map(Number);
      const p = num / den;

      const simRng = seededRng(12000 + draw);
      const trials = 250_000;
      const { variance } = simulateMeanVariance(trials, () => {
        let flips = 0;
        for (;;) {
          flips++;
          if (simRng() < p) return flips;
        }
      });
      expect(Math.abs(variance - result.correct)).toBeLessThan(varianceTolerance(variance, trials));
    }
  });
});

describe("order-statistics templates", () => {
  it("order_stat_max_uniform matches the simulated expected max of n Uniform(0,1) draws", () => {
    const genRng = seededRng(13);
    for (let draw = 0; draw < 8; draw++) {
      const result = orderStatMaxUniform.generate(genRng);
      const n = Number(/^(\d+) independent samples/.exec(result.prompt)![1]);

      const simRng = seededRng(13000 + draw);
      const trials = 150_000;
      const { mean, variance } = simulateMeanVariance(trials, () => {
        let max = 0;
        for (let i = 0; i < n; i++) max = Math.max(max, simRng());
        return max;
      });
      expect(Math.abs(mean - result.correct)).toBeLessThan(meanTolerance(variance, trials));
    }
  });

  it("order_stat_max_dice matches an exact enumeration over all 6^n outcomes", () => {
    const genRng = seededRng(14);
    for (let draw = 0; draw < 6; draw++) {
      const result = orderStatMaxDice.generate(genRng);
      const n = Number(/^(\d+) fair six-sided dice are rolled\. What is the expected value of the highest/.exec(result.prompt)![1]);

      const total = Math.pow(6, n);
      let sum = 0;
      for (let code = 0; code < total; code++) {
        let rem = code;
        let max = 0;
        for (let d = 0; d < n; d++) {
          const face = (rem % 6) + 1;
          rem = Math.floor(rem / 6);
          if (face > max) max = face;
        }
        sum += max;
      }
      expect(result.correct).toBeCloseTo(sum / total, 9);
    }
  });
});

describe("gambler's ruin templates", () => {
  it("gamblers_ruin_biased matches a simulated random walk", () => {
    const genRng = seededRng(15);
    for (let draw = 0; draw < 8; draw++) {
      const result = gamblersRuinBiased.generate(genRng);
      const m = /starts with \$(\d+) and repeatedly bets \$1 on a game won with probability ([\d/]+), stopping at \$0 or at \$(\d+)/.exec(
        result.prompt,
      )!;
      const i = Number(m[1]);
      const [num, den] = m[2].split("/").map(Number);
      const p = num / den;
      const N = Number(m[3]);

      const simRng = seededRng(15000 + draw);
      const trials = 40_000;
      const prob = simulateProportion(trials, () => {
        let capital = i;
        while (capital > 0 && capital < N) capital += simRng() < p ? 1 : -1;
        return capital === N;
      });
      expect(Math.abs(prob - result.correct)).toBeLessThan(proportionTolerance(prob, trials));
    }
  });

  it("gamblers_ruin_fair matches a simulated fair random walk", () => {
    const genRng = seededRng(16);
    for (let draw = 0; draw < 8; draw++) {
      const result = gamblersRuinFair.generate(genRng);
      const m = /starts with \$(\d+) and repeatedly bets \$1 on a fair coin flip, stopping at \$0 or at \$(\d+)/.exec(result.prompt)!;
      const i = Number(m[1]);
      const N = Number(m[2]);

      const simRng = seededRng(16000 + draw);
      const trials = 40_000;
      const prob = simulateProportion(trials, () => {
        let capital = i;
        while (capital > 0 && capital < N) capital += simRng() < 0.5 ? 1 : -1;
        return capital === N;
      });
      expect(Math.abs(prob - result.correct)).toBeLessThan(proportionTolerance(prob, trials));
    }
  });
});

describe("absorbing Markov chain template", () => {
  it("markov_absorption matches a simulated run of the chain", () => {
    const genRng = seededRng(17);
    for (let draw = 0; draw < 8; draw++) {
      const result = markovAbsorption.generate(genRng);
      const m =
        /absorbing state A with probability ([\d.]+), to absorbing state B with probability ([\d.]+), and otherwise to transient state T\. From T, it moves to A with probability ([\d.]+), to B with probability ([\d.]+)/.exec(
          result.prompt,
        )!;
      const a = Number(m[1]);
      const b = Number(m[2]);
      const c = Number(m[3]);
      const e = Number(m[4]);

      const simRng = seededRng(17000 + draw);
      const trials = 80_000;
      const prob = simulateProportion(trials, () => {
        let state: "S" | "T" | "A" | "B" = "S";
        while (state === "S" || state === "T") {
          const u = simRng();
          if (state === "S") {
            state = u < a ? "A" : u < a + b ? "B" : "T";
          } else {
            state = u < c ? "A" : u < c + e ? "B" : "T";
          }
        }
        return state === "A";
      });
      expect(Math.abs(prob - result.correct)).toBeLessThan(proportionTolerance(prob, trials));
    }
  });
});

describe("birthday-problem templates", () => {
  it("birthday_collision matches a simulated population of birthdays", () => {
    const genRng = seededRng(18);
    for (let draw = 0; draw < 8; draw++) {
      const result = birthdayCollisionProb.generate(genRng);
      const n = Number(/^(\d+) people are in a room/.exec(result.prompt)![1]);
      const m = dayCount(result.prompt);

      const simRng = seededRng(18000 + draw);
      const trials = 60_000;
      const p = simulateProportion(trials, () => {
        const seen = new Set<number>();
        for (let i = 0; i < n; i++) {
          const day = Math.floor(simRng() * m);
          if (seen.has(day)) return true;
          seen.add(day);
        }
        return false;
      });
      expect(Math.abs(p - result.correct)).toBeLessThan(proportionTolerance(p, trials));
    }
  });

  it("birthday_expected_pairs matches the simulated average number of colliding pairs", () => {
    const genRng = seededRng(19);
    for (let draw = 0; draw < 8; draw++) {
      const result = birthdayExpectedPairs.generate(genRng);
      const n = Number(/^(\d+) people are in a room/.exec(result.prompt)![1]);
      const m = dayCount(result.prompt);

      const simRng = seededRng(19000 + draw);
      const trials = 60_000;
      const { mean, variance } = simulateMeanVariance(trials, () => {
        const freq = new Map<number, number>();
        for (let i = 0; i < n; i++) {
          const day = Math.floor(simRng() * m);
          freq.set(day, (freq.get(day) ?? 0) + 1);
        }
        let pairs = 0;
        for (const c of freq.values()) pairs += (c * (c - 1)) / 2;
        return pairs;
      });
      expect(Math.abs(mean - result.correct)).toBeLessThan(meanTolerance(variance, trials));
    }
  });
});

describe("variance template", () => {
  it("variance_sum_dice matches the simulated variance of a sum of n dice", () => {
    const genRng = seededRng(20);
    for (let draw = 0; draw < 8; draw++) {
      const result = varianceSumDice.generate(genRng);
      const n = Number(/^(\d+) fair six-sided dice are rolled and summed/.exec(result.prompt)![1]);

      const simRng = seededRng(20000 + draw);
      const trials = 200_000;
      const { variance } = simulateMeanVariance(trials, () => {
        let sum = 0;
        for (let i = 0; i < n; i++) sum += 1 + Math.floor(simRng() * 6);
        return sum;
      });
      expect(Math.abs(variance - result.correct)).toBeLessThan(varianceTolerance(variance, trials));
    }
  });
});
