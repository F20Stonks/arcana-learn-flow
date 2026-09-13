import { useCallback, useSyncExternalStore } from "react";
import { dayKey } from "../daily";
import { campaignDay, planSession, type CampaignDay, type SessionStep, type StepKind } from "../uk/campaign";
import {
  getCampaignState,
  liveCampaignStreak,
  sessionsCompletedCount,
  setTargetDate as storeSetTargetDate,
  stepIsComplete,
  subscribeCampaign,
  toggleStep as storeToggleStep,
} from "../uk/campaignStore";
import { useConceptReview } from "./useConceptReview";

export interface UseCampaign {
  targetDate: string;
  setTargetDate: (date: string) => void;
  /** Today's dayKey — the day every tick in this render applies to. */
  today: string;
  day: CampaignDay;
  steps: SessionStep[];
  isStepDone: (step: StepKind) => boolean;
  toggleStep: (step: StepKind) => void;
  /** Days shown up (>=1 step ticked), all time. */
  sessionsCompleted: number;
  /** Current adherence streak — showing up, not solving. 0 once a day has been missed. */
  streak: number;
}

/**
 * The campaign, assembled for right now: the persisted target date and tick log
 * (useSyncExternalStore, same pattern as useProgress/useAttempts) combined with campaign.ts's pure
 * campaignDay/planSession to get today's block and session plan. Re-renders on every store write,
 * wherever it came from.
 *
 * `now` is a parameter, defaulting to the real clock, purely so a test or a Playwright walkthrough
 * can pin "today" without waiting for the calendar — nothing here reads Date.now() implicitly.
 */
export function useCampaign(now: Date = new Date()): UseCampaign {
  const state = useSyncExternalStore(subscribeCampaign, getCampaignState, getCampaignState);
  const today = dayKey(now);
  const day = campaignDay(state.targetDate, now);
  // Which technique is due for a spaced reread, if any — the one piece of planSession's input
  // that lives in its own store (conceptReview.ts) rather than being a pure function of the date.
  const { next: dueReview } = useConceptReview(now);
  const steps = planSession(day, dueReview);

  const isStepDone = useCallback(
    (step: StepKind) => stepIsComplete(state.sessions, today, step),
    [state.sessions, today],
  );
  const toggleStep = useCallback((step: StepKind) => storeToggleStep(today, step), [today]);

  return {
    targetDate: state.targetDate,
    setTargetDate: storeSetTargetDate,
    today,
    day,
    steps,
    isStepDone,
    toggleStep,
    sessionsCompleted: sessionsCompletedCount(state.sessions),
    streak: liveCampaignStreak(state.streak, now),
  };
}
