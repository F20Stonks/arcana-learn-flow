import { useSyncExternalStore } from "react";
import { getAttempts, subscribeAttempts, type AttemptRecord } from "../attempts";

/** Re-renders on every new attempt recorded, wherever in the tree it came from — same
 *  useSyncExternalStore pattern as useProgress, over the separate WS-1 attempt log. */
export function useAttempts(): AttemptRecord[] {
  return useSyncExternalStore(subscribeAttempts, getAttempts, getAttempts);
}
