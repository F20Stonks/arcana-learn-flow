import { useSyncExternalStore } from "react";
import { getRecognitionAttempts, subscribeRecognitionAttempts } from "../recognitionHistory";
import type { RecognitionAttempt } from "../recognition";

/** Re-renders on every new recognition pick, wherever in the tree it came from — same
 *  useSyncExternalStore pattern as useProgress/useAttempts, over the recognition drill's own
 *  store. */
export function useRecognitionAttempts(): RecognitionAttempt[] {
  return useSyncExternalStore(subscribeRecognitionAttempts, getRecognitionAttempts, getRecognitionAttempts);
}
