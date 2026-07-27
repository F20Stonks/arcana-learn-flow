// Deterministic "what to do next" policy for the Dashboard recommendation card.
// Pure function over typed inputs — no I/O, no LLM — so it's trivially unit-testable.
//
// Priority order (all day-granularity, local time):
//   1. Overdue review (most overdue first)
//   2. Review due today
//   3. Next unfinished subtopic, from the active track with the nearest upcoming
//      exam date (tie-break: weakest spec-checklist coverage %, then oldest track)
//   4. Everything done & nothing due: earliest upcoming review ("review early"),
//      else suggest starting a new track.

export interface SubtopicLite {
  id: string;
  title: string;
  /** subtopics.status — "unlocked" | "in_progress" | "complete" | "locked" | ... */
  status: string;
  /** order_index of the parent topic */
  topicOrder: number;
  /** order_index of the subtopic within its topic */
  order: number;
  /** subtopics.estimated_minutes, when set */
  estimatedMinutes?: number | null;
}

export interface TrackLite {
  id: string;
  title: string;
  /** learning_tracks.exam_date (date string) — past dates are ignored for urgency */
  examDate: string | null;
  createdAt: string;
  subtopics: SubtopicLite[];
  /** spec_checklist_items ticked count for this track, if a checklist exists */
  specTicked?: number;
  /** spec_checklist_items total count for this track, if a checklist exists */
  specTotal?: number;
}

export interface ReviewLite {
  subtopicId: string;
  /** subtopic_reviews.next_review_due_at */
  dueAt: string;
}

export interface NextActionInput {
  now: Date;
  /** ACTIVE (non-archived) tracks only — the caller filters. */
  tracks: TrackLite[];
  /** All scheduled reviews for the user. Reviews whose subtopic isn't in an
   *  active track (e.g. archived-track subtopics) are ignored. */
  reviews: ReviewLite[];
}

export type NextActionKind =
  | "overdue_review"
  | "due_review"
  | "next_subtopic"
  | "upcoming_review"
  | "new_track";

export interface NextAction {
  kind: NextActionKind;
  /** Short label (usually the subtopic title). */
  label: string;
  /** One-line human explanation of why this is the recommendation. */
  reason: string;
  /** Router path the CTA navigates to. */
  to: string;
  /** Button text. */
  cta: string;
  /** The track this action belongs to. "" only for the track-less "new_track" fallback. */
  trackTitle: string;
  /** Days until that track's exam, or null if none / already past. */
  daysToExam: number | null;
  /** subtopics.estimated_minutes for the target subtopic, when set. */
  estimatedMinutes: number | null;
}

export interface NextActionPlan {
  primary: NextAction;
  /** Up to 2 further suggestions, in priority order. */
  secondary: NextAction[];
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
function dayDiff(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** Days until the track's exam, or null if none / invalid / already past. */
function examDaysAway(t: TrackLite, now: Date): number | null {
  if (!t.examDate) return null;
  const d = new Date(t.examDate);
  if (isNaN(d.getTime())) return null;
  const days = dayDiff(now, d);
  return days >= 0 ? days : null;
}

/** Fraction of spec items ticked, or null when no checklist data exists. */
function specCoverage(t: TrackLite): number | null {
  if (typeof t.specTicked !== "number" || typeof t.specTotal !== "number" || t.specTotal <= 0) return null;
  return t.specTicked / t.specTotal;
}

/** Nearest exam first; then weakest spec coverage; then oldest track; then id. */
function compareTrackUrgency(now: Date) {
  return (a: TrackLite, b: TrackLite): number => {
    const ea = examDaysAway(a, now);
    const eb = examDaysAway(b, now);
    if (ea !== null || eb !== null) {
      if (ea === null) return 1;
      if (eb === null) return -1;
      if (ea !== eb) return ea - eb;
    }
    const ca = specCoverage(a);
    const cb = specCoverage(b);
    if (ca !== null || cb !== null) {
      if (ca === null) return 1;
      if (cb === null) return -1;
      if (ca !== cb) return ca - cb;
    }
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.id.localeCompare(b.id);
  };
}

/** First subtopic to work on in a track: resume in-progress, else first
 *  not-yet-complete (skipping locked), in topic/subtopic order. */
function nextSubtopic(t: TrackLite): SubtopicLite | null {
  const ordered = [...t.subtopics].sort(
    (a, b) => a.topicOrder - b.topicOrder || a.order - b.order || a.id.localeCompare(b.id),
  );
  return (
    ordered.find((s) => s.status === "in_progress") ??
    ordered.find((s) => s.status !== "complete" && s.status !== "locked") ??
    null
  );
}

export function planNextAction(input: NextActionInput): NextActionPlan | null {
  const { now, tracks, reviews } = input;
  if (tracks.length === 0) return null; // new user — the Dashboard's own empty state handles this

  const subIndex = new Map<string, { sub: SubtopicLite; track: TrackLite }>();
  for (const t of tracks) for (const s of t.subtopics) subIndex.set(s.id, { sub: s, track: t });

  const resolvedReviews = reviews
    .map((r) => ({ r, resolved: subIndex.get(r.subtopicId), dueTime: new Date(r.dueAt).getTime() }))
    .filter((x) => x.resolved !== undefined && !isNaN(x.dueTime))
    .sort((a, b) => a.dueTime - b.dueTime || a.r.subtopicId.localeCompare(b.r.subtopicId));

  const candidates: NextAction[] = [];

  // 1 + 2. Reviews due today or earlier, most overdue first.
  for (const { r, resolved } of resolvedReviews) {
    const daysAgo = dayDiff(new Date(r.dueAt), now);
    if (daysAgo < 0) continue; // due on a future day
    const title = resolved!.sub.title;
    candidates.push({
      kind: daysAgo >= 1 ? "overdue_review" : "due_review",
      label: title,
      reason:
        daysAgo >= 1
          ? `Review "${title}" — due ${plural(daysAgo, "day")} ago`
          : `Review "${title}" — due today`,
      to: `/session/${r.subtopicId}?mode=review`,
      cta: "Start review",
      trackTitle: resolved!.track.title,
      daysToExam: examDaysAway(resolved!.track, now),
      estimatedMinutes: resolved!.sub.estimatedMinutes ?? null,
    });
  }

  // 3. Next subtopic per track, most urgent track first.
  for (const t of [...tracks].sort(compareTrackUrgency(now))) {
    const next = nextSubtopic(t);
    if (!next) continue;
    const daysToExam = examDaysAway(t, now);
    let reason: string;
    if (daysToExam !== null) {
      reason =
        daysToExam === 0
          ? `Your ${t.title} exam is today — "${next.title}" is next`
          : `${plural(daysToExam, "day")} to your ${t.title} exam and "${next.title}" is next`;
    } else if (next.status === "in_progress") {
      reason = `Pick up "${next.title}" where you left off in ${t.title}`;
    } else {
      reason = `"${next.title}" is next up in ${t.title}`;
    }
    candidates.push({
      kind: "next_subtopic",
      label: next.title,
      reason,
      to: `/session/${next.id}`,
      cta: next.status === "in_progress" ? "Continue session" : "Start session",
      trackTitle: t.title,
      daysToExam,
      estimatedMinutes: next.estimatedMinutes ?? null,
    });
  }

  // 4. Nothing actionable right now.
  if (candidates.length === 0) {
    const upcoming = resolvedReviews[0]; // all remaining reviews are future-dated
    if (upcoming) {
      const inDays = dayDiff(now, new Date(upcoming.r.dueAt));
      const title = upcoming.resolved!.sub.title;
      candidates.push({
        kind: "upcoming_review",
        label: title,
        reason: `All caught up — next review "${title}" ${inDays === 1 ? "is tomorrow" : `is in ${plural(inDays, "day")}`}`,
        to: `/session/${upcoming.r.subtopicId}?mode=review`,
        cta: "Review early",
        trackTitle: upcoming.resolved!.track.title,
        daysToExam: examDaysAway(upcoming.resolved!.track, now),
        estimatedMinutes: upcoming.resolved!.sub.estimatedMinutes ?? null,
      });
    } else {
      candidates.push({
        kind: "new_track",
        label: "New track",
        reason: "All caught up — every subtopic complete and nothing due for review",
        to: "/onboarding?new=1",
        cta: "Start a new track",
        trackTitle: "",
        daysToExam: null,
        estimatedMinutes: null,
      });
    }
  }

  // Dedupe by destination (a subtopic could be both reviewable and "next" if it
  // was manually un-completed), keep priority order, cap secondaries at 2.
  const seen = new Set<string>();
  const unique = candidates.filter((c) => (seen.has(c.to) ? false : (seen.add(c.to), true)));
  const [primary, ...rest] = unique;
  return { primary, secondary: rest.slice(0, 2) };
}
