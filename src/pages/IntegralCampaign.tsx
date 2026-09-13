/**
 * The campaign — a dated training track counted back from Round 1 (WS-7, UK_BEE_BURST.md).
 *
 * Everything this page shows already exists elsewhere: recognition, training, paper mode, the
 * values deck and the progress/error-profile page. What was missing was the thing that decides
 * which of them today calls for — a solo competitor with no coach otherwise has to self-administer
 * a ten-week programme from a document, which is exactly the kind of plan that gets abandoned in
 * week three. This page is the conductor, not a new instrument.
 *
 * Advisory, never a cage: nothing here blocks navigation. Every step is a plain link, and ticking
 * one is a self-report, not a gate — the competitor can always ignore the plan and go drill
 * whatever they know is weak.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Flame,
  Gauge,
  ListChecks,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { useCampaign } from "@/features/integrals/hooks/useCampaign";
import { useAttempts } from "@/features/integrals/hooks/useAttempts";
import {
  computePaperReadiness,
  computeReadiness,
  MIN_READINESS_SAMPLE,
} from "@/features/integrals/uk/campaignReadiness";
import { getPaperHistory } from "@/features/integrals/uk/paperHistory";
import { BLOCKS } from "@/features/integrals/uk/campaign";

function Stat({ value, label, caption }: { value: string; label: string; caption?: string }) {
  return (
    <div>
      <div className="readout text-[22px] font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      {caption && <div className="mt-0.5 text-[11px] text-muted-foreground/70">{caption}</div>}
    </div>
  );
}

function formatDays(n: number): string {
  if (n === 0) return "Today";
  if (n === 1) return "1 day";
  return `${n} days`;
}

function formatRate(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}/day`;
}

function formatSeconds(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}s`;
}

function formatPercent(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

function formatTrend(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return "±0 pts";
  return rounded > 0 ? `+${rounded} pts` : `${rounded} pts`;
}

export default function IntegralCampaign() {
  const campaign = useCampaign();
  const attempts = useAttempts();
  const readiness = useMemo(() => computeReadiness(attempts), [attempts]);
  // Paper history has no live-store subscription (see paperHistory.ts) — read once at mount, the
  // same way the paper page itself reads it for its own "already sat this week" landing state.
  const paperReadiness = useMemo(() => computePaperReadiness(getPaperHistory()), []);
  const [dateDraft, setDateDraft] = useState(campaign.targetDate);

  const { day, steps } = campaign;
  const doneCount = steps.filter((s) => campaign.isStepDone(s.kind)).length;

  const commitDate = (value: string) => {
    setDateDraft(value);
    // A half-typed date (native pickers can emit an empty string mid-edit) is never worth
    // persisting — wait for a real YYYY-MM-DD before writing to the store.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) campaign.setTargetDate(value);
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

        <header className="reveal mb-6">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Campaign
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            A session for today, counted back from Round 1. Advisory only — every step links
            somewhere real, and skipping the plan to drill something specific is never wrong.
          </p>
        </header>

        {/* ── Target date + block ─────────────────────────────────────────────────────── */}
        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="h-4 w-4 text-primary" />
              <div>
                <label htmlFor="campaign-target-date" className="block text-[12px] text-muted-foreground">
                  Round 1 date (change it once your host confirms)
                </label>
                <input
                  id="campaign-target-date"
                  type="date"
                  value={dateDraft}
                  onChange={(e) => commitDate(e.target.value)}
                  className="mt-1 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] text-foreground outline-hidden focus:border-primary/60"
                />
              </div>
            </div>
            <div className="text-right">
              <div className="readout text-[26px] font-semibold leading-none tabular-nums text-foreground">
                {day.finished ? "Done" : formatDays(day.daysRemaining)}
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                {day.finished ? "Round 1 has passed" : "until Round 1"}
              </div>
            </div>
          </div>

          {!day.finished && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-[15px] font-semibold text-foreground">
                  {day.block.name}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  Week {day.weekOut} · block {BLOCKS.findIndex((b) => b.id === day.block.id) + 1} of{" "}
                  {BLOCKS.length}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">{day.block.aim}</p>
            </div>
          )}
        </section>

        {day.finished ? (
          <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 text-[14px] text-muted-foreground sm:p-6">
            The target date has passed, so there is no session to plan. If Round 1 is still ahead —
            a different date, or a later round — set it above and today's session picks back up.
          </section>
        ) : (
          <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-[17px] font-semibold text-foreground">
                Today's session
              </h2>
              <span className="readout text-[12px] tabular-nums text-muted-foreground">
                {doneCount}/{steps.length} ticked
              </span>
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {steps.map((step) => {
                const done = campaign.isStepDone(step.kind);
                return (
                  <li
                    key={step.kind}
                    className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                      done ? "border-primary/30 bg-primary/[0.04]" : "border-border"
                    }`}
                  >
                    <button
                      onClick={() => campaign.toggleStep(step.kind)}
                      aria-pressed={done}
                      aria-label={`Mark "${step.label}" as ${done ? "not done" : "done"}`}
                      className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                    >
                      {done ? (
                        <CheckCircle2 className="h-[18px] w-[18px] text-primary" />
                      ) : (
                        <Circle className="h-[18px] w-[18px]" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[14px] font-medium ${
                          done ? "text-muted-foreground line-through" : "text-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{step.why}</p>
                    </div>
                    <Link
                      to={step.route}
                      className="mt-0.5 shrink-0 text-[13px] font-medium text-foreground transition-transform hover:translate-x-0.5"
                    >
                      Go →
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Adherence ────────────────────────────────────────────────────────────────── */}
        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <h2 className="font-display text-[17px] font-semibold text-foreground">Adherence</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            The streak that matters here is showing up, not solving.
          </p>
          <div className="mt-4 flex flex-wrap gap-8">
            <Stat value={`${campaign.sessionsCompleted}`} label="sessions completed" />
            <Stat value={`${campaign.streak}`} label="day streak" />
          </div>
        </section>

        {/* ── Readiness ────────────────────────────────────────────────────────────────── */}
        <section className="reveal rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h2 className="font-display text-[17px] font-semibold text-foreground">Readiness</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Last {readiness.windowDays} days, from every attempt logged across training, sprint,
            daily and paper mode ({readiness.attemptsInWindow} in this window).
          </p>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Stat
              value={formatRate(readiness.attemptRate)}
              label="attempt rate"
              caption={
                readiness.attemptRate === null
                  ? `Not enough data yet — need ${MIN_READINESS_SAMPLE}+ attempts this window`
                  : undefined
              }
            />
            <Stat
              value={formatSeconds(readiness.medianRecognitionSeconds)}
              label="median recognition time"
              caption={
                readiness.medianRecognitionSeconds === null
                  ? `Not enough data yet — need ${MIN_READINESS_SAMPLE}+ timed attempts`
                  : "problem-appears to first keystroke"
              }
            />
            <Stat
              value={formatPercent(readiness.errorRate)}
              label="error rate"
              caption={
                readiness.errorRate === null
                  ? `Not enough data yet — need ${MIN_READINESS_SAMPLE}+ attempts this window`
                  : "of attempts, not graded correct"
              }
            />
          </div>

          {paperReadiness.sittings > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground/80">
                From {paperReadiness.sittings} paper sitting{paperReadiness.sittings === 1 ? "" : "s"}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-3">
                <Stat
                  value={formatSeconds(paperReadiness.accessiblePaceSeconds)}
                  label="Q1–10 pace"
                  caption="median seconds per accessible question"
                />
                <Stat
                  value={formatPercent(paperReadiness.tailReachRate)}
                  label="tail reach"
                  caption={
                    paperReadiness.tailReachRate === null
                      ? "Not enough data yet — sit another paper"
                      : `of Q21–30 actually opened (n=${paperReadiness.tailReachSampleSize})`
                  }
                />
                <Stat
                  value={
                    paperReadiness.scoreTrend
                      ? formatTrend(paperReadiness.scoreTrend.deltaPercentagePoints)
                      : "—"
                  }
                  label="score trend"
                  caption={
                    paperReadiness.scoreTrend
                      ? `vs your first sitting (${paperReadiness.scoreTrend.firstScore}/${paperReadiness.scoreTrend.firstTotal})`
                      : "Not enough data yet — needs a second sitting"
                  }
                />
              </div>
            </div>
          )}
        </section>

        {campaign.streak > 0 && (
          <p className="mt-6 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-primary" />
            {campaign.streak === 1
              ? "First day on the plan — come back tomorrow."
              : `${campaign.streak} days in a row showing up.`}
          </p>
        )}
      </main>
    </AppShell>
  );
}
