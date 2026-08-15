// Review scheduling.
//
// What was here before was an admitted placeholder: multiply the interval by 1.3 / 1.6 / 2.5 by
// confidence, or by 0.4 on a lapse. That is blind doubling — it has no model of how memory decays,
// so it cannot tell a subtopic you have nearly forgotten from one you have almost automated, and it
// treats the fifth successful review exactly like the first.
//
// FSRS models stability (how long the memory lasts), difficulty (how hard this material is for this
// person) and retrievability (how likely recall is right now), and schedules the next review for the
// point where recall probability falls to a target. It is the algorithm Anki moved to, and ts-fsrs is
// the reference implementation.
//
// GRAIN CAVEAT, stated because it matters: FSRS was designed for flashcards graded per card, and this
// applies it per SUBTOPIC SESSION. The mapping from a session's confidence verdict to a four-point
// rating is a judgement, not a result — an honest improvement on fixed multipliers, not a validated
// model at this grain. Worth revisiting once `subtopic_reviews` has enough real history to compare.
//
// Everything degrades: if the import fails, or the library throws, callers fall back to the previous
// multiplier behaviour rather than losing a review.

const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 365;

export interface ReviewState {
  interval_days: number;
  stability: number | null;
  difficulty: number | null;
  reps: number;
  lapses: number;
  fsrs_state: number | null;
  last_review: string | null;
}

export interface NextReview {
  interval_days: number;
  next_review_due_at: string;
  stability: number | null;
  difficulty: number | null;
  reps: number;
  lapses: number;
  fsrs_state: number | null;
  last_review: string;
  /** which scheduler actually produced this — recorded so the logs never have to guess */
  engine: "fsrs" | "fallback";
}

/** The judgement call. A lapse is Again; otherwise confidence picks Hard / Good / Easy. */
function ratingFor(complete: boolean, confidence: "low" | "medium" | "high"): number {
  if (!complete) return 1; // Again
  if (confidence === "low") return 2; // Hard
  if (confidence === "high") return 4; // Easy
  return 3; // Good
}

const clampDays = (d: number) => Math.max(MIN_INTERVAL_DAYS, Math.min(MAX_INTERVAL_DAYS, Math.round(d)));

/** The previous behaviour, kept intact as the degradation path. */
function fallbackSchedule(prev: ReviewState, complete: boolean, confidence: "low" | "medium" | "high"): NextReview {
  const GROWTH: Record<string, number> = { low: 1.3, medium: 1.6, high: 2.5 };
  const current = prev.interval_days || 7;
  const next = complete ? current * GROWTH[confidence] : current * 0.4;
  const days = clampDays(next);
  const now = new Date();
  return {
    interval_days: days,
    next_review_due_at: new Date(now.getTime() + days * 86400000).toISOString(),
    stability: prev.stability,
    difficulty: prev.difficulty,
    reps: (prev.reps || 0) + 1,
    lapses: (prev.lapses || 0) + (complete ? 0 : 1),
    fsrs_state: prev.fsrs_state,
    last_review: now.toISOString(),
    engine: "fallback",
  };
}

export async function scheduleNextReview(
  prev: ReviewState,
  complete: boolean,
  confidence: "low" | "medium" | "high",
): Promise<NextReview> {
  const now = new Date();
  try {
    // Imported lazily so a resolution failure costs one review's scheduling quality, never the
    // whole completion pipeline.
    const mod = await import("npm:ts-fsrs@4.4.1");
    const { fsrs, generatorParameters, createEmptyCard } = mod as unknown as {
      fsrs: (p: unknown) => { next: (card: unknown, now: Date, rating: number) => { card: Record<string, unknown> } };
      generatorParameters: (o?: unknown) => unknown;
      createEmptyCard: (d?: Date) => Record<string, unknown>;
    };

    const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

    // Rebuild the card from stored state; a row that predates FSRS starts from an empty card, which
    // is the correct bootstrap — its history is a single interval number, not a memory model.
    const card: Record<string, unknown> =
      prev.stability != null && prev.difficulty != null
        ? {
            ...createEmptyCard(now),
            stability: prev.stability,
            difficulty: prev.difficulty,
            reps: prev.reps || 0,
            lapses: prev.lapses || 0,
            state: prev.fsrs_state ?? 2,
            last_review: prev.last_review ? new Date(prev.last_review) : undefined,
            due: now,
          }
        : createEmptyCard(now);

    const result = scheduler.next(card, now, ratingFor(complete, confidence));
    const c = result.card;

    const due = new Date(c.due as string | number | Date);
    const days = clampDays((due.getTime() - now.getTime()) / 86400000);
    if (!Number.isFinite(days)) throw new Error("FSRS returned an unusable due date");

    return {
      interval_days: days,
      next_review_due_at: new Date(now.getTime() + days * 86400000).toISOString(),
      stability: typeof c.stability === "number" ? c.stability : null,
      difficulty: typeof c.difficulty === "number" ? c.difficulty : null,
      reps: typeof c.reps === "number" ? c.reps : (prev.reps || 0) + 1,
      lapses: typeof c.lapses === "number" ? c.lapses : (prev.lapses || 0) + (complete ? 0 : 1),
      fsrs_state: typeof c.state === "number" ? c.state : null,
      last_review: now.toISOString(),
      engine: "fsrs",
    };
  } catch (e) {
    console.error("FSRS scheduling unavailable, using fallback multipliers:", e instanceof Error ? e.message : e);
    return fallbackSchedule(prev, complete, confidence);
  }
}
