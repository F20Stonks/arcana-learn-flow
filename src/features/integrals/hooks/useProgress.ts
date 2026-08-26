import { useSyncExternalStore } from "react";
import { getProgress, subscribe, type Progress } from "../progress";

/** Re-renders on every write to the progress store, wherever in the tree it came from. */
export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}
