/**
 * The readiness readout — a few honest numbers pulled from the WS-1 attempt log, over a trailing
 * window rather than all-time. All-time would blur breadth-block habits into taper-block form;
 * a solo competitor training for months needs to know how they are doing lately, not on average
 * since they started.
 *
 * Pure: attempts in, a handful of numbers out — no storage, no clock of its own (the "now" used to
 * define the window is a parameter, defaulting to the real clock, exactly like campaign.ts's own
 * campaignDay/daysUntil). Every number is nullable, and turns null rather than a misleading 0 or a
 * one-sample median whenever the window doesn't have enough evidence to say something real — the
 * caller is expected to render that as "not enough data yet," not as a zero.
 */
import type { AttemptRecord } from "../attempts";

/** Recent form, not lifetime average — long enough to smooth day-to-day noise, short enough to
 *  actually track which block the competitor is currently in. */
export const READINESS_WINDOW_DAYS = 14;

/** Below this many samples, a rate or a median is more noise than signal — report "not enough
 *  data" instead of a number that looks precise but isn't. */
export const MIN_READINESS_SAMPLE = 5;

export interface Readiness {
  windowDays: number;
  attemptsInWindow: number;
  /** Attempts per day, averaged over the window. Null until there is enough evidence. */
  attemptRate: number | null;
  /** Median problem-appears-to-first-keystroke latency, in seconds, over the window. Null until
   *  there is enough evidence. */
  medianRecognitionSeconds: number | null;
  /** Fraction of the window's attempts that were not graded correct, 0-1. Null until there is
   *  enough evidence. */
  errorRate: number | null;
  /** How many samples backed each metric — so a caller that wants to show "(n=3)" alongside a
   *  null can, without recomputing anything. */
  sampleSize: { attempts: number; recognition: number };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeReadiness(attempts: AttemptRecord[], now: Date = new Date()): Readiness {
  const cutoff = now.getTime() - READINESS_WINDOW_DAYS * 86_400_000;
  const inWindow = attempts.filter((a) => new Date(a.at).getTime() >= cutoff);
  const attemptsInWindow = inWindow.length;

  const recognitionSeconds = inWindow
    .map((a) => a.msToFirstKeystroke)
    .filter((ms): ms is number => ms != null)
    .map((ms) => ms / 1000);

  const attemptRate =
    attemptsInWindow >= MIN_READINESS_SAMPLE ? attemptsInWindow / READINESS_WINDOW_DAYS : null;
  const medianRecognitionSeconds =
    recognitionSeconds.length >= MIN_READINESS_SAMPLE ? median(recognitionSeconds) : null;
  const errorRate =
    attemptsInWindow >= MIN_READINESS_SAMPLE
      ? inWindow.filter((a) => a.verdictClass !== "correct").length / attemptsInWindow
      : null;

  return {
    windowDays: READINESS_WINDOW_DAYS,
    attemptsInWindow,
    attemptRate,
    medianRecognitionSeconds,
    errorRate,
    sampleSize: { attempts: attemptsInWindow, recognition: recognitionSeconds.length },
  };
}
