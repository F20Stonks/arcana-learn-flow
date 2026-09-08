import { useSyncExternalStore } from "react";
import { getUkuibProgress, subscribeUkuib, type UkuibProgress } from "../ukuib/ukuibProgress";

/** Re-renders on every write to the UKUIB course store, wherever in the tree it came from. */
export function useUkuibProgress(): UkuibProgress {
  return useSyncExternalStore(subscribeUkuib, getUkuibProgress, getUkuibProgress);
}
