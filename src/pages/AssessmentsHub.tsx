/**
 * Quant OA Arena — the firm catalog.
 *
 * Timed replications of the online assessments quant trading firms actually set. See
 * docs/quant-assessment-arena-scope.md for the format research behind each spec.
 *
 * A standalone section by the project owner's decision: it sits in Cortexed but shares none of its
 * machinery — no AppShell, no nav entry, no XP, no concepts, no drill tables. See
 * src/features/assessments/README.md for what that rules out and why.
 */
import { useNavigate } from "react-router-dom";
import { Clock, Play, Timer } from "lucide-react";
import ArenaShell from "@/features/assessments/components/ArenaShell";
import { FIRM_LIST, batteryMinutes } from "@/features/assessments/firms/registry";

export default function AssessmentsHub() {
  const navigate = useNavigate();

  return (
    <ArenaShell>
      <main className="relative mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Online assessments
          </h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
            The first screen quant trading firms actually set, replicated at full fidelity — same
            question counts, same clocks, same marking, same absence of feedback until it is over.
          </p>
        </header>

        <div className="reveal flex flex-col gap-4" style={{ animationDelay: "60ms" }}>
          {FIRM_LIST.map((firm) => (
            <div key={firm.id} className="glass-card rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[19px] font-semibold text-foreground">{firm.name}</h2>
                  <p className="mt-1 max-w-xl text-[14px] text-muted-foreground">{firm.blurb}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {batteryMinutes(firm)} min
                </div>
              </div>

              <ul className="mt-4 flex flex-col divide-y divide-border border-y border-border">
                {firm.modules.map((module) => (
                  <li key={module.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[15px] font-medium text-foreground">
                        {module.name}
                        {module.interviewRound && (
                          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                            Interview round
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[13px] text-muted-foreground">{module.blurb}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-mono text-[12px] tabular-nums text-muted-foreground">
                      <span>{module.itemCount} Q</span>
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {module.durationS !== null
                          ? `${Math.round(module.durationS / 60)} min`
                          : `${Math.round((module.perItemMs ?? 0) / 1000)}s ea`}
                      </span>
                      <span className={module.negativeMarking ? "text-destructive" : ""}>
                        {module.negativeMarking ? "+1 / −1" : "+1 / 0"}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/assessments/${firm.id}/${module.id}`)}
                      className="shrink-0 rounded-lg border border-border px-3.5 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50 hover:bg-secondary/40"
                    >
                      Sit it
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[11px] text-muted-foreground">
                  Format verified {firm.lastVerified}
                </p>
                {firm.modules.filter((m) => !m.interviewRound).length > 1 && (
                  <button
                    onClick={() => navigate(`/assessments/${firm.id}/run`)}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Play className="h-4 w-4" /> Sit the full battery
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="reveal mt-8 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
          Formats are compiled from candidate reports and change between recruiting cycles — each
          card carries the date its format was last confirmed. Every question here is generated;
          none is taken from a real assessment. Not affiliated with, endorsed by, or connected to
          any firm named on this page.
        </p>
      </main>
    </ArenaShell>
  );
}
