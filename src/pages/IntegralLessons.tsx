/**
 * Every technique's lesson, in one place, with nothing else competing for attention — no timer, no
 * queue, no "next problem." For a student who wants to read through the curriculum (or review a
 * technique before a sprint) without committing to a practice run.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Dumbbell } from "lucide-react";
import AppShell from "@/components/AppShell";
import TechniqueLesson from "@/features/integrals/components/TechniqueLesson";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { markLessonRead } from "@/features/integrals/progress";
import { TECHNIQUES } from "@/features/integrals/techniques";
import type { TechniqueId } from "@/features/integrals/types";

export default function IntegralLessons() {
  const progress = useProgress();
  const [openId, setOpenId] = useState<TechniqueId | null>(null);
  const readCount = TECHNIQUES.filter((t) => progress.lessonsRead.includes(t.id)).length;

  const toggle = (id: TechniqueId) => {
    const opening = openId !== id;
    setOpenId(opening ? id : null);
    if (opening) markLessonRead(id);
  };

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        <header className="reveal mb-6">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Lessons
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Every technique in the curriculum — the recognition cue, the recipe, a worked example,
            and where it goes wrong. Read at your own pace; nothing here is timed or scored.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-primary" />
            {readCount}/{TECHNIQUES.length} read
          </p>
        </header>

        <div className="flex flex-col gap-3">
          {TECHNIQUES.map((t) => (
            <TechniqueLesson
              key={t.id}
              technique={t}
              open={openId === t.id}
              onToggle={() => toggle(t.id)}
              title={t.name}
              showTaglineWhenCollapsed
            />
          ))}
        </div>

        <Link
          to="/integrals/train"
          className="reveal mt-8 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Dumbbell className="h-3.5 w-3.5" /> Put it into practice in training
        </Link>
      </main>
    </AppShell>
  );
}
