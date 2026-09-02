/**
 * Interactive game state for one market-making session.
 *
 * The only piece of state that actually matters is `quotes` — the bid/ask the candidate submitted
 * each round, in order. Everything else (trades, inventory, P&L, the scorecard) is DERIVED by
 * replaying `quotes` through engine.ts's `runGame`/scoring.ts's `buildScorecard` on every render,
 * rather than hand-accumulated here — the same functions bot.test.ts / engine.test.ts /
 * benchmark.test.ts already pin down. That is what guarantees the number this hook shows the
 * candidate can never drift from the number the test suite verified: there is only one
 * implementation of "what happens when these quotes meet this game", and this hook calls it
 * instead of re-deriving it.
 */
import { useCallback, useMemo, useState } from "react";
import type { AssessmentItem } from "../../types";
import { buildGame, runGame } from "./engine";
import { buildScorecard } from "./scoring";
import { submissionOf, type MarketMakingItemMeta } from "./index";
import type { GameInstance, MarketMakingScorecard, Quote, Trade } from "./types";

export interface UseMarketMakingGameResult {
  game: GameInstance;
  /** Index of the round currently being quoted. Equal to `roundsTotal` once the game is over. */
  roundIndex: number;
  roundsTotal: number;
  /** Text of every reveal shown so far, oldest first — round 0's implicit "nothing yet" is not
   * included. */
  revealed: string[];
  /** The reveal that just happened, to precede this round's quote — null on round 0. */
  latestReveal: string | null;
  trades: Trade[];
  inventory: number;
  peakAbsInventory: number;
  isFinished: boolean;
  /** Set once every round has been quoted. Never touch `game.settlement` before this — it's the
   * whole point of the game not to know it early. */
  scorecard: MarketMakingScorecard | null;
  settlement: number | null;
  /** Rejected-input message for the current round, e.g. a crossed market. Cleared on the next
   * valid submission or round change. */
  error: string | null;
  submitQuote: (bid: number, ask: number) => void;
  /** Sends the final report to the shared engine. Deliberately separate from reaching
   * `isFinished`: the candidate sees their own summary screen first (built from `scorecard`) and
   * this is what their explicit "Continue" click calls — calling it automatically would hand
   * control back to ProctorShell before they ever saw the numbers this module exists to show. */
  finish: () => void;
}

export function useMarketMakingGame(item: AssessmentItem, onSubmit: (raw: string) => void): UseMarketMakingGameResult {
  const meta = item.meta as unknown as MarketMakingItemMeta;
  const game = useMemo(() => buildGame({ contract: meta.contract, bot: meta.bot }, meta.seed), [meta]);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => runGame(game, quotes), [game, quotes]);
  const roundIndex = quotes.length;
  const isFinished = roundIndex >= game.rounds.length;
  const scorecard = useMemo(() => (isFinished ? buildScorecard(game, result) : null), [isFinished, game, result]);

  const submitQuote = useCallback(
    (bid: number, ask: number) => {
      if (isFinished) return;
      if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
        setError("Enter a number for both bid and ask.");
        return;
      }
      if (bid >= ask) {
        setError("Bid must be strictly less than ask — a crossed market can't be quoted.");
        return;
      }
      setError(null);
      setQuotes((prev) => [...prev, { bid, ask }]);
    },
    [isFinished],
  );

  const finish = useCallback(() => {
    if (!scorecard) return;
    onSubmit(submissionOf(scorecard));
  }, [scorecard, onSubmit]);

  const revealed = useMemo(
    () => game.rounds.slice(0, roundIndex + 1).map((r) => r.revealText).filter((t): t is string => t !== null),
    [game, roundIndex],
  );
  const latestReveal = game.rounds[roundIndex]?.revealText ?? null;

  return {
    game,
    roundIndex,
    roundsTotal: game.rounds.length,
    revealed,
    latestReveal,
    trades: result.trades,
    inventory: result.finalInventory,
    peakAbsInventory: result.peakAbsInventory,
    isFinished,
    scorecard,
    settlement: isFinished ? game.settlement : null,
    error,
    submitQuote,
    finish,
  };
}
