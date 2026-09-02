/**
 * Settlement distributions and their reveal schedules.
 *
 * Each contract answers three questions deterministically from a seeded rng: what does the
 * candidate see up front (`description`), what does it actually settle at (`settlement`, hidden
 * until the debrief), and what is the TRUE conditional expectation and standard deviation after
 * each piece of information is revealed (`rounds`). The candidate is expected to derive
 * `fairValue` themselves from `description` + `revealText` — this module computes it only so the
 * bot and the scorer have something to grade against; it is never rendered directly.
 *
 * The load-bearing property every contract here has to satisfy is that `fairValue` is a
 * martingale in round index: E[fairValue_{r+1} | fairValue_r] = fairValue_r. That's what makes
 * "trade at exactly fairValue every round" have zero expected P&L (see benchmark.ts) and what
 * makes a fill's hindsight P&L unbiased regardless of what happens in later rounds. contracts.test
 * .ts checks the unconditional settlement mean by simulation rather than trusting this comment.
 */
import { randInt, shuffle } from "../../engine/rng";
import type {
  BinomialHeadsConfig,
  CardDrawConfig,
  CoinBinaryConfig,
  ContractConfig,
  DiceSumConfig,
  RoundState,
} from "./types";

/** Below this, a round's remaining uncertainty is treated as exactly zero (fully resolved). */
export const ZERO_STD_EPS = 1e-9;

export interface ContractDraw {
  description: string;
  settlement: number;
  /** Rounds without `estimate` — engine.ts's `buildGame` adds that once it has the bot's rng
   * draws, so contract sampling and bot noise stay on one deterministic thread in a fixed order. */
  rounds: Omit<RoundState, "estimate">[];
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: readonly number[]): number => {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
};

function drawDiceSum(config: DiceSumConfig, rng: () => number): ContractDraw {
  const { diceCount: n, sides } = config;
  const dice = Array.from({ length: n }, () => randInt(1, sides, rng));
  const settlement = dice.reduce((a, b) => a + b, 0);
  const dieMean = (sides + 1) / 2;
  const dieVar = (sides * sides - 1) / 12;
  // Revealed one at a time, in a random order independent of the values themselves — the k-th
  // revealed die is therefore a uniform random draw from the n iid dice, with the same marginal
  // mean and variance as any single die. That independence from the values is what keeps the
  // reveal from leaking more than it says: revealing n-1 dice does not hand over the nth for free,
  // since the total sum is never disclosed mid-game.
  const order = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng,
  );

  const rounds: Omit<RoundState, "estimate">[] = [
    { round: 0, fairValue: n * dieMean, stdDev: Math.sqrt(n * dieVar), revealText: null },
  ];
  let revealedSum = 0;
  for (let i = 0; i < n; i++) {
    const dieIndex = order[i];
    revealedSum += dice[dieIndex];
    const remaining = n - (i + 1);
    rounds.push({
      round: i + 1,
      fairValue: revealedSum + remaining * dieMean,
      stdDev: Math.sqrt(remaining * dieVar),
      revealText: `Die #${dieIndex + 1} shows ${dice[dieIndex]}.`,
    });
  }

  return {
    description: `The settlement value is the sum of ${n} fair ${sides}-sided dice.`,
    settlement,
    rounds,
  };
}

function drawBinomialHeads(config: BinomialHeadsConfig, rng: () => number): ContractDraw {
  const { flips: n, headsProb: p } = config;
  const results = Array.from({ length: n }, () => (rng() < p ? 1 : 0));
  const settlement = results.reduce((a, b) => a + b, 0);
  const flipVar = p * (1 - p);
  const order = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng,
  );

  const rounds: Omit<RoundState, "estimate">[] = [
    { round: 0, fairValue: n * p, stdDev: Math.sqrt(n * flipVar), revealText: null },
  ];
  let revealedHeads = 0;
  for (let i = 0; i < n; i++) {
    const flipIndex = order[i];
    const heads = results[flipIndex] === 1;
    revealedHeads += heads ? 1 : 0;
    const remaining = n - (i + 1);
    rounds.push({
      round: i + 1,
      fairValue: revealedHeads + remaining * p,
      stdDev: Math.sqrt(remaining * flipVar),
      revealText: `Flip #${flipIndex + 1} was ${heads ? "heads" : "tails"}.`,
    });
  }

  return {
    description: `Settlement is the number of heads in ${n} coin flips (P(heads) = ${p}).`,
    settlement,
    rounds,
  };
}

function drawCoinBinary(config: CoinBinaryConfig, rng: () => number): ContractDraw {
  const { headsProb: p, payoffHigh, payoffLow, rounds: roundCount } = config;
  const isHigh = rng() < p;
  const settlement = isHigh ? payoffHigh : payoffLow;
  const fairValue = p * payoffHigh + (1 - p) * payoffLow;
  const stdDev = Math.abs(payoffHigh - payoffLow) * Math.sqrt(p * (1 - p));

  // No information is revealed for this contract — it's the atomic case (a single coin flip has
  // nothing to partially reveal short of the answer itself). The fair value is constant across
  // every round, which makes it the cleanest baseline for testing the bot's core lift/hit logic in
  // isolation from any information dynamics.
  const rounds: Omit<RoundState, "estimate">[] = Array.from({ length: roundCount }, (_, i) => ({
    round: i,
    fairValue,
    stdDev,
    revealText: i === 0 ? null : "No new information — the settlement is still undetermined.",
  }));

  return {
    description: `A coin lands heads with probability ${p}. Settlement is ${payoffHigh} on heads, ${payoffLow} on tails.`,
    settlement,
    rounds,
  };
}

function drawCardDraw(config: CardDrawConfig, rng: () => number): ContractDraw {
  const { deckSize: m, maxReveals } = config;
  const trueCard = randInt(1, m, rng);
  const others = Array.from({ length: m }, (_, i) => i + 1).filter((v) => v !== trueCard);
  // Eliminations are drawn uniformly from the WRONG candidates only — never the true card — which
  // is exactly the Monty-Hall-shaped update: conditioned on "these specific values are wrong", the
  // posterior over the remaining values (true card included) stays uniform over what's left, so
  // "mean of the remaining set" is the exact conditional expectation, not an approximation.
  const eliminationOrder = shuffle(others, rng).slice(0, Math.min(maxReveals, others.length));

  let remaining = Array.from({ length: m }, (_, i) => i + 1);
  const rounds: Omit<RoundState, "estimate">[] = [
    { round: 0, fairValue: mean(remaining), stdDev: Math.sqrt(variance(remaining)), revealText: null },
  ];
  for (let i = 0; i < eliminationOrder.length; i++) {
    const eliminated = eliminationOrder[i];
    remaining = remaining.filter((v) => v !== eliminated);
    rounds.push({
      round: i + 1,
      fairValue: mean(remaining),
      stdDev: Math.sqrt(variance(remaining)),
      revealText: `The card is not a ${eliminated}.`,
    });
  }

  return {
    description: `A single card numbered 1-${m} is drawn from a shuffled deck. Settlement is its number.`,
    settlement: trueCard,
    rounds,
  };
}

export function drawContract(config: ContractConfig, rng: () => number): ContractDraw {
  switch (config.kind) {
    case "dice-sum":
      return drawDiceSum(config, rng);
    case "binomial-heads":
      return drawBinomialHeads(config, rng);
    case "coin-binary":
      return drawCoinBinary(config, rng);
    case "card-draw":
      return drawCardDraw(config, rng);
  }
}

/** Closed-form E[settlement] for each contract — contracts.test.ts checks these against a Monte
 * Carlo simulation of `drawContract`, not the other way around. */
export function theoreticalMean(config: ContractConfig): number {
  switch (config.kind) {
    case "dice-sum":
      return config.diceCount * ((config.sides + 1) / 2);
    case "binomial-heads":
      return config.flips * config.headsProb;
    case "coin-binary":
      return config.headsProb * config.payoffHigh + (1 - config.headsProb) * config.payoffLow;
    case "card-draw":
      return (1 + config.deckSize) / 2;
  }
}

export const DICE_SUM_3: DiceSumConfig = { kind: "dice-sum", diceCount: 3, sides: 6 };
export const COIN_FAIR: CoinBinaryConfig = {
  kind: "coin-binary",
  headsProb: 0.5,
  payoffHigh: 100,
  payoffLow: 0,
  rounds: 4,
};
export const BINOMIAL_5: BinomialHeadsConfig = { kind: "binomial-heads", flips: 5, headsProb: 0.5 };
export const CARD_DRAW_8: CardDrawConfig = { kind: "card-draw", deckSize: 8, maxReveals: 6 };
