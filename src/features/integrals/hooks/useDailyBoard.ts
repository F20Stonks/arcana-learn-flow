import { useEffect, useMemo, useRef, useState } from "react";
import {
  boardWindow,
  fetchBoard,
  fetchTurnout,
  percentileAmong,
  rememberSubmitted,
  submitDaily,
  submittedPuzzles,
  type BoardWindow,
  type LeaderboardRow,
  type Turnout,
} from "../leaderboard";
import type { DailyRecord } from "../progress";

export type BoardState = "idle" | "signed-out" | "loading" | "ready" | "unavailable";

export interface DailyBoard {
  state: BoardState;
  rows: LeaderboardRow[];
  window: BoardWindow;
  turnout: Turnout | null;
  /** Share of solvers this run beat, or null when there is no one to compare against. */
  percentile: number | null;
}

const EMPTY_WINDOW: BoardWindow = { top: [], around: [], you: null };

/**
 * Submits a finished daily and reads back the board for it.
 *
 * Submission is fire-and-forget by design: a network problem must never cost the player their
 * local record of the day, which is already banked by the time this runs.
 */
export function useDailyBoard(
  puzzleNumber: number,
  record: DailyRecord | undefined,
  userId: string | null,
): DailyBoard {
  const [state, setState] = useState<BoardState>("idle");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [turnout, setTurnout] = useState<Turnout | null>(null);
  const attempted = useRef<number | null>(null);

  useEffect(() => {
    if (!record) return;
    // Unreachable behind DashboardGuard, but the component should not have a silent state: a run
    // with nobody to attribute it to gets told why it is not on the board.
    if (!userId) {
      setState("signed-out");
      return;
    }
    // One pass per puzzle per mount, whatever re-renders happen in between.
    if (attempted.current === puzzleNumber) return;
    attempted.current = puzzleNumber;

    let cancelled = false;
    setState("loading");

    (async () => {
      if (!submittedPuzzles().includes(puzzleNumber)) {
        const outcome = await submitDaily(userId, {
          puzzleNumber,
          problemId: record.problemId,
          solved: record.solved,
          seconds: record.seconds,
          hintsUsed: record.hintsUsed,
          wrongAttempts: record.wrongAttempts,
          score: record.score,
        });
        if (outcome === "submitted" || outcome === "already-played") rememberSubmitted(puzzleNumber);
        if (outcome === "unavailable") {
          if (!cancelled) setState("unavailable");
          return;
        }
      }

      const [board, counts] = await Promise.all([
        fetchBoard(puzzleNumber),
        fetchTurnout(puzzleNumber),
      ]);
      if (cancelled) return;
      if (board === null) {
        setState("unavailable");
        return;
      }
      setRows(board);
      setTurnout(counts);
      setState("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [puzzleNumber, record, userId]);

  const view = useMemo(() => boardWindow(rows, userId), [rows, userId]);
  const percentile = useMemo(() => {
    if (!view.you || rows.length <= 1) return null;
    return percentileAmong(view.you.score, rows);
  }, [view.you, rows]);

  return { state, rows, window: state === "ready" ? view : EMPTY_WINDOW, turnout, percentile };
}
