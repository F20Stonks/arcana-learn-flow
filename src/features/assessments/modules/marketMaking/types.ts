/**
 * Market-making game — module-local types.
 *
 * Nothing here is the frozen contract (that's ../../types.ts, which this module does not touch).
 * These types describe the game state a single "custom" AssessmentItem carries: a whole
 * multi-round quoting session lives inside one item, because — per types.ts's own doc comment —
 * `custom` is "the escape hatch for modules that own their whole interaction surface ... and
 * report a score rather than a per-item string." The per-round quoting loop is internal to this
 * module; the shared engine only ever sees one item, submitted once, at the end.
 */

/** A two-sided market the candidate quotes. Always `bid < ask`; a crossed market is rejected by
 * the input layer before it ever reaches the bot. */
export interface Quote {
  bid: number;
  ask: number;
}

/** Fixed configuration for the bot's pricing policy — see bot.ts for the policy itself. */
export interface BotConfig {
  /**
   * The bot's private fair-value estimate is the TRUE conditional expectation plus zero-mean
   * noise, scaled to this fraction of the round's remaining uncertainty (its standard deviation).
   * This is what keeps the bot from being a perfect oracle: it is right on average, wrong on any
   * given round, in a way that shrinks automatically as information is revealed (a round with
   * less uncertainty gets less noise, because there is less room to be wrong about).
   */
  noiseFraction: number;
  /** Contracts traded per fill. Fixed — the bot doesn't size up or down, so a candidate who gets
   * picked off accumulates inventory linearly rather than the bot adapting to them. */
  size: number;
}

export type ContractKind = "dice-sum" | "coin-binary" | "binomial-heads" | "card-draw";

export interface DiceSumConfig {
  kind: "dice-sum";
  /** Number of independent fair dice summed for settlement. */
  diceCount: number;
  /** Sides per die. 6 unless stated otherwise. */
  sides: number;
}

export interface CoinBinaryConfig {
  kind: "coin-binary";
  /** P(the high payoff). 0.5 for Jane Street's published version. */
  headsProb: number;
  payoffHigh: number;
  payoffLow: number;
  /** This contract carries no information reveals (see contracts.ts) — the fair value is static
   * for the whole game, so `rounds` just repeats the quoting exercise against a fixed price. */
  rounds: number;
}

export interface BinomialHeadsConfig {
  kind: "binomial-heads";
  /** Number of independent fair-ish coin flips. Settlement is the count of heads. */
  flips: number;
  headsProb: number;
}

export interface CardDrawConfig {
  kind: "card-draw";
  /** A "deck" of cards numbered 1..deckSize, one drawn uniformly at random. */
  deckSize: number;
  /** How many wrong candidates get eliminated over the game (capped at deckSize - 1). */
  maxReveals: number;
}

export type ContractConfig = DiceSumConfig | CoinBinaryConfig | BinomialHeadsConfig | CardDrawConfig;

/** One quoting round's TRUE state — the numbers the bot and the scorer use. Never rendered
 * verbatim to the candidate: `fairValue` is exactly the number the game is testing whether they
 * can derive themselves from `revealText` and the contract's known shape. */
export interface RoundState {
  round: number;
  /** True conditional expectation of the settlement given everything revealed up to and
   * including this round's own `revealText`. A martingale in round index — see contracts.ts. */
  fairValue: number;
  /** Standard deviation of the settlement given the same information. 0 once nothing is left to
   * resolve (e.g. the last round of dice-sum, once every die is revealed). */
  stdDev: number;
  /** What was just revealed before this round's quote, e.g. "Die #2 shows 4." `null` on the
   * opening round, where only the contract's prior shape is known. */
  revealText: string | null;
  /**
   * The bot's own private fair-value estimate for this round — precomputed once, at game-build
   * time, from the same rng thread as everything else (see engine.ts's `buildGame`). Baking it in
   * up front, rather than drawing it lazily when a quote is submitted, is what lets the benchmark
   * (benchmark.ts) replay the *exact same* bot behaviour against a different quoting strategy: a
   * "what would a perfectly-priced player have made in this same game" comparison only works if
   * both runs see the same bot.
   */
  estimate: number;
}

export type TradeSide =
  /** The bot lifted the candidate's offer: it buys, the candidate sells. */
  | "bot-buys"
  /** The bot hit the candidate's bid: it sells, the candidate buys. */
  | "bot-sells";

export interface Trade {
  round: number;
  side: TradeSide;
  /** The price the trade printed at — always the candidate's own bid or ask, never the bot's
   * estimate (the bot has no reason to improve on the price it was offered). */
  price: number;
  qty: number;
  /** Signed change to the CANDIDATE's inventory: -qty on bot-buys, +qty on bot-sells. */
  candidateQtyDelta: number;
  /** Signed cash impact to the CANDIDATE: +price*qty on bot-buys (they sold), -price*qty on
   * bot-sells (they bought). */
  cashFlow: number;
  /** The round's TRUE fair value at trade time — used only for hindsight scoring (adverse
   * selection), never fed back into the live UI. */
  fairValueAtTrade: number;
  /** True iff, marked against the TRUE fair value (not the bot's noisy one), the candidate was on
   * the wrong side of this specific trade — sold below fair value, or bought above it. This can
   * differ from "the bot chose to trade": noise means the bot sometimes fills a candidate who was
   * actually priced fine, and sometimes misses one who wasn't. */
  adverse: boolean;
}

export interface GameConfig {
  contract: ContractConfig;
  bot: BotConfig;
}

export interface GameInstance {
  seed: number;
  contract: ContractConfig;
  bot: BotConfig;
  /** Human description of the settlement mechanism, shown once before round 0. */
  description: string;
  /** The TRUE settlement value. Private to the engine until the debrief — never read by the live
   * UI while `status !== "settled"`. */
  settlement: number;
  rounds: RoundState[];
}

export interface GameResult {
  trades: Trade[];
  finalInventory: number;
  peakAbsInventory: number;
  cashFlow: number;
  /** finalInventory * settlement — the unrealised mark on whatever position is left open. */
  mark: number;
  /** cashFlow + mark. Also, algebraically, the sum of each trade's (settlement - price) *
   * candidateQtyDelta — engine.test.ts checks both routes agree. */
  totalPnl: number;
  fillCount: number;
  adverseFillCount: number;
  /** adverseFillCount / fillCount, or null when there were no fills — an unfilled market has no
   * adverse-selection rate to report, good or bad. */
  adverseSelectionRate: number | null;
  /** Mean of (ask - bid) / (2 * roundStdDev), over rounds where roundStdDev is meaningfully
   * nonzero. null when every round had zero remaining uncertainty (never happens in practice —
   * round 0 never does — but keeps the type honest). */
  avgSpreadOverUncertainty: number | null;
  quotes: Quote[];
}

export interface MarketMakingScorecard {
  candidatePnl: number;
  benchmarkPnl: number;
  /** candidatePnl - benchmarkPnl. The headline number: it isolates quoting skill from the luck of
   * the settlement draw, which the benchmark alone still carries (see benchmark.ts). */
  skillPnl: number;
  avgSpreadOverUncertainty: number | null;
  peakAbsInventory: number;
  finalInventory: number;
  endInventorySign: "long" | "short" | "flat";
  fillCount: number;
  adverseFillCount: number;
  adverseSelectionRate: number | null;
  roundsCount: number;
}
