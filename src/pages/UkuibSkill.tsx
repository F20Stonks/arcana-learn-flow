/**
 * A skill's own page: where you are in it, what the next lesson will ask of you, and the full
 * reference lesson underneath.
 *
 * This sits between the path and the player deliberately. Tapping a node straight into a lesson
 * would be faster, but it would also mean the only way to re-read the teaching is to start a
 * scored run — and the reference text is the thing a student comes back to when they are stuck,
 * which is exactly when they least want a clock and five hearts.
 */
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Crown, Lock } from "lucide-react";
import AppShell from "@/components/AppShell";
import LessonBody from "@/features/integrals/components/LessonBody";
import CrownRing from "@/features/integrals/components/CrownRing";
import { TECHNIQUE_BY_ID } from "@/features/integrals/techniques";
import { problemsForTechnique } from "@/features/integrals/problems";
import { useUkuibProgress } from "@/features/integrals/hooks/useUkuibProgress";
import {
  MAX_CROWN,
  SKILL_BY_ID,
  skillUnlocked,
  unitOf,
} from "@/features/integrals/ukuib/curriculum";
import { SHAPES } from "@/features/integrals/ukuib/lesson";
import { crownState } from "@/features/integrals/ukuib/ukuibProgress";

/** Plain-English description of what the next lesson is going to be like, from its shape. */
function describeShape(crown: number): string {
  const shape = SHAPES[Math.min(crown, SHAPES.length - 1)];
  const bits: string[] = [];
  if (shape.teach) bits.push("a tip card");
  if (shape.recognise) bits.push(`${shape.recognise} recognition question${shape.recognise > 1 ? "s" : ""}`);
  if (shape.order) bits.push("a method-ordering task");
  if (shape.complete) bits.push(`${shape.complete} finish-the-solution step${shape.complete > 1 ? "s" : ""}`);
  if (shape.value) bits.push("a known-value question");
  if (shape.solve) bits.push(`${shape.solve} full problems`);
  if (shape.review) bits.push(`${shape.review} from earlier skills`);
  const list =
    bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}` : bits[0];
  return `${list}. ${shape.hintsAllowed ? "Hints available." : "No hints."}`;
}

export default function UkuibSkill() {
  const { skillId = "" } = useParams();
  const progress = useUkuibProgress();
  const skill = SKILL_BY_ID[skillId];
  const unit = unitOf(skillId);

  if (!skill || !unit) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <p className="text-[15px] text-muted-foreground">That skill doesn't exist.</p>
          <Link to="/ukuib" className="mt-4 inline-block text-[14px] text-primary">
            Back to the path
          </Link>
        </main>
      </AppShell>
    );
  }

  const state = crownState(progress);
  const crown = state.crownOf(skill.id);
  const open = skillUnlocked(skill.id, state);
  const done = crown >= MAX_CROWN;
  const record = progress.skills[skill.id];
  const lesson = skill.technique ? TECHNIQUE_BY_ID[skill.technique] : undefined;
  const poolSize = skill.technique ? problemsForTechnique(skill.technique).length : 0;

  return (
    <AppShell>
      <main className="relative mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <Link
          to="/ukuib"
          className="group mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          {unit.name}
        </Link>

        <header className="reveal ukuib-banner mb-6 rounded-2xl px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <span
                className={`relative grid place-items-center ${done ? "text-[var(--xp-gold)]" : "text-primary"}`}
                style={{ width: 64, height: 64 }}
              >
                <CrownRing value={crown} max={MAX_CROWN} size={64} width={4} />
                <span className="absolute grid place-items-center">
                  {done ? (
                    <Crown className="h-6 w-6 text-[var(--xp-gold)]" />
                  ) : (
                    <span className="readout text-[16px] font-semibold text-foreground">
                      {crown}
                      <span className="text-muted-foreground">/{MAX_CROWN}</span>
                    </span>
                  )}
                </span>
              </span>
              <div className="min-w-0">
                <p className="micro-label">{unit.name}</p>
                <h1 className="font-display mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[28px]">
                  {skill.name}
                </h1>
                <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
                  {skill.blurb}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="reveal mb-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
          {!open ? (
            <div className="flex items-center gap-3 text-[14px] text-muted-foreground">
              <Lock className="h-4 w-4" />
              Finish the skill before this one to unlock it.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="micro-label">
                    {done ? "Practice" : `Crown ${crown + 1} of ${MAX_CROWN}`}
                  </p>
                  <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-foreground">
                    {describeShape(crown)}
                  </p>
                </div>
                <Link
                  to={`/ukuib/lesson/${skill.id}`}
                  className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-[14.5px] font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_10px_28px_-10px_hsl(var(--primary)/0.7)] transition-opacity hover:opacity-90"
                >
                  {crown === 0 ? "Start" : done ? "Practise" : "Continue"}
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
              {record && (
                <div className="mt-5 flex flex-wrap gap-7 border-t border-border pt-4">
                  <div>
                    <div className="readout text-[16px] font-semibold text-foreground">
                      {record.lessonsDone}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">lessons done</div>
                  </div>
                  <div>
                    <div className="readout text-[16px] font-semibold text-foreground">
                      {Math.round(record.bestAccuracy * 100)}%
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">best accuracy</div>
                  </div>
                  {poolSize > 0 && (
                    <div>
                      <div className="readout text-[16px] font-semibold text-foreground">
                        {poolSize}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">problems behind it</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {lesson ? (
          <section className="reveal rounded-2xl border border-border bg-card p-5 sm:p-7">
            <p className="micro-label mb-4">Reference</p>
            <LessonBody technique={lesson} />
          </section>
        ) : (
          <section className="reveal rounded-2xl border border-border bg-card p-5 text-[14px] text-muted-foreground sm:p-7">
            No single technique behind this one — it draws on everything you have met so far.
          </section>
        )}
      </main>
    </AppShell>
  );
}
