import { describe, expect, it } from "vitest";
import { DEFAULT_BOT_CONFIG } from "./bot";
import { DICE_SUM_3 } from "./contracts";
import { buildGame, runGame } from "./engine";
import type { GameConfig, Quote } from "./types";

const CONFIG: GameConfig = { contract: DICE_SUM_3, bot: DEFAULT_BOT_CONFIG };

/** Quotes a fixed-width market centred on each round's TRUE fair value, offset by `bias`. Reaches
 * into `game.rounds[i].fairValue` directly — fine in a test, off-limits to the live UI. */
function offsetQuotes(game: ReturnType<typeof buildGame>, bias: number, halfWidth: number): Quote[] {
  return game.rounds.map((r) => ({ bid: r.fairValue + bias - halfWidth, ask: r.fairValue + bias + halfWidth }));
}

describe("buildGame determinism", () => {
  it("the whole game — settlement, reveals, and bot estimates — reproduces exactly from its seed", () => {
    const a = buildGame(CONFIG, 4242);
    const b = buildGame(CONFIG, 4242);
    expect(a.settlement).toBe(b.settlement);
    expect(a.rounds).toEqual(b.rounds);
  });

  it("different seeds produce different games (sanity — not literally hashing to the same thing)", () => {
    const a = buildGame(CONFIG, 1);
    const b = buildGame(CONFIG, 2);
    expect(a.settlement !== b.settlement || a.rounds[0].estimate !== b.rounds[0].estimate).toBe(true);
  });
});

describe("P&L arithmetic balances", () => {
  it("totalPnl equals cashFlow + mark, and also the sum of per-trade hindsight P&L", () => {
    for (let seed = 0; seed < 30; seed++) {
      const game = buildGame(CONFIG, seed * 8191 + 5);
      // A mixed, not-perfectly-priced strategy so trades actually happen in both directions.
      const quotes = offsetQuotes(game, seed % 2 === 0 ? 1.5 : -1.5, 0.5);
      const result = runGame(game, quotes);

      expect(result.totalPnl).toBeCloseTo(result.cashFlow + result.mark, 9);

      const sumTradePnl = result.trades.reduce(
        (acc, t) => acc + (game.settlement - t.price) * t.candidateQtyDelta,
        0,
      );
      expect(result.totalPnl).toBeCloseTo(sumTradePnl, 9);

      // And the mark is exactly inventory * settlement, cash is exactly the sum of trade cash
      // flows — the two building blocks the total is made of.
      expect(result.mark).toBeCloseTo(result.finalInventory * game.settlement, 9);
      expect(result.cashFlow).toBeCloseTo(
        result.trades.reduce((acc, t) => acc + t.cashFlow, 0),
        9,
      );
    }
  });

  it("inventory is exactly the sum of signed trade quantities, and peak tracks its running max", () => {
    const game = buildGame(CONFIG, 99);
    const quotes = offsetQuotes(game, 2, 0.3);
    const result = runGame(game, quotes);

    let running = 0;
    let peak = 0;
    for (const t of result.trades) {
      running += t.candidateQtyDelta;
      peak = Math.max(peak, Math.abs(running));
    }
    expect(result.finalInventory).toBe(running);
    expect(result.peakAbsInventory).toBe(peak);
  });

  it("a game with no fills has zero P&L on both sides of the identity", () => {
    const game = buildGame(CONFIG, 3);
    const quotes: Quote[] = game.rounds.map((r) => ({ bid: r.fairValue - 1000, ask: r.fairValue + 1000 }));
    const result = runGame(game, quotes);
    expect(result.fillCount).toBe(0);
    expect(result.cashFlow).toBe(0);
    expect(result.mark).toBe(0);
    expect(result.totalPnl).toBe(0);
  });
});

describe("a badly-off market loses money reliably across many seeds", () => {
  it("quoting persistently biased away from true fair value loses money in the large majority of games", () => {
    const trials = 300;
    let losses = 0;
    let totalPnl = 0;
    for (let seed = 0; seed < trials; seed++) {
      const game = buildGame(CONFIG, seed * 65537 + 11);
      // Quoted a full 3 points above true fair value, tight spread: the bid sits well above fair
      // value on almost every round, so the bot hits it relentlessly and the candidate accumulates
      // a long position bought at a bad price.
      const quotes = offsetQuotes(game, 3, 0.25);
      const result = runGame(game, quotes);
      totalPnl += result.totalPnl;
      if (result.totalPnl < 0) losses += 1;
    }
    expect(losses / trials).toBeGreaterThan(0.9);
    expect(totalPnl / trials).toBeLessThan(-2);
  });

  it("loses money reliably in both directions of bias (quoting too high or too low)", () => {
    const trials = 300;
    let losses = 0;
    for (let seed = 0; seed < trials; seed++) {
      const game = buildGame(CONFIG, seed * 104729 + 23);
      const quotes = offsetQuotes(game, -3, 0.25);
      const result = runGame(game, quotes);
      if (result.totalPnl < 0) losses += 1;
    }
    expect(losses / trials).toBeGreaterThan(0.9);
  });
});

describe("an absurdly wide market", () => {
  it("gets no fills and scores as poor spread discipline, not as a good result", () => {
    const game = buildGame(CONFIG, 17);
    // Width 2000 against a contract whose stdDev never exceeds a handful of points.
    const quotes: Quote[] = game.rounds.map((r) => ({ bid: r.fairValue - 1000, ask: r.fairValue + 1000 }));
    const result = runGame(game, quotes);

    expect(result.fillCount).toBe(0);
    expect(result.adverseSelectionRate).toBeNull();
    expect(result.totalPnl).toBe(0);
    // Spread/uncertainty ratio should be enormous — hundreds of "sigma" wide — not a small,
    // disciplined number.
    expect(result.avgSpreadOverUncertainty).not.toBeNull();
    expect(result.avgSpreadOverUncertainty as number).toBeGreaterThan(100);
  });

  it("a tight, well-centred market has a small spread/uncertainty ratio by comparison", () => {
    const game = buildGame(CONFIG, 17);
    const quotes: Quote[] = game.rounds.map((r) => ({ bid: r.fairValue - 0.5, ask: r.fairValue + 0.5 }));
    const result = runGame(game, quotes);
    expect(result.avgSpreadOverUncertainty as number).toBeLessThan(1);
  });
});

describe("adverse selection classification", () => {
  it("marks a fill adverse iff it was on the wrong side of the TRUE fair value, not the bot's noisy one", () => {
    const game = buildGame(CONFIG, 55);
    const quotes = offsetQuotes(game, 2.5, 0.2);
    const result = runGame(game, quotes);
    expect(result.fillCount).toBeGreaterThan(0);
    for (const t of result.trades) {
      const shouldBeAdverse = t.side === "bot-buys" ? t.price < t.fairValueAtTrade : t.price > t.fairValueAtTrade;
      expect(t.adverse).toBe(shouldBeAdverse);
    }
  });
});
