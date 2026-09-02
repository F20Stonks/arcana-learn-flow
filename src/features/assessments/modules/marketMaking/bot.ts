/**
 * The counterparty bot.
 *
 * This is the whole policy, and it is deliberately this small:
 *
 *   - it has a private fair-value ESTIMATE for the round: the true conditional expectation plus
 *     zero-mean noise (see `estimateNoise`), scaled to the round's remaining standard deviation —
 *     so the bot is right on average, wrong on any given round, and automatically less wrong once
 *     more information has been revealed (less std dev left to be wrong about);
 *   - it LIFTS the ask (buys from the candidate) whenever the ask is strictly below its estimate —
 *     the candidate is offering to sell for less than the bot thinks it's worth;
 *   - it HITS the bid (sells to the candidate) whenever the bid is strictly above its estimate —
 *     the candidate is offering to pay more than the bot thinks it's worth;
 *   - otherwise it PASSES — the quote brackets its estimate, so neither side looks like value.
 *   - every fill is the SAME fixed size: the bot never sizes up on a fat pitch or down on a thin
 *     one, so a candidate who keeps getting picked off accumulates inventory linearly rather than
 *     the bot doing something adaptive that would muddy what "picked off" means.
 *
 * Both `bid < estimate` and `ask > estimate` cannot be true at once for a valid (bid < ask)
 * market, so there's no ordering question between the two checks — see `decide`'s tests for the
 * boundary cases.
 *
 * Nothing here calls Math.random. `estimateNoise` takes rng from the same seeded thread as
 * everything else in engine.ts's `buildGame`, so the whole game — bot included — reproduces
 * exactly from its seed.
 */
import type { BotConfig, Quote } from "./types";
import { ZERO_STD_EPS } from "./contracts";

/** One standard-normal draw via Box-Muller, consuming exactly two rng() calls. u1 is floored away
 * from 0 because rng() can return exactly 0 and log(0) is -Infinity. */
export function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * The bot's private fair-value estimate for one round. Unbiased (E[estimate] = trueFairValue) but
 * never exact — that's the whole point of the noise term. Scaling by `stdDev` (floored so a fully-
 * resolved round, stdDev 0, still gets a hair of noise rather than becoming a literal oracle) means
 * the bot's imprecision shrinks in step with the candidate's own remaining uncertainty: it isn't
 * "10% wrong" on a coin flip and "10% wrong" on a near-certainty in the same absolute terms.
 */
export function estimateFairValue(trueFairValue: number, stdDev: number, config: BotConfig, rng: () => number): number {
  const scale = config.noiseFraction * Math.max(stdDev, ZERO_STD_EPS);
  return trueFairValue + gaussian(rng) * scale;
}

export type BotDecision =
  | { action: "lift"; price: number }
  | { action: "hit"; price: number }
  | { action: "pass" };

/**
 * Pure trade decision: no rng here at all. `estimate` is precomputed once per round (see
 * engine.ts's `buildGame`) precisely so this function — the actual policy — can be tested and
 * reasoned about with plain numbers, and so the benchmark can replay the identical decision
 * against a different quote without re-drawing noise.
 */
export function decide(quote: Quote, estimate: number): BotDecision {
  if (quote.ask < estimate) return { action: "lift", price: quote.ask };
  if (quote.bid > estimate) return { action: "hit", price: quote.bid };
  return { action: "pass" };
}

export const DEFAULT_BOT_CONFIG: BotConfig = { noiseFraction: 0.4, size: 1 };
