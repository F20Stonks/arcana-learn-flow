/**
 * OA Arena — the hub.
 *
 * Every firm whose online assessment this app can reconstruct, with what each one actually asks.
 * The fidelity note is on this page, on every firm page and before every run, not once in a
 * footer: a candidate who thinks they are sitting the real thing will draw the wrong conclusion
 * from their score.
 */
import { Link } from "react-router-dom";
import { Building2, Clock, Info, ListChecks } from "lucide-react";
import AppShell from "@/components/AppShell";
import { FIDELITY_NOTE, FIRMS } from "@/features/oa/firms";
import { assessmentShape } from "@/features/oa/generate";
import { bestFor, sittingsCount, useOaProgress } from "@/features/oa/progress";

function minutes(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)} min`;
}

export function FidelityNote({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2.5 rounded-xl border border-border bg-accent/30 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground ${className}`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
      <span>{FIDELITY_NOTE}</span>
    </p>
  );
}

export default function OAHub() {
  const progress = useOaProgress();
  const counts = sittingsCount(progress);
  const totalAssessments = FIRMS.reduce((n, f) => n + f.assessments.length, 0);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <header className="reveal mb-6">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            OA Arena
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            {totalAssessments} assessments across {FIRMS.length} trading firms, each built to the
            shape the real screen is reported to have — the question types, the counts, the clock,
            and the rule that you cannot go back.
          </p>
        </header>

        <FidelityNote className="reveal mb-6" />

        {counts.assessments > 0 && (
          <p className="reveal mb-6 text-[13px] text-muted-foreground">
            <span className="readout tabular-nums text-foreground">{counts.assessments}</span> of{" "}
            <span className="readout tabular-nums">{totalAssessments}</span> assessments sat,{" "}
            <span className="readout tabular-nums">{counts.total}</span> sittings in total.
          </p>
        )}

        <div className="reveal flex flex-col gap-3">
          {FIRMS.map((firm) => {
            const sat = firm.assessments.filter((a) => bestFor(progress, a)).length;
            return (
              <Link
                key={firm.id}
                to={`/oa/${firm.id}`}
                className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold text-foreground">
                    <Building2 className="h-4 w-4 text-primary" />
                    {firm.name}
                  </h2>
                  <span className="readout text-[12px] tabular-nums text-muted-foreground">
                    {sat}/{firm.assessments.length} sat
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{firm.blurb}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {firm.assessments.map((a) => {
                    const shape = assessmentShape(a);
                    return (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground"
                      >
                        <span className="text-foreground">{a.name}</span>
                        <span className="readout flex items-center gap-1 tabular-nums">
                          <ListChecks className="h-3 w-3" />
                          {shape.questions}
                        </span>
                        <span className="readout flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" />
                          {minutes(shape.seconds)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Link>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
