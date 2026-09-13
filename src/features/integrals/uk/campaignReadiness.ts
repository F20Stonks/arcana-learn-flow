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
import type { PaperResult } from "./paperHistory";

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

// ── paper readiness ────────────────────────────────────────────────────────────────────────────
//
// The three metrics WS-7's own spec named beyond the attempt-log ones above: Q1-10 pace, tail
// reach, and a score trend against the very first sitting on record. Deliberately a separate
// function rather than folded into computeReadiness: paper sittings are weekly at best, so a
// 14-day trailing window (the right choice for per-attempt data, which arrives constantly) would
// mostly show one sitting or none — every sitting on record is the honest denominator here, not a
// shortcut taken to dodge the windowing logic above.

/** Score against the very first paper on record — the "versus your own first cold sit" the WS-7
 *  spec asked for. Needs at least two sittings; one sitting has nothing to compare itself to. */
export interface PaperScoreTrend {
  firstScore: number;
  firstTotal: number;
  latestScore: number;
  latestTotal: number;
  /** Percentage points, latest minus first. Positive is improvement. */
  deltaPercentagePoints: number;
}

export interface PaperReadiness {
  /** Every sitting on record — not windowed, see the note above. */
  sittings: number;
  /** Median seconds spent per accessible-band (Q1-10) question, one figure per sitting then
   *  medianed across sittings. Null until there is at least one sitting. */
  accessiblePaceSeconds: number | null;
  /** Mean fraction of the tail band (Q21-30) actually opened, across sittings that recorded it.
   *  Older sittings, from before `PaperBandResult.attempted` existed, are excluded rather than
   *  assumed 0 — see that field's own doc comment. Null until at least one sitting has it. */
  tailReachRate: number | null;
  /** How many sittings backed `tailReachRate` — can be smaller than `sittings` for the reason
   *  above, so a caller can show "(n=2)" rather than imply every sitting counted. */
  tailReachSampleSize: number;
  /** Null until there are at least two sittings to compare. */
  scoreTrend: PaperScoreTrend | null;
}

function bandResult(result: PaperResult, bandId: "accessible" | "tail") {
  return result.bands.find((b) => b.bandId === bandId);
}

export function computePaperReadiness(history: PaperResult[]): PaperReadiness {
  const sittings = history.length;

  const accessiblePaces = history
    .map((r) => bandResult(r, "accessible"))
    .filter((b): b is NonNullable<typeof b> => b !== undefined && b.total > 0)
    .map((b) => b.secondsSpent / b.total);
  const accessiblePaceSeconds = accessiblePaces.length > 0 ? median(accessiblePaces) : null;

  const tailReaches = history
    .map((r) => bandResult(r, "tail"))
    .filter((b): b is NonNullable<typeof b> => b !== undefined && b.attempted !== undefined && b.total > 0)
    .map((b) => b.attempted! / b.total);
  const tailReachRate =
    tailReaches.length > 0 ? tailReaches.reduce((s, v) => s + v, 0) / tailReaches.length : null;

  let scoreTrend: PaperScoreTrend | null = null;
  if (sittings >= 2) {
    const first = history[0];
    const latest = history[sittings - 1];
    scoreTrend = {
      firstScore: first.score,
      firstTotal: first.total,
      latestScore: latest.score,
      latestTotal: latest.total,
      deltaPercentagePoints: (latest.score / latest.total - first.score / first.total) * 100,
    };
  }

  return {
    sittings,
    accessiblePaceSeconds,
    tailReachRate,
    tailReachSampleSize: tailReaches.length,
    scoreTrend,
  };
}
