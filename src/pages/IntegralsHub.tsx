/**
 * Integral Arena — the hub.
 *
 * Two ways in: the daily integral (one problem, everyone gets the same one, scored and shareable)
 * and training (pick a technique, read the lesson, drill it). Everything else on this page exists
 * to show the player what they've built up — level, streak, mastery, badges.
 */
import { Link } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  Dumbbell,
  Flame,
  Layers,
  Sigma,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import XpBar from "@/features/integrals/components/XpBar";
import DailyHeatmap from "@/features/integrals/components/DailyHeatmap";
import ActivityHeatmap from "@/features/integrals/components/ActivityHeatmap";
import { DifficultyStars } from "@/features/integrals/components/IntegralPrompt";
import { integralLatex } from "@/features/integrals/latex";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { dailyNumber, dailyProblems, WEEKDAY_NAMES } from "@/features/integrals/daily";
import { allMastery, BADGES, stats, todaysDaily } from "@/features/integrals/progress";
import { TECHNIQUE_BY_ID, TECHNIQUES } from "@/features/integrals/techniques";
import { DIFFICULTY_LABEL } from "@/features/integrals/problems";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="readout text-[22px] font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
    </div>
  );
}

export default function IntegralsHub() {
  const progress = useProgress();
  const s = stats(progress);
  const today = dailyProblems();
  const record = todaysDaily(progress);
  const mastery = allMastery(progress);
  const earned = new Set(s.badges.map((b) => b.id));

  return (
    <AppShell>
      <main className="relative mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Integral Arena
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Three integrals a day, the same ones for everyone — plus a training room where you can
            learn a technique and then grind it until it's reflex.
          </p>
        </header>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <XpBar xp={progress.xp} />
          <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-wrap gap-8">
              <Stat value={`${s.streak}`} label="day streak" />
              <Stat value={`${s.longestStreak}`} label="longest" />
              <Stat value={`${s.dailiesSolved}`} label="dailies solved" />
              <Stat value={`${s.solvedCount}/${s.totalProblems}`} label="bank cleared" />
            </div>
            <Link
              to="/integrals/progress"
              className="group flex items-center gap-1.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Progress
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            {/* Deliberately the loudest control on the page — competing is the point of the
                Arena, and as a muted text link nobody found it. */}
            <Link
              to="/leaderboards"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_8px_24px_-8px_hsl(var(--primary)/0.6)] transition-opacity hover:opacity-90"
            >
              <Trophy className="h-4 w-4" /> Leaderboards
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </section>

        <section className="reveal mb-6">
          <Link
            to="/integrals/daily"
            className="group block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sigma className="h-4 w-4 text-primary" />
                <span className="font-display text-[17px] font-semibold text-foreground">
                  Daily #{dailyNumber()}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {WEEKDAY_NAMES[new Date().getDay()]} · {DIFFICULTY_LABEL[today[0].difficulty]} ·{" "}
                  {today.length} integrals
                </span>
              </div>
              <DifficultyStars level={today[0].difficulty} />
            </div>

            {/* Blur hides the problem from sight but not from assistive tech, which would read
                the integral out and spoil it. Hide it outright and say what's there instead. */}
            <div
              className="my-6 overflow-x-auto text-center"
              aria-hidden={record ? undefined : true}
            >
              <Tex block className={`text-foreground ${record ? "" : "blur-[7px] select-none"}`}>
                {integralLatex(today[0])}
              </Tex>
            </div>
            {!record && (
              <p className="sr-only">Today's {today.length} integrals are hidden until you start the run.</p>
            )}

            <div className="flex items-center justify-between text-[13px]">
              {record ? (
                record.solved ? (
                  <span className="flex items-center gap-1.5 font-medium text-primary">
                    <Check className="h-3.5 w-3.5" /> Solved for {record.score} points
                  </span>
                ) : (
                  <span className="text-muted-foreground">Attempted — see the solution</span>
                )
              ) : (
                <span className="text-muted-foreground">Not started. The clock starts when you open it.</span>
              )}
              <span className="font-medium text-foreground transition-transform group-hover:translate-x-0.5">
                {record ? "Review →" : "Play →"}
              </span>
            </div>
          </Link>
        </section>

        <div className="reveal mb-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <DailyHeatmap progress={progress} />
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <ActivityHeatmap progress={progress} />
          </section>
        </div>

        <section className="reveal mb-6 grid gap-4 sm:grid-cols-2">
          <Link
            to="/integrals/train"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <Dumbbell className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">Training</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              {TECHNIQUES.length} techniques, each with a lesson on when to reach for it and a practice
              queue that starts with what you haven't cracked yet.
            </p>
            <span className="mt-3 inline-block text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              Train →
            </span>
          </Link>

          <Link
            to="/integrals/lessons"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">Lessons</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Every technique written out in one place — read them straight through without starting a
              drill. Reading isn't scored.
            </p>
            <span className="mt-3 inline-block text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              Read →
            </span>
          </Link>

          <Link
            to="/integrals/sprint"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <Timer className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">Sprint</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              As many as you can before the clock runs out. Pick a difficulty band and a length; harder
              problems are worth more, skipping costs.
            </p>
            <span className="mt-3 inline-block text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              Sprint →
            </span>
          </Link>

          <Link
            to="/integrals/uk/round1"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">UK Round 1</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              The weekly benchmark: 30 problems, 120 minutes, free navigation — the real solo qualifier
              format, with a full pacing report at the end.
            </p>
            <span className="mt-3 inline-block text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              Sit the paper →
            </span>
          </Link>

          <Link
            to="/integrals/recognition"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">Name the weapon</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              The integrand, four techniques, three seconds — no solving. Recognising the right move
              on sight is most of the clock on an accessible question.
            </p>
            <span className="mt-3 inline-block text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              Drill →
            </span>
          </Link>

          <Link
            to="/integrals/values"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">Values deck</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Flashcards for the results worth having cold — flip and check yourself. Not scored,
              read it like the lessons.
            </p>
            <span className="mt-3 inline-block text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              Study →
            </span>
          </Link>

          <Link
            to="/integrals/campaign"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">Campaign</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              A session for today, counted back from Round 1 — recognition, problems and papers on
              schedule, plus how ready you actually are.
            </p>
            <span className="mt-3 inline-block text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              Plan →
            </span>
          </Link>

          <Link
            to="/integrals/daily"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 sm:col-span-2"
          >
            <Users className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">Head to head</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Everyone gets the same three integrals, so the combined score means something. Solve
              today's and you take a place on its board — ranked by score, then by time. One attempt
              per puzzle, which is what stops it becoming a retry contest.
            </p>
            <span className="mt-3 inline-block text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              {record ? "See the board →" : "Play today's →"}
            </span>
          </Link>
        </section>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-[17px] font-semibold text-foreground">Problems solved by technique</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Bars move only when you solve a problem — reading a lesson doesn't count.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {mastery.map((m) => (
              <Link
                key={m.id}
                to={`/integrals/train/${m.id}`}
                className="group rounded-xl border border-border px-4 py-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-medium text-foreground">
                    {TECHNIQUE_BY_ID[m.id].name}
                  </span>
                  <span className="readout text-[12px] tabular-nums text-muted-foreground">
                    {m.solved}/{m.total}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={m.solved}
                  aria-valuemin={0}
                  aria-valuemax={m.total}
                  aria-label={`${TECHNIQUE_BY_ID[m.id].name}: ${m.solved} of ${m.total} solved`}
                  className="mt-2 h-1 w-full overflow-hidden rounded-full bg-accent"
                >
                  <div
                    className="h-full rounded-full bg-primary/70 transition-[width] duration-500"
                    style={{ width: `${Math.round(m.mastery * 100)}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <Link
          to="/integrals/progress"
          className="reveal group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 sm:p-6"
        >
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="font-display text-[17px] font-semibold text-foreground">Badges</span>
            <span className="readout text-[12px] tabular-nums text-muted-foreground">
              {earned.size}/{BADGES.length}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="flex gap-1.5">
              {s.badges.slice(0, 5).map((b) => (
                <span key={b.id} className="text-[14px]">
                  {b.icon}
                </span>
              ))}
            </span>
            <span className="text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              {earned.size === 0 ? "None yet →" : "See all →"}
            </span>
          </span>
        </Link>

        {s.streak > 0 && (
          <p className="mt-6 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-primary" />
            Come back tomorrow to keep the streak — it's worth up to a 1.5× multiplier.
          </p>
        )}
      </main>
    </AppShell>
  );
}
