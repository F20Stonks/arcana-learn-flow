import { useSyncExternalStore } from "react";
import {
  getHeadsolveAttempts,
  getLadderState,
  subscribeHeadsolveHistory,
} from "../headsolveHistory";
import type { HeadsolveAttempt, HeadsolveLadderState } from "../headsolve";

/** Re-renders on every graded headsolve attempt, wherever in the tree it came from — same
 *  useSyncExternalStore pattern as useAttempts/useRecognitionAttempts, over headsolve's own store. */
export function useHeadsolveAttempts(): HeadsolveAttempt[] {
  return useSyncExternalStore(subscribeHeadsolveHistory, getHeadsolveAttempts, getHeadsolveAttempts);
}

/** The persisted ladder position on its own — a separate, narrower read than
 *  useHeadsolveAttempts for a caller (e.g. a small level/streak badge) that only wants that. */
export function useHeadsolveLadder(): HeadsolveLadderState {
  return useSyncExternalStore(subscribeHeadsolveHistory, getLadderState, getLadderState);
}
