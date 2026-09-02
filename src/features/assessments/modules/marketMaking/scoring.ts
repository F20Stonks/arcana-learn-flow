/**
 * Aggregate scoring — the several numbers the debrief actually shows, built from the same
 * GameResult shape runGame() returns for both the candidate's real quotes and the benchmark's.
 *
 * Deliberately several numbers, not one: raw P&L over an eight-round game is mostly the luck of
 * the settlement draw (see benchmark.ts), so it can't carry the whole verdict on its own. Spread
 * discipline and adverse selection are what separate "made money because the market went their
 * way" from "made money because they priced it correctly", and inventory control is what separate
 * "flat and disciplined" from "got run over and got lucky it didn't matter".
 */
import { computeBenchmark } from "./benchmark";
import { runGame } from "./engine";
import type { GameInstance, GameResult, MarketMakingScorecard, Quote } from "./types";

function inventorySign(finalInventory: number): "long" | "short" | "flat" {
  if (finalInventory > 0) return "long";
  if (finalInventory < 0) return "short";
  return "flat";
}

export function buildScorecard(game: GameInstance, candidateResult: GameResult): MarketMakingScorecard {
  const benchmarkResult = computeBenchmark(game);

  return {
    candidatePnl: candidateResult.totalPnl,
    benchmarkPnl: benchmarkResult.totalPnl,
    skillPnl: candidateResult.totalPnl - benchmarkResult.totalPnl,
    avgSpreadOverUncertainty: candidateResult.avgSpreadOverUncertainty,
    peakAbsInventory: candidateResult.peakAbsInventory,
    finalInventory: candidateResult.finalInventory,
    endInventorySign: inventorySign(candidateResult.finalInventory),
    fillCount: candidateResult.fillCount,
    adverseFillCount: candidateResult.adverseFillCount,
    adverseSelectionRate: candidateResult.adverseSelectionRate,
    roundsCount: game.rounds.length,
  };
}

/** Convenience for tests and the hook's final-round path: run the candidate's quotes and score
 * them against the benchmark in one call. */
export function scoreGame(game: GameInstance, quotes: readonly Quote[]): MarketMakingScorecard {
  return buildScorecard(game, runGame(game, quotes));
}
