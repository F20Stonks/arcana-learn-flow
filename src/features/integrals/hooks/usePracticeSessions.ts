import { useSyncExternalStore } from "react";
import { getPracticeSessions, subscribePracticeSessions, type PracticeSession } from "../practiceSessions";

/** Re-renders on every save/delete/rename, wherever in the tree it came from — same
 *  useSyncExternalStore pattern as useAttempts/useProgress. */
export function usePracticeSessions(): PracticeSession[] {
  return useSyncExternalStore(subscribePracticeSessions, getPracticeSessions, getPracticeSessions);
}
