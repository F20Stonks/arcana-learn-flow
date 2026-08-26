/**
 * Integral Arena — the hub.
 *
 * Two ways in: the daily integral (one problem, everyone gets the same one, scored and shareable)
 * and training (pick a technique, read the lesson, drill it). Everything else on this page exists
 * to show the player what they've built up — level, streak, mastery, badges.
 */
import { Link } from "react-router-dom";
import { Check, Dumbbell, Flame, Sigma, Trophy, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import XpBar from "@/features/integrals/components/XpBar";
import { DifficultyStars } from "@/features/integrals/components/IntegralPrompt";
import { integralLatex } from "@/features/integrals/latex";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { dailyNumber, dailyProblem, WEEKDAY_NAMES } from "@/features/integrals/daily";
import { allMastery, BADGES, stats, todaysDaily } from "@/features/integrals/progress";
import { TECHNIQUE_BY_ID } from "@/features/integrals/techniques";
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
  const today = dailyProblem();
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
            One integral a day, the same one for everyone — plus a training room where you can learn a
            technique and then grind it until it's reflex.
          </p>
        </header>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <XpBar xp={progress.xp} />
          <div className="mt-5 flex flex-wrap gap-8">
            <Stat value={`${s.streak}`} label={s.streak === 1 ? "day streak" : "day streak"} />
            <Stat value={`${s.longestStreak}`} label="longest" />
            <Stat value={`${s.dailiesSolved}`} label="dailies solved" />
            <Stat value={`${s.solvedCount}/${s.totalProblems}`} label="bank cleared" />
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
                  {WEEKDAY_NAMES[new Date().getDay()]} · {DIFFICULTY_LABEL[today.difficulty]}
                </span>
              </div>
              <DifficultyStars level={today.difficulty} />
            </div>

            <div className="my-6 overflow-x-auto text-center">
              {record ? (
                <Tex block className="text-foreground">
                  {integralLatex(today)}
                </Tex>
              ) : (
                <Tex block className="text-foreground blur-[7px] select-none">
                  {integralLatex(today)}
                </Tex>
              )}
            </div>

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

        <section className="reveal mb-6 grid gap-4 sm:grid-cols-2">
          <Link
            to="/integrals/train"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <Dumbbell className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">Training</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Eight techniques, each with a lesson on when to reach for it and a practice queue that
              starts with what you haven't cracked yet.
            </p>
            <span className="mt-3 inline-block text-[13px] font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              Train →
            </span>
          </Link>

          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-muted-foreground">
              Head to head
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Daily leaderboards and friend duels. Scores are already computed and stored per day —
              this is waiting on the server side, not on the game.
            </p>
          </div>
        </section>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-[17px] font-semibold text-foreground">Technique mastery</h2>
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
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-[width] duration-500"
                    style={{ width: `${Math.round(m.mastery * 100)}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="reveal rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="font-display text-[17px] font-semibold text-foreground">Badges</h2>
            <span className="readout text-[12px] tabular-nums text-muted-foreground">
              {earned.size}/{BADGES.length}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {BADGES.map((b) => {
              const has = earned.has(b.id);
              return (
                <span
                  key={b.id}
                  title={b.description}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${
                    has
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground/50"
                  }`}
                >
                  <span aria-hidden>{b.icon}</span>
                  {b.name}
                </span>
              );
            })}
          </div>
        </section>

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
