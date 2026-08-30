/**
 * Lessons — the technique library, readable on its own.
 *
 * Training buries the lesson inside a drill; this page is the same material as a place you can just
 * read. Reading is explicitly not progress: the bank counters here only ever move on solves.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, ChevronDown, RotateCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import LessonBody from "@/features/integrals/components/LessonBody";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { useConceptReview } from "@/features/integrals/hooks/useConceptReview";
import { recordConceptRead } from "@/features/integrals/conceptReview";
import { markLessonRead, techniqueMastery } from "@/features/integrals/progress";
import { TECHNIQUE_BY_ID, TECHNIQUES } from "@/features/integrals/techniques";
import type { TechniqueId } from "@/features/integrals/types";

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
