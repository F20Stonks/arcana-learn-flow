import { Check, Circle, CornerDownRight, Flag } from "lucide-react";

export interface PlanOutline {
  coreIdea: string;
  /** The claims the lesson establishes, in order — the route, not the reasoning. */
  steps: string[];
  checkpointCount: number;
  notation: { symbol: string; readAs: string }[];
}

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "to", "is", "are", "and", "or", "in", "on", "for", "that", "this", "it",
  "its", "as", "by", "with", "from", "be", "been", "can", "we", "you", "at", "if", "then", "than",
  "which", "when", "into", "any", "all", "not", "so", "must", "has", "have",
]);

/**
 * Has the lesson reached this step yet?
 *
 * A heuristic, and labelled as one in the UI. The tutor doesn't announce which derivation step it
 * is on, and asking it to would cost a field in every turn — so instead each step's distinctive
 * words are matched against everything the tutor has actually said. Requiring a clear majority
 * keeps a passing mention from ticking a step off prematurely.
 */
function stepReached(step: string, transcript: string): boolean {
  const words = step
    .toLowerCase()
    .replace(/\$[^$]*\$/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  if (words.length === 0) return false;
  const hits = words.filter((w) => transcript.includes(w)).length;
  return hits / words.length >= 0.6;
}

interface Props {
  topicTitle?: string;
  subtopicTitle?: string;
  prerequisites: { name: string; known: boolean }[];
  /** Observable client-side: the student has explained a "why" in their own words. */
  selfExplained: boolean;
  /** Distinct key terms the lesson has established so far. */
  covered: string[];
  turns: number;
  isReview: boolean;
  /** Student-safe slice of the authored lesson plan, when one exists for this subtopic. */
  outline: PlanOutline | null;
  /** Everything the tutor has said, lowercased — used to place the lesson on its route. */
  transcript: string;
}

/**
 * Where the lesson is going, and how far off finishing it is.
 *
 * A deliberate honesty constraint shapes this: the authored lesson plan lives server-side and is
 * never sent to the browser, because it contains the checkpoint answers and the terminal transfer
 * problem (see chat/index.ts). So rather than invent a roadmap, this shows the signals that are
 * genuinely known client-side — what the subtopic rests on, what has actually been established, and
 * the two conditions that decide completion. Nothing here is a guess dressed as a plan.
 */
export default function NavigatorPanel({
  topicTitle, subtopicTitle, prerequisites, selfExplained, covered, turns, isReview, outline, transcript,
}: Props) {
  // Completion is two conditions, not a percentage: explain a why unaided, and solve something
  // novel. Only the first is observable here; the second is the assessor's call at the end.
  const done = (selfExplained ? 1 : 0) + 0;
  const total = 2;

  const reached = outline ? outline.steps.map((s) => stepReached(s, transcript)) : [];
  const reachedCount = reached.filter(Boolean).length;
  // The frontier: the first step not yet established is where the lesson is working right now.
  const currentIndex = reached.findIndex((r) => !r);

  return (
    <div className="h-full overflow-y-auto px-3.5 pb-4 text-[11.5px]">
      <div className="rounded-xl bg-secondary/40 px-3 py-2.5">
        {topicTitle && (
          <p className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">{topicTitle}</p>
        )}
        <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-foreground">{subtopicTitle}</p>
        <p className="mt-1.5 text-[10.5px] text-muted-foreground/80">
          {turns === 0 ? "Not started" : `${turns} exchange${turns === 1 ? "" : "s"} so far`}
        </p>
      </div>

      {outline && (
        <section className="mt-4">
          <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            Heading for
          </p>
          <p className="rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-2 leading-snug text-foreground">
            {outline.coreIdea}
          </p>
        </section>
      )}

      {outline && outline.steps.length > 0 && (
        <section className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">The route</p>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {reachedCount}/{outline.steps.length}
            </span>
          </div>
          <ol className="relative space-y-0.5">
            {outline.steps.map((step, i) => {
              const isDone = reached[i];
              const isCurrent = i === currentIndex;
              return (
                <li key={i} className="relative flex items-start gap-2 rounded-lg px-2 py-1.5">
                  {/* Connector spine, so the steps read as a path rather than a checklist. */}
                  {i < outline.steps.length - 1 && (
                    <span className="absolute left-[13px] top-[22px] h-[calc(100%-10px)] w-px bg-border/70" />
                  )}
                  <span className="relative z-10 mt-px flex h-3 w-3 shrink-0 items-center justify-center">
                    {isDone ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : isCurrent ? (
                      <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                    ) : (
                      <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
                    )}
                  </span>
                  <span
                    className={`leading-snug ${
                      isDone ? "text-muted-foreground" : isCurrent ? "text-foreground" : "text-muted-foreground/60"
                    }`}
                  >
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-1.5 flex items-start gap-1.5 px-2 text-[10px] leading-relaxed text-muted-foreground/55">
            <CornerDownRight className="mt-px h-2.5 w-2.5 shrink-0" />
            Position is inferred from what's been said, so it can run a step behind.
          </p>
        </section>
      )}

      {prerequisites.length > 0 && (
        <section className="mt-4">
          <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            Builds on
          </p>
          <ul className="space-y-0.5">
            {prerequisites.map((p) => (
              <li key={p.name} className="flex items-start gap-2 rounded-lg px-2 py-1">
                {p.known ? (
                  <Check className="mt-px h-3 w-3 shrink-0 text-success" />
                ) : (
                  <Circle className="mt-px h-3 w-3 shrink-0 text-muted-foreground/50" />
                )}
                <span className={`leading-snug ${p.known ? "text-muted-foreground" : "text-foreground"}`}>
                  {p.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {covered.length > 0 && (
        <section className="mt-4">
          <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            Established
          </p>
          <div className="flex flex-wrap gap-1 px-1">
            {covered.map((c) => (
              <span key={c} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/90">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {!isReview && (
        <section className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">To finish</p>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">{done}/{total}</span>
          </div>
          <ul className="space-y-0.5">
            <li className="flex items-start gap-2 rounded-lg px-2 py-1">
              {selfExplained ? (
                <Check className="mt-px h-3 w-3 shrink-0 text-success" />
              ) : (
                <Circle className="mt-px h-3 w-3 shrink-0 text-muted-foreground/50" />
              )}
              <span className={`leading-snug ${selfExplained ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground"}`}>
                Explain a “why” in your own words
              </span>
            </li>
            <li className="flex items-start gap-2 rounded-lg px-2 py-1">
              <Circle className="mt-px h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span className="leading-snug text-foreground">Solve a novel problem unaided</span>
            </li>
          </ul>
          <p className="mt-2 flex items-start gap-1.5 px-2 text-[10px] leading-relaxed text-muted-foreground/60">
            <CornerDownRight className="mt-px h-2.5 w-2.5 shrink-0" />
            The second is judged at the end, from the whole session.
          </p>
          {outline && outline.checkpointCount > 0 && (
            <p className="mt-2 flex items-center gap-1.5 px-2 text-[10px] text-muted-foreground/60">
              <Flag className="h-2.5 w-2.5 shrink-0" />
              {outline.checkpointCount} checkpoints in this lesson
            </p>
          )}
        </section>
      )}

      {outline && outline.notation.length > 0 && (
        <section className="mt-4">
          <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            Notation
          </p>
          <dl className="space-y-1 px-1">
            {outline.notation.map((n) => (
              <div key={n.symbol} className="flex items-baseline gap-2">
                <dt className="shrink-0 font-mono text-[11px] text-primary/90">{n.symbol}</dt>
                <dd className="min-w-0 flex-1 text-[10.5px] leading-snug text-muted-foreground">{n.readAs}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
