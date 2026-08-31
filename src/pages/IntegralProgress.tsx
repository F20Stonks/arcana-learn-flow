/**
 * Progress — everything the game has recorded about you, in one place.
 *
 * The hub shows the headline numbers because they belong next to the thing you are about to play.
 * The detail lives here: the calendar, what fraction of each difficulty you have cleared, where
 * each technique stands, and every sprint best.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Flame, Timer, Trophy } from "lucide-react";
import AppShell from "@/components/AppShell";
import XpBar from "@/features/integrals/components/XpBar";
import DailyHeatmap from "@/features/integrals/components/DailyHeatmap";
import ActivityHeatmap from "@/features/integrals/components/ActivityHeatmap";
import DifficultyBars from "@/features/integrals/components/DifficultyBars";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { useAttempts } from "@/features/integrals/hooks/useAttempts";
import { allMastery, BADGES, stats } from "@/features/integrals/progress";
import { historySummary } from "@/features/integrals/history";
import { TECHNIQUE_BY_ID } from "@/features/integrals/techniques";
import { BAND_BY_ID, DURATIONS, BANDS } from "@/features/integrals/sprint";
import { buildErrorProfile, ERROR_CLASSES, type ErrorClass } from "@/features/integrals/errorTaxonomy";

const ERROR_CLASS_LABEL: Record<ErrorClass, string> = {
  "constant-factor": "Constant factor",
  "sign-flip": "Sign flip",
  "missing-absolute-value": "Missing absolute value",
  "right-family-wrong-parameter": "Right family, wrong parameter",
  "correct-but-unsimplified": "Correct, unsimplified",
  "wrong-method": "Wrong method",
};

function Tile({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div
        className={`readout text-[26px] font-semibold leading-none tabular-nums ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">{label}</div>
    </div>
  );
}

export default function IntegralProgress() {
  const progress = useProgress();
  const attempts = useAttempts();
  const s = stats(progress);
  const history = historySummary(progress);
  const mastery = allMastery(progress);
  const errorProfile = useMemo(() => buildErrorProfile(attempts), [attempts]);
  const earned = new Set(s.badges.map((b) => b.id));
  const turnout = history.span > 0 ? Math.round((history.played / history.span) * 100) : 0;
  const sprintRows = BANDS.flatMap((band) =>
    DURATIONS.map((seconds) => ({
      band: band.id,
      seconds,
      best: progress.sprints[`${band.id}-${seconds}`],
    })),
  ).filter((row) => row.best);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Progress
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            {history.played === 0
              ? "Nothing recorded yet. Play a daily and this fills in."
              : `${history.played} dailies attempted, ${history.solved} solved, ${s.solvedCount} of ${s.totalProblems} problems in the bank beaten.`}
          </p>
        </header>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <XpBar xp={progress.xp} />
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Tile value={`${s.streak}`} label="day streak" accent={s.streak > 0} />
            <Tile value={`${s.longestStreak}`} label="longest streak" />
            <Tile value={`${turnout}%`} label="days turned up" />
            <Tile value={`${history.bestScore}`} label="best single day" />
          </div>
        </section>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <DailyHeatmap progress={progress} />
        </section>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <ActivityHeatmap progress={progress} />
        </section>

        <div className="reveal mb-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <DifficultyBars progress={progress} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-[17px] font-semibold text-foreground">Techniques</h2>
            <ul className="flex flex-col gap-3">
              {mastery.map((m) => (
                <li key={m.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <Link
                      to={`/integrals/train/${m.id}`}
                      className="text-[13px] text-foreground transition-colors hover:text-primary"
                    >
                      {TECHNIQUE_BY_ID[m.id].name}
                    </Link>
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
                    className="h-2 w-full overflow-hidden rounded-[4px] bg-accent"
                  >
                    <div
                      className="h-full rounded-r-[4px] transition-[width] duration-500"
                      style={{
                        width: `${Math.max(m.mastery > 0 ? 2 : 0, m.mastery * 100)}%`,
                        backgroundColor: "var(--heat-3)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            <h2 className="font-display text-[17px] font-semibold text-foreground">Sprint bests</h2>
          </div>
          {sprintRows.length === 0 ? (
            <p className="text-[14px] text-muted-foreground">
              No sprints yet.{" "}
              <Link to="/integrals/sprint" className="text-foreground underline underline-offset-2">
                Run one
              </Link>{" "}
              and its best lands here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Setting</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Best</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Solved</th>
                    <th scope="col" className="py-2 text-right font-medium">Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {sprintRows.map((row) => (
                    <tr key={`${row.band}-${row.seconds}`} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3 text-foreground">
                        {BAND_BY_ID[row.band].name} · {row.seconds / 60} min
                      </td>
                      <td className="readout py-2 pr-3 text-right tabular-nums text-primary">
                        {row.best!.score}
                      </td>
                      <td className="readout py-2 pr-3 text-right tabular-nums text-muted-foreground">
                        {row.best!.solved}
                      </td>
                      <td className="readout py-2 text-right tabular-nums text-muted-foreground">
                        {row.best!.runs}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h2 className="font-display text-[17px] font-semibold text-foreground">Error profile</h2>
          </div>
          <p className="mb-4 text-[13px] text-muted-foreground">
            Every wrong attempt, classified by why — a dropped sign is worth fixing differently
            from a genuinely wrong method.
          </p>
          {errorProfile.classifiedAttempts === 0 ? (
            <p className="text-[14px] text-muted-foreground">
              Not enough classified misses yet — keep training and this fills in.
            </p>
          ) : (
            <>
              {errorProfile.dominant && (
                <p className="mb-4 text-[14px] text-foreground">
                  Most common:{" "}
                  <span className="font-medium text-primary">{ERROR_CLASS_LABEL[errorProfile.dominant]}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {errorProfile.counts[errorProfile.dominant]} of {errorProfile.classifiedAttempts} classified
                    misses.
                  </span>
                </p>
              )}

              <ul className="mb-5 flex flex-col gap-2.5">
                {ERROR_CLASSES.filter((cls) => (errorProfile.counts[cls] ?? 0) > 0)
                  .sort((a, b) => (errorProfile.counts[b] ?? 0) - (errorProfile.counts[a] ?? 0))
                  .map((cls) => {
                    const n = errorProfile.counts[cls] ?? 0;
                    const pct = (n / errorProfile.classifiedAttempts) * 100;
                    return (
                      <li key={cls}>
                        <div className="mb-1 flex items-baseline justify-between gap-3">
                          <span className="text-[13px] text-foreground">{ERROR_CLASS_LABEL[cls]}</span>
                          <span className="readout text-[12px] tabular-nums text-muted-foreground">{n}</span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={n}
                          aria-valuemin={0}
                          aria-valuemax={errorProfile.classifiedAttempts}
                          aria-label={`${ERROR_CLASS_LABEL[cls]}: ${n} of ${errorProfile.classifiedAttempts} classified misses`}
                          className="h-1.5 w-full overflow-hidden rounded-full bg-accent"
                        >
                          <div
                            className="h-full rounded-full bg-primary/70 transition-[width] duration-500"
                            style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>

              {errorProfile.byTechnique.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Technique
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Most common miss
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          Classified
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorProfile.byTechnique.map((t) => (
                        <tr key={t.technique} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3">
                            <Link
                              to={`/integrals/train/${t.technique}`}
                              className="text-foreground transition-colors hover:text-primary"
                            >
                              {TECHNIQUE_BY_ID[t.technique].name}
                            </Link>
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">{ERROR_CLASS_LABEL[t.dominant]}</td>
                          <td className="readout py-2 text-right tabular-nums text-muted-foreground">{t.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        <section className="reveal rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="font-display text-[17px] font-semibold text-foreground">Badges</h2>
            <span className="readout text-[12px] tabular-nums text-muted-foreground">
              {earned.size}/{BADGES.length}
            </span>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {BADGES.map((b) => {
              const has = earned.has(b.id);
              return (
                <li
                  key={b.id}
                  className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${
                    has ? "border-primary/40 bg-primary/[0.06]" : "border-border"
                  }`}
                >
                  <span aria-hidden className="mt-0.5 text-[14px]">
                    {b.icon}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-[13px] font-medium ${has ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {b.name}
                      <span className="sr-only">{has ? " — earned" : " — locked"}</span>
                    </span>
                    <span className="block text-[12px] leading-snug text-muted-foreground">
                      {b.description}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {s.streak > 0 && (
          <p className="mt-6 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-primary" />
            Keep the streak and the daily multiplier climbs to 1.5× at ten days.
          </p>
        )}
      </main>
    </AppShell>
  );
}
