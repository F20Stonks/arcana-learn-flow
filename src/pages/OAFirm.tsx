/**
 * One firm: who they are, where the OA sits in their process, and every assessment of theirs the
 * arena can reconstruct — with what it does and does not cover said plainly on each one.
 */
import { Link, Navigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Clock, ListChecks, Quote, Trophy } from "lucide-react";
import AppShell from "@/components/AppShell";
import { FIRM_BY_ID } from "@/features/oa/firms";
import { assessmentShape } from "@/features/oa/generate";
import { bestFor, useOaProgress } from "@/features/oa/progress";
import { FidelityNote } from "./OAHub";

function minutes(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)} min`;
}

export default function OAFirm() {
  const { firmId = "" } = useParams();
  const firm = FIRM_BY_ID[firmId];
  const progress = useOaProgress();

  if (!firm) return <Navigate to="/oa" replace />;

  return (
    <AppShell>
      <main className="relative mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/oa"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> OA Arena
        </Link>

        <header className="reveal mb-6">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {firm.name}
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{firm.blurb}</p>

          <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-muted-foreground">
            {firm.process.map((stage, i) => (
              <li key={stage} className="flex items-center gap-2">
                <span
                  className={
                    i === 0 ? "rounded-full bg-primary/15 px-2.5 py-1 font-medium text-primary" : ""
                  }
                >
                  {stage}
                </span>
                {i < firm.process.length - 1 && <span className="text-muted-foreground/40">→</span>}
              </li>
            ))}
          </ol>
        </header>

        <FidelityNote className="reveal mb-6" />

        <div className="reveal flex flex-col gap-4">
          {firm.assessments.map((assessment) => {
            const shape = assessmentShape(assessment);
            const best = bestFor(progress, assessment);
            const uncovered = assessment.rules.filter((r) => r.includes("not simulated here"));
            return (
              <section
                key={assessment.id}
                className="rounded-2xl border border-border bg-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-display text-[18px] font-semibold text-foreground">
                    {assessment.name}
                  </h2>
                  <span className="flex items-center gap-3 text-[12px] text-muted-foreground">
                    <span className="readout flex items-center gap-1.5 tabular-nums">
                      <ListChecks className="h-3.5 w-3.5" /> {shape.questions} questions
                    </span>
                    <span className="readout flex items-center gap-1.5 tabular-nums">
                      <Clock className="h-3.5 w-3.5" /> {minutes(shape.seconds)}
                    </span>
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                  {assessment.format}
                </p>

                <ul className="mt-4 flex flex-col gap-2">
                  {assessment.sections.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-l-2 border-border pl-3 text-[13px]"
                    >
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="readout tabular-nums text-muted-foreground">
                        {s.count} in {minutes(s.seconds)}
                      </span>
                      <span className="w-full text-muted-foreground">{s.brief}</span>
                    </li>
                  ))}
                </ul>

                <ul className="mt-4 flex flex-col gap-1.5">
                  {assessment.rules.map((rule) => (
                    <li key={rule} className="flex gap-2.5 text-[13px] leading-relaxed">
                      {rule.includes("not simulated here") ? (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      ) : (
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      )}
                      <span
                        className={
                          rule.includes("not simulated here") ? "text-amber-500" : "text-muted-foreground"
                        }
                      >
                        {rule}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 flex gap-2.5 border-t border-border pt-4 text-[12px] leading-relaxed text-muted-foreground/80">
                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {assessment.sourcing}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  {best ? (
                    <span className="readout flex items-center gap-1.5 text-[13px] tabular-nums text-muted-foreground">
                      <Trophy className="h-3.5 w-3.5 text-primary" />
                      Best {best.bestCorrect}/{best.total} ({Math.round(best.best * 100)}%) ·{" "}
                      {best.sittings} {best.sittings === 1 ? "sitting" : "sittings"}
                    </span>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">Not sat yet.</span>
                  )}
                  <Link
                    to={`/oa/${firm.id}/${assessment.id}`}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {best ? "Sit it again" : "Sit it"} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {uncovered.length > 0 && (
                  <p className="sr-only">
                    This reconstruction does not cover every part of the real assessment.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
