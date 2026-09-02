/**
 * The optimal-quoting benchmark.
 *
 * Defined exactly as the task brief does: "what a player always quoting a tight market centred on
 * the true conditional expectation would have made." Concretely, a market of width `2 * EPSILON`
 * dead-centred on each round's TRUE fair value (not the bot's noisy estimate of it — the candidate
 * doesn't get to see that either).
 *
 * Why this, and not the P&L-MAXIMISING spread: a market maker facing a counterparty whose noise is
 * independent of the true remaining settlement (which is exactly this bot — its noise and the
 * settlement's own unrevealed randomness are drawn from separate points in the rng stream) profits
 * in expectation from ANY positive spread centred on the truth, and profits MORE from a wider one,
 * up to the point fill probability craters. So the raw EV-maximiser is some finite width, not zero
 * — "tight" is not the same claim as "optimal" in that sense. The benchmark here isolates a
 * narrower, more useful thing: the P&L of someone who is never wrong about price, which is exactly
 * the piece of a real market maker's edge that is LUCK (the settlement's own draw) rather than
 * skill. Because the benchmark quotes at (essentially) zero width, its own expected P&L is
 * approximately zero — trades happen only when the bot's noise pushes its estimate across a
 * razor-thin line, and each one prints almost exactly at fair value, so its P&L is realised
 * variance around zero, not a systematic edge. That is what makes `candidatePnl - benchmarkPnl`
 * (scoring.ts's `skillPnl`) the right headline number: it nets out that variance, leaving only
 * P&L attributable to the candidate's OWN quotes being better or worse than the true price. See
 * benchmark.test.ts for the two checks this claim has to survive: a candidate replicating this
 * exact strategy scores near zero against it (self-consistency — the benchmark reproduces what
 * simulating that strategy through the real engine gives), and no naive strategy systematically
 * beats it over many seeds (otherwise the benchmark would not deserve the name "optimal").
 */
import { runGame } from "./engine";
import type { GameInstance, GameResult, Quote } from "./types";

/** Small enough that it never meaningfully changes which side of the bot's estimate a quote falls
 * on relative to a literal zero-width quote, large enough to keep bid < ask a strict, well-defined
 * inequality rather than a floating-point coin flip. */
export const BENCHMARK_EPSILON = 1e-6;

export function benchmarkQuotes(game: GameInstance, epsilon: number = BENCHMARK_EPSILON): Quote[] {
  return game.rounds.map((r) => ({ bid: r.fairValue - epsilon, ask: r.fairValue + epsilon }));
}

export function computeBenchmark(game: GameInstance, epsilon: number = BENCHMARK_EPSILON): GameResult {
  return runGame(game, benchmarkQuotes(game, epsilon));
}
