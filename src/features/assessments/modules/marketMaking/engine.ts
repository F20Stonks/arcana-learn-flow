/**
 * The game engine: builds a whole seeded game up front, then resolves rounds against submitted
 * quotes.
 *
 * `buildGame` draws EVERYTHING a game will ever need from one rng thread, in a fixed order
 * (contract sampling, then one bot-noise draw per round) — the same "generate the whole paper up
 * front" move useAssessmentRun.ts makes for a section's items, and for the same reasons: it makes
 * back-navigation show the same state it showed before, makes a game reproducible from its seed
 * alone, and — the one specific to this module — lets `benchmark.ts` replay the exact same bot
 * behaviour against a different quoting strategy, which is what makes "P&L vs. the benchmark" a
 * fair comparison rather than a comparison against a differently-lucky bot.
 *
 * `runRound` / `runGame` take quotes as plain data rather than reading component state, so the
 * interactive hook (useMarketMakingGame.ts) and the benchmark/test code call the exact same
 * resolution logic.
 */
import { seededRng } from "../../engine/rng";
import { drawContract, ZERO_STD_EPS } from "./contracts";
import { decide, estimateFairValue } from "./bot";
import type { GameConfig, GameInstance, GameResult, Quote, RoundState, Trade } from "./types";

export function buildGame(config: GameConfig, seed: number): GameInstance {
  const rng = seededRng(seed);
  const draw = drawContract(config.contract, rng);
  // Bot noise is drawn AFTER the whole contract, one round at a time, in round order — so adding
  // a contract type never perturbs an existing one's noise draws, and the sequence is stable
  // enough to reason about by hand.
  const rounds: RoundState[] = draw.rounds.map((r) => ({
    ...r,
    estimate: estimateFairValue(r.fairValue, r.stdDev, config.bot, rng),
  }));

  return {
    seed,
    contract: config.contract,
    bot: config.bot,
    description: draw.description,
    settlement: draw.settlement,
    rounds,
  };
}

/** Resolves one round against one quote. Returns null on a pass (no trade). */
export function runRound(round: RoundState, quote: Quote, size: number): Trade | null {
  const decision = decide(quote, round.estimate);
  if (decision.action === "pass") return null;

  const price = decision.price;
  const isLift = decision.action === "lift";
  // Lift = the bot buys the candidate's offer = the candidate sells: inventory falls, cash comes
  // in. Hit = the bot sells into the candidate's bid = the candidate buys: inventory rises, cash
  // goes out.
  const candidateQtyDelta = isLift ? -size : size;
  const cashFlow = isLift ? price * size : -price * size;
  // Adverse selection is graded against the TRUE fair value, not the bot's noisy one: the bot
  // sometimes fills a candidate who was actually priced fine (its estimate overshot by noise), and
  // that shouldn't count against them.
  const adverse = isLift ? price < round.fairValue : price > round.fairValue;

  return {
    round: round.round,
    side: isLift ? "bot-buys" : "bot-sells",
    price,
    qty: size,
    candidateQtyDelta,
    cashFlow,
    fairValueAtTrade: round.fairValue,
    adverse,
  };
}

/**
 * Runs a whole game against a fixed sequence of quotes (one per round). Used by the benchmark,
 * by tests exercising a scripted strategy, and — round by round, as each quote comes in — by the
 * live hook.
 */
export function runGame(game: GameInstance, quotes: readonly Quote[]): GameResult {
  let inventory = 0;
  let peakAbsInventory = 0;
  let cashFlow = 0;
  const trades: Trade[] = [];
  const usedQuotes: Quote[] = [];

  const n = Math.min(quotes.length, game.rounds.length);
  for (let i = 0; i < n; i++) {
    const quote = quotes[i];
    usedQuotes.push(quote);
    const trade = runRound(game.rounds[i], quote, game.bot.size);
    if (trade) {
      trades.push(trade);
      inventory += trade.candidateQtyDelta;
      cashFlow += trade.cashFlow;
      peakAbsInventory = Math.max(peakAbsInventory, Math.abs(inventory));
    }
  }

  const mark = inventory * game.settlement;
  const totalPnl = cashFlow + mark;
  const fillCount = trades.length;
  const adverseFillCount = trades.filter((t) => t.adverse).length;

  // Excluded from the average wherever a round's TRUE remaining uncertainty is (numerically)
  // zero — "spread relative to uncertainty" is undefined once there is no uncertainty left, and
  // dividing by a tiny floor there would let one fully-resolved round dominate the whole average.
  const spreadRatios: number[] = [];
  for (let i = 0; i < n; i++) {
    const stdDev = game.rounds[i].stdDev;
    if (stdDev > ZERO_STD_EPS) {
      spreadRatios.push((quotes[i].ask - quotes[i].bid) / (2 * stdDev));
    }
  }

  return {
    trades,
    finalInventory: inventory,
    peakAbsInventory,
    cashFlow,
    mark,
    totalPnl,
    fillCount,
    adverseFillCount,
    adverseSelectionRate: fillCount > 0 ? adverseFillCount / fillCount : null,
    avgSpreadOverUncertainty:
      spreadRatios.length > 0 ? spreadRatios.reduce((a, b) => a + b, 0) / spreadRatios.length : null,
    quotes: usedQuotes,
  };
}
