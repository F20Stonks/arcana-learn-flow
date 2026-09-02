import { describe, expect, it } from "vitest";
import { DEFAULT_BOT_CONFIG } from "./bot";
import { DICE_SUM_3 } from "./contracts";
import { buildGame, runGame } from "./engine";
import { buildScorecard, scoreGame } from "./scoring";
import type { GameConfig, Quote } from "./types";

const CONFIG: GameConfig = { contract: DICE_SUM_3, bot: DEFAULT_BOT_CONFIG };

describe("buildScorecard", () => {
  it("carries the right sign for a caught-long / caught-short / flat ending inventory", () => {
    const game = buildGame(CONFIG, 12);

    const longQuotes: Quote[] = game.rounds.map((r) => ({ bid: r.fairValue + 3 - 0.2, ask: r.fairValue + 3 + 0.2 }));
    const longResult = runGame(game, longQuotes);
    const longCard = buildScorecard(game, longResult);
    if (longResult.finalInventory !== 0) {
      expect(longCard.endInventorySign).toBe(longResult.finalInventory > 0 ? "long" : "short");
    } else {
      expect(longCard.endInventorySign).toBe("flat");
    }

    const flatResult = runGame(
      game,
      game.rounds.map((r) => ({ bid: r.fairValue - 1000, ask: r.fairValue + 1000 })),
    );
    const flatCard = buildScorecard(game, flatResult);
    expect(flatCard.endInventorySign).toBe("flat");
    expect(flatCard.finalInventory).toBe(0);
  });

  it("skillPnl is candidatePnl minus benchmarkPnl", () => {
    const game = buildGame(CONFIG, 30);
    const quotes: Quote[] = game.rounds.map((r) => ({ bid: r.fairValue - 0.3, ask: r.fairValue + 0.3 }));
    const scorecard = scoreGame(game, quotes);
    expect(scorecard.skillPnl).toBeCloseTo(scorecard.candidatePnl - scorecard.benchmarkPnl, 9);
  });

  it("roundsCount matches the game's round count", () => {
    const game = buildGame(CONFIG, 1);
    const scorecard = scoreGame(
      game,
      game.rounds.map((r) => ({ bid: r.fairValue - 1, ask: r.fairValue + 1 })),
    );
    expect(scorecard.roundsCount).toBe(game.rounds.length);
  });

  it("an absurdly wide market scores poor spread discipline (a large ratio), not a good result", () => {
    const game = buildGame(CONFIG, 8);
    const wideCard = scoreGame(
      game,
      game.rounds.map((r) => ({ bid: r.fairValue - 1000, ask: r.fairValue + 1000 })),
    );
    const tightCard = scoreGame(
      game,
      game.rounds.map((r) => ({ bid: r.fairValue - 0.4, ask: r.fairValue + 0.4 })),
    );
    expect(wideCard.fillCount).toBe(0);
    expect(wideCard.avgSpreadOverUncertainty).not.toBeNull();
    expect(tightCard.avgSpreadOverUncertainty).not.toBeNull();
    expect(wideCard.avgSpreadOverUncertainty as number).toBeGreaterThan(tightCard.avgSpreadOverUncertainty as number);
    // A "0" P&L from never trading must not read as a strong scorecard on its own — spread
    // discipline is what flags it as a failure mode, separately from the raw P&L number.
    expect(wideCard.candidatePnl).toBe(0);
  });

  it("adverseSelectionRate is null with no fills, and a fraction in [0,1] with fills", () => {
    const game = buildGame(CONFIG, 14);
    const noFillCard = scoreGame(
      game,
      game.rounds.map((r) => ({ bid: r.fairValue - 1000, ask: r.fairValue + 1000 })),
    );
    expect(noFillCard.adverseSelectionRate).toBeNull();

    const filledCard = scoreGame(
      game,
      game.rounds.map((r) => ({ bid: r.fairValue + 2 - 0.2, ask: r.fairValue + 2 + 0.2 })),
    );
    if (filledCard.fillCount > 0) {
      expect(filledCard.adverseSelectionRate).not.toBeNull();
      expect(filledCard.adverseSelectionRate as number).toBeGreaterThanOrEqual(0);
      expect(filledCard.adverseSelectionRate as number).toBeLessThanOrEqual(1);
    }
  });
});
