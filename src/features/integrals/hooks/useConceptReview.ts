import { useSyncExternalStore } from "react";
import {
  conceptReviewStep,
  dueForReview,
  getConceptReviewRecords,
  subscribeConceptReview,
  type ConceptReviewRecord,
} from "../conceptReview";
import type { TechniqueId } from "../types";

export interface UseConceptReview {
  records: Partial<Record<TechniqueId, ConceptReviewRecord>>;
  /** Most-overdue first. Empty until something's actually been read once. */
  due: TechniqueId[];
  /** The single technique a "review this next" prompt should lead with, or null when nothing's due. */
  next: ReturnType<typeof conceptReviewStep>;
}

/**
 * Concept-review state, assembled for right now — useSyncExternalStore over the store (same pattern
 * as useAttempts/useProgress), combined with conceptReview.ts's own pure due-list/step derivation.
 * Re-renders on every recorded read, wherever in the tree it came from.
 *
 * `now` is a parameter, defaulting to the real clock, purely so a test or a Playwright walkthrough
 * can pin "today" without waiting for the calendar — the same convention useCampaign already uses.
 */
export function useConceptReview(now: Date = new Date()): UseConceptReview {
  const records = useSyncExternalStore(
    subscribeConceptReview,
    getConceptReviewRecords,
    getConceptReviewRecords,
  );
  return { records, due: dueForReview(now), next: conceptReviewStep(now) };
}
