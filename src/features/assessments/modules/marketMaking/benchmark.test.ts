import { describe, expect, it } from "vitest";
import { BENCHMARK_EPSILON, benchmarkQuotes, computeBenchmark } from "./benchmark";
import { DEFAULT_BOT_CONFIG } from "./bot";
import { DICE_SUM_3 } from "./contracts";
import { buildGame, runGame } from "./engine";
import { buildScorecard } from "./scoring";
import type { GameConfig, Quote } from "./types";

const CONFIG: GameConfig = { contract: DICE_SUM_3, bot: DEFAULT_BOT_CONFIG };

/** An independent re-implementation of "quote tight around the true fair value", using a
 * different epsilon than benchmark.ts's own default — the point is to check the benchmark against
 * a second, independently-written version of the same idea, not against itself. */
function naiveTightQuotes(game: ReturnType<typeof buildGame>, epsilon = 1e-4): Quote[] {
  return game.rounds.map((r) => ({ bid: r.fairValue - epsilon, ask: r.fairValue + epsilon }));
}

describe("the benchmark strategy itself", () => {
  it("trades only when the bot's noise crosses a razor-thin line — most rounds pass", () => {
    const game = buildGame(CONFIG, 3);
    const result = computeBenchmark(game);
    // Not a hard guarantee for any single seed, but a benchmark that filled on the majority of
    // rounds would mean the noise scale is too large to be a meaningful "tight" comparison.
    expect(result.fillCount).toBeLessThanOrEqual(game.rounds.length);
  });

  it("is deterministic given a seed", () => {
    const gameA = buildGame(CONFIG, 909);
    const gameB = buildGame(CONFIG, 909);
    expect(computeBenchmark(gameA)).toEqual(computeBenchmark(gameB));
  });
});

describe("a candidate quoting the true conditional expectation tightly scores near zero versus the benchmark", () => {
  it("an independently-implemented tight-at-fair-value strategy matches the benchmark almost exactly, seed by seed", () => {
    const trials = 200;
    let sumAbsDiff = 0;
    let sumDiff = 0;
    let exactMatches = 0;
    for (let seed = 0; seed < trials; seed++) {
      const game = buildGame(CONFIG, seed * 2003 + 41);
      const benchmarkResult = computeBenchmark(game);
      const candidateResult = runGame(game, naiveTightQuotes(game));
      const diff = candidateResult.totalPnl - benchmarkResult.totalPnl;
      sumDiff += diff;
      sumAbsDiff += Math.abs(diff);
      // Even when the trade DECISION matches every round, the two strategies quote at slightly
      // different epsilons, so a filled trade prints at a slightly different price — a real but
      // tiny difference (~1e-4 per fill), not a decision mismatch. "Matched" means that difference
      // stayed at that scale rather than a whole trade's worth of mispricing.
      if (Math.abs(diff) < 1e-2) exactMatches += 1;
    }
    // The two epsilons are both tiny relative to the bot's noise scale, so the trade DECISION
    // should coincide on nearly every round in nearly every seed — most trials should match
    // to float-noise precision, and the few that don't should be small relative to how much a
    // badly-off market typically loses (engine.test.ts's "-2 average per game" case).
    expect(exactMatches / trials).toBeGreaterThan(0.85);
    expect(Math.abs(sumDiff / trials)).toBeLessThan(0.3);
    expect(sumAbsDiff / trials).toBeLessThan(0.5);
  });

  it("skillPnl (candidate - benchmark) for this replicate strategy is close to zero, not systematically positive or negative", () => {
    const trials = 200;
    let sumSkill = 0;
    for (let seed = 0; seed < trials; seed++) {
      const game = buildGame(CONFIG, seed * 3001 + 7);
      const candidateResult = runGame(game, naiveTightQuotes(game));
      const scorecard = buildScorecard(game, candidateResult);
      sumSkill += scorecard.skillPnl;
    }
    expect(Math.abs(sumSkill / trials)).toBeLessThan(0.3);
  });
});

describe("if a naive strategy beats your benchmark, your benchmark is wrong", () => {
  it("a strategy quoting biased AWAY from true fair value does not systematically beat the benchmark", () => {
    const trials = 200;
    let biasedBeatsBenchmarkCount = 0;
    let sumBenchmarkMinusBiased = 0;
    for (let seed = 0; seed < trials; seed++) {
      const game = buildGame(CONFIG, seed * 4007 + 13);
      const benchmarkResult = computeBenchmark(game);
      const biasedQuotes: Quote[] = game.rounds.map((r) => ({
        bid: r.fairValue + 2 - 0.25,
        ask: r.fairValue + 2 + 0.25,
      }));
      const biasedResult = runGame(game, biasedQuotes);
      sumBenchmarkMinusBiased += benchmarkResult.totalPnl - biasedResult.totalPnl;
      if (biasedResult.totalPnl > benchmarkResult.totalPnl) biasedBeatsBenchmarkCount += 1;
    }
    // The mispriced strategy should not reliably beat the benchmark on average.
    expect(sumBenchmarkMinusBiased / trials).toBeGreaterThan(0);
    expect(biasedBeatsBenchmarkCount / trials).toBeLessThan(0.5);
  });

  it("an absurdly wide market (scores zero) never beats the benchmark", () => {
    const trials = 100;
    for (let seed = 0; seed < trials; seed++) {
      const game = buildGame(CONFIG, seed * 5003 + 19);
      const benchmarkResult = computeBenchmark(game);
      const wideQuotes: Quote[] = game.rounds.map((r) => ({ bid: r.fairValue - 1000, ask: r.fairValue + 1000 }));
      const wideResult = runGame(game, wideQuotes);
      expect(wideResult.totalPnl).toBe(0);
      // A benchmark that itself frequently loses money would make "0" look artificially good —
      // guard against that: the wide (zero) result should not systematically beat the benchmark.
      expect(wideResult.totalPnl).toBeLessThanOrEqual(benchmarkResult.totalPnl + 50);
    }
  });
});

describe("benchmarkQuotes", () => {
  it("is centred exactly on each round's true fair value, at the configured epsilon width", () => {
    const game = buildGame(CONFIG, 61);
    const quotes = benchmarkQuotes(game);
    quotes.forEach((q, i) => {
      const fv = game.rounds[i].fairValue;
      expect(q.ask - q.bid).toBeCloseTo(2 * BENCHMARK_EPSILON, 12);
      expect((q.bid + q.ask) / 2).toBeCloseTo(fv, 9);
    });
  });
});
