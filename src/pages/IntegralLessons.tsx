/**
 * Lessons — the technique library, readable on its own.
 *
 * Training buries the lesson inside a drill; this page is the same material as a place you can just
 * read. Reading is explicitly not progress: the bank counters here only ever move on solves.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, ChevronDown, Map, RotateCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import LessonBody from "@/features/integrals/components/LessonBody";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { useConceptReview } from "@/features/integrals/hooks/useConceptReview";
import { recordConceptRead } from "@/features/integrals/conceptReview";
import { markLessonRead, techniqueMastery } from "@/features/integrals/progress";
import { TECHNIQUE_BY_ID, TECHNIQUES, techniqueName } from "@/features/integrals/techniques";
import { problemsForTechnique } from "@/features/integrals/problems";
import { STANDALONE_TECHNIQUES, TECHNIQUE_FAMILIES } from "@/features/integrals/techniqueMap";
import type { TechniqueId } from "@/features/integrals/types";

/**
 * Where a technique's own name links to. Most have a real drill pool and go to the ordinary
 * training route; the syllabus-completion lessons (see UKUIB_PATH.md) don't have one yet, so
 * linking there would silently bounce back to the technique picker (TrainingTechnique redirects
 * away the moment its pool is empty) — a dead end with no explanation. Their real home today is
 * the UKUIB skill page, which renders the exact same lesson without needing a bank behind it.
 */
function lessonLinkFor(id: TechniqueId): string {
  return problemsForTechnique(id).length > 0 ? `/integrals/train/${id}` : `/ukuib/skill/${id}`;
}

/** One family's card in the technique map: its name, the shared idea underneath, then each member
 *  linked through to its own lesson with the recognition cue that tells it apart from its siblings. */
function FamilyCard({ family }: { family: (typeof TECHNIQUE_FAMILIES)[number] }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <h4 className="font-display text-[15px] font-semibold text-foreground">{family.name}</h4>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        <Tex>{family.bigIdea}</Tex>
      </p>
      <ul className="mt-3 flex flex-col gap-2.5 border-t border-border/60 pt-3">
        {family.members.map((m) => (
          <li key={m.id} className="text-[13px] leading-relaxed text-foreground">
            <Link
              to={lessonLinkFor(m.id)}
              className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:opacity-80"
            >
              {techniqueName(m.id)}
            </Link>
            <span className="text-muted-foreground"> — </span>
            <Tex>{m.cue}</Tex>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The technique map (WS-11): a handful of real ideas instead of twenty-one separate entries.
 *  Static, not another accordion — this is meant to be skimmed as a whole, repeatedly, not drilled
 *  into one card at a time. */
function TechniqueMapSection() {
  return (
    <section className="reveal mb-8">
      <h2 className="flex items-center gap-2 font-display text-[18px] font-semibold tracking-[-0.01em] text-foreground">
        <Map className="h-4 w-4 text-primary" /> The technique map
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
        Twenty-one techniques as a list is twenty-one things to remember. Grouped by the idea
        underneath, it's a handful — recognising which one a problem wants is what separates
        knowing the techniques from seeing the right one.
      </p>

      <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
        Families
      </h3>
      <div className="mt-2 flex flex-col gap-3">
        {TECHNIQUE_FAMILIES.map((family) => (
          <FamilyCard key={family.id} family={family} />
        ))}
      </div>

      <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
        Stand alone
      </h3>
      <div className="mt-2 rounded-2xl border border-border bg-card px-5 py-4">
        <ul className="flex flex-col gap-3">
          {STANDALONE_TECHNIQUES.map((s) => (
            <li key={s.id}>
              <Link
                to={lessonLinkFor(s.id)}
                className="text-[13px] font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:opacity-80"
              >
                {techniqueName(s.id)}
              </Link>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                <Tex>{s.note}</Tex>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function IntegralLessons() {
  const progress = useProgress();
  const { due } = useConceptReview();
  const [open, setOpen] = useState<TechniqueId | null>(null);

  const toggle = (id: TechniqueId) => {
    setOpen((cur) => (cur === id ? null : id));
    if (open !== id) {
      markLessonRead(id);
      recordConceptRead(id);
    }
  };

  return (
    <AppShell>
      <main className="relative mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Lessons
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Every technique, written out — when to reach for it, the recipe, a worked example and the
            traps. Reading doesn't count towards anything; only solved problems do.
          </p>
        </header>

        <TechniqueMapSection />

        {due.length > 0 && (
          <div className="reveal mb-6 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] px-5 py-4">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-primary">
              <RotateCcw className="h-3.5 w-3.5" /> Due for review
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Problems get resurfaced by the scheduler; ideas don't unless you bring them back
              yourself. These haven't been reread in a while.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {due.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className="rounded-full border border-primary/30 bg-card px-3 py-1 text-[13px] text-foreground transition-colors hover:bg-accent/40"
                >
                  {TECHNIQUE_BY_ID[id].name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="reveal flex flex-col gap-3">
          {TECHNIQUES.map((t) => {
            const m = techniqueMastery(progress, t.id);
            const isOpen = open === t.id;
            return (
              <section key={t.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  onClick={() => toggle(t.id)}
                  aria-expanded={isOpen}
                  aria-controls={`${t.id}-lesson-page`}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/40"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2.5">
                      <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-display text-[16px] font-semibold text-foreground">
                        {t.name}
                      </span>
                      {m.lessonRead && (
                        <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                          <Check className="h-3 w-3" /> read
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                      <Tex>{t.tagline}</Tex>
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div id={`${t.id}-lesson-page`} className="border-t border-border px-5 pb-5 pt-4">
                    <LessonBody technique={t} />
                    <Link
                      to={`/integrals/train/${t.id}`}
                      className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Practise this — {m.solved}/{m.total} solved →
                    </Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
