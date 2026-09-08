/**
 * The UKUIB course path.
 *
 * One winding spine of units, each a banner followed by its skills as nodes you unlock in order.
 * This is the front door of the course and the only screen that shows the whole shape of it, so it
 * carries the two things a student needs on arrival: where am I, and what do I press.
 *
 * Deliberately its own section rather than another tile on the Integral Arena hub — the Arena is
 * for free-form practice by technique or by paper, and the course is a route through the published
 * syllabus. Both draw on the same bank and the same grader; they answer different questions.
 */
import { Link } from "react-router-dom";
import { Check, ChevronRight, Crown, Flame, Lock, Sparkles, Star, Zap } from "lucide-react";
import AppShell from "@/components/AppShell";
import CrownRing from "@/features/integrals/components/CrownRing";
import { useUkuibProgress } from "@/features/integrals/hooks/useUkuibProgress";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { stats } from "@/features/integrals/progress";
import {
  courseProgress,
  MAX_CROWN,
  nextSkill,
  skillUnlocked,
  UNITS,
  unitUnlocked,
  type Skill,
  type Unit,
} from "@/features/integrals/ukuib/curriculum";
import { checkpointReady } from "@/features/integrals/ukuib/checkpoint";
import { crownState, type UkuibProgress } from "@/features/integrals/ukuib/ukuibProgress";

/** How far a node sits from the centre line, by its position in the unit. */
const OFFSETS = [0, 64, 92, 64, 0, -64, -92, -64];

function NodeState(p: UkuibProgress, skill: Skill, nextId: string | undefined) {
  const state = crownState(p);
  const crown = state.crownOf(skill.id);
  const open = skillUnlocked(skill.id, state);
  return {
    crown,
    open,
    done: crown >= MAX_CROWN,
    isNext: skill.id === nextId,
  };
}

function PathNode({
  skill,
  index,
  progress,
  nextId,
}: {
  skill: Skill;
  index: number;
  progress: UkuibProgress;
  nextId: string | undefined;
}) {
  const { crown, open, done, isNext } = NodeState(progress, skill, nextId);
  const offset = OFFSETS[index % OFFSETS.length];
  const size = 84;

  const ringColor = done ? "text-[var(--xp-gold)]" : "text-primary";
  const shell = [
    "ukuib-node relative grid place-items-center rounded-full",
    open ? "ukuib-node-open" : "opacity-45 saturate-50",
    isNext ? "ukuib-node-next" : "",
    done ? "ukuib-node-done" : "",
  ].join(" ");

  const inner = (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <span className={`absolute inset-0 ${ringColor}`}>
        <CrownRing value={crown} max={MAX_CROWN} size={size} width={4} />
      </span>
      <span className={shell} style={{ width: size - 14, height: size - 14 }}>
        {!open ? (
          <Lock className="h-5 w-5 text-muted-foreground" />
        ) : done ? (
          <Crown className="h-6 w-6 text-[var(--xp-gold)]" />
        ) : crown > 0 ? (
          <span className="readout text-[17px] font-semibold text-foreground">{crown}</span>
        ) : (
          <Star className="h-6 w-6 text-primary" />
        )}
      </span>
    </span>
  );

  const label = (
    <span className="mt-2 block max-w-[150px] text-center text-[12.5px] font-medium leading-tight text-muted-foreground">
      {skill.name}
    </span>
  );

  return (
    <li
      className="relative flex flex-col items-center"
      style={{ transform: `translateX(${offset}px)` }}
    >
      {isNext && (
        <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">
          <Sparkles className="h-3 w-3" /> Start
        </span>
      )}
      {open ? (
        <Link
          to={`/ukuib/skill/${skill.id}`}
          className="group flex flex-col items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${skill.name} — ${crown} of ${MAX_CROWN} crowns`}
        >
          {inner}
          {label}
        </Link>
      ) : (
        <span
          className="flex cursor-not-allowed flex-col items-center"
          aria-label={`${skill.name} — locked`}
        >
          {inner}
          {label}
        </span>
      )}
    </li>
  );
}

function UnitBlock({
  unit,
  index,
  progress,
  nextId,
}: {
  unit: Unit;
  index: number;
  progress: UkuibProgress;
  nextId: string | undefined;
}) {
  const state = crownState(progress);
  const open = unitUnlocked(unit.id, state);
  const passed = state.checkpointPassed(unit.id);
  const earned = unit.skills.reduce((n, s) => n + state.crownOf(s.id), 0);
  const possible = unit.skills.length * MAX_CROWN;

  return (
    <section className="reveal" style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}>
      <header
        className={`ukuib-banner rounded-2xl px-5 py-4 sm:px-6 ${open ? "" : "opacity-55"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="micro-label">
              Unit {index} {unit.syllabus.length > 0 && <>· {unit.syllabus.join(" · ")}</>}
            </p>
            <h2 className="font-display mt-1 text-[19px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[21px]">
              {unit.name}
            </h2>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
              {unit.aim}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <div className="readout text-[15px] font-semibold text-foreground">
                {earned}
                <span className="text-muted-foreground">/{possible}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">crowns</div>
            </div>
            {checkpointReady(unit.id) && (
              <Link
                to={`/ukuib/checkpoint/${unit.id}`}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                  passed
                    ? "border-[var(--xp-gold)]/40 bg-[var(--xp-gold)]/10 text-[var(--xp-gold)]"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                {passed ? <Check className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                {passed ? "Passed" : "Checkpoint"}
              </Link>
            )}
          </div>
        </div>
      </header>

      <ol className="relative mx-auto mt-7 flex max-w-md flex-col items-center gap-7 pb-10">
        {unit.skills.map((skill, i) => (
          <PathNode key={skill.id} skill={skill} index={i} progress={progress} nextId={nextId} />
        ))}
      </ol>
    </section>
  );
}

export default function UkuibPath() {
  const ukuib = useUkuibProgress();
  const arena = useProgress();
  const s = stats(arena);
  const state = crownState(ukuib);
  const next = nextSkill(state);
  const pct = Math.round(courseProgress(state) * 100);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-3xl px-5 pb-28 pt-10 sm:px-8 sm:pt-14">
        <header className="reveal mb-7">
          <p className="micro-label">UK University Integration Bee</p>
          <h1 className="font-display mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[33px]">
            The course
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Ten units, every one of them on the published syllabus, from the A-level bridge to the
            named constants. Short lessons, five crowns a skill, and the scaffolding falls away as
            you climb.
          </p>
        </header>

        <section className="reveal upnext-glow mb-9 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <span className="relative grid h-14 w-14 place-items-center text-primary">
                <CrownRing value={pct} max={100} size={56} width={4} />
                <span className="readout absolute text-[13px] font-semibold text-foreground">
                  {pct}%
                </span>
              </span>
              <div>
                <div className="text-[13px] text-muted-foreground">Course progress</div>
                <div className="font-display text-[17px] font-semibold text-foreground">
                  {next ? next.name : "Every crown earned"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-7">
              <div>
                <div className="readout flex items-center gap-1.5 text-[19px] font-semibold text-foreground">
                  <Flame className="h-4 w-4 text-[var(--streak-flame)]" />
                  {s.streak}
                </div>
                <div className="text-[11.5px] text-muted-foreground">day streak</div>
              </div>
              <div>
                <div className="readout text-[19px] font-semibold text-foreground">{ukuib.xp}</div>
                <div className="text-[11.5px] text-muted-foreground">course XP</div>
              </div>
              {next && (
                <Link
                  to={`/ukuib/lesson/${next.id}`}
                  className="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_8px_24px_-8px_hsl(var(--primary)/0.6)] transition-opacity hover:opacity-90"
                >
                  Continue
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {UNITS.map((unit, i) => (
            <UnitBlock key={unit.id} unit={unit} index={i} progress={ukuib} nextId={next?.id} />
          ))}
        </div>
      </main>
    </AppShell>
  );
}
