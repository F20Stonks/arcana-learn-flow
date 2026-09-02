import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { MathRenderer } from "@/components/MathRenderer";
import type { FirmSpec, RunResult, SectionResult } from "../types";
import { accuracy, attemptRate, barVerdict, medianLatency, tagBreakdown } from "../engine/scoring";

interface Props {
  firm: FirmSpec;
  result: RunResult | null;
  onExit: () => void;
}

const looksLikeLatex = (s: string) => s.includes("\\") || s.includes("$");

const TAG_LABELS: Record<string, string> = {
  add: "Addition",
  sub: "Subtraction",
  mul_2x1: "2-digit × 1-digit",
  mul_2x2: "2-digit × 2-digit",
  div_exact: "Division",
  decimal_addsub: "Decimals — add / subtract",
  decimal_mul: "Decimals — multiply",
  fraction_addsub: "Fractions",
  percent_of: "Percentages",
  missing_operand: "Missing operand",
};

const VERDICT_COPY: Record<string, { label: string; className: string }> = {
  above: { label: "Above the bar", className: "text-primary" },
  near: { label: "Borderline", className: "text-foreground" },
  below: { label: "Below the bar", className: "text-destructive" },
  unknown: { label: "No published bar", className: "text-muted-foreground" },
};

function SectionCard({ section }: { section: SectionResult }) {
  const verdict = VERDICT_COPY[barVerdict(section)];
  const acc = accuracy(section);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[17px] font-semibold text-foreground">{section.moduleName}</h3>
        <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${verdict.className}`}>
          {verdict.label}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-[40px] font-semibold leading-none tabular-nums text-foreground">
          {section.rawScore}
        </span>
        {section.passMark !== null && (
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            / bar is {section.passMark}
          </span>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
        {[
          ["Correct", String(section.correct)],
          ["Wrong", String(section.wrong)],
          ["Not reached", String(section.skipped)],
          ["Accuracy", `${Math.round(acc * 100)}%`],
          ["Attempted", `${section.correct + section.wrong} of ${section.seen}`],
          ["Rate", `${attemptRate(section).toFixed(1)}/min`],
          ["Median time", `${(medianLatency(section) / 1000).toFixed(1)}s`],
          ["Duration", `${section.durationS}s`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-mono text-[15px] tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Everything the run withheld, all at once.
 *
 * The real assessment gives a candidate nothing — not a score, not a mark scheme, usually not even
 * a rejection reason. That silence is worth replicating during the run and worth breaking
 * completely afterwards, because the debrief is the only part of this that actually teaches.
 */
export default function Debrief({ firm, result, onExit }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (!result) return null;

  const tags = tagBreakdown(result).filter((t) => t.attempts >= 2);
  const answeredItems = result.sections.flatMap((s) => s.items.filter((i) => !i.skipped));
  const wrongItems = answeredItems.filter((i) => !i.correct);
  const reviewItems = showAll ? answeredItems : wrongItems;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-5 py-12 sm:px-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">{firm.name}</p>
        <h1 className="mt-2 font-display text-[32px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          Assessment complete
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          {result.tabBlurCount > 0
            ? `You switched away from the tab ${result.tabBlurCount} ${result.tabBlurCount === 1 ? "time" : "times"}. Some firms record this.`
            : "You stayed on the tab throughout."}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {result.sections.map((section) => (
          <SectionCard key={section.moduleId} section={section} />
        ))}
      </div>

      {tags.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[15px] font-semibold text-foreground">Where the marks went</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">Weakest first.</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {tags.map((t) => (
              <li key={t.tag} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-[13.5px] text-foreground">
                  {TAG_LABELS[t.tag] ?? t.tag}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/40">
                  <div
                    className={`h-full rounded-full ${t.accuracy < 0.6 ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${Math.max(3, t.accuracy * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                  {t.correct}/{t.attempts}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold text-foreground">
            {showAll ? "Every question you answered" : "The ones you got wrong"}
          </h2>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {showAll ? "Show mistakes only" : `Show all ${answeredItems.length}`}
          </button>
        </div>

        {reviewItems.length === 0 ? (
          <p className="mt-4 text-[14px] text-muted-foreground">
            Nothing wrong on the questions you reached.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {reviewItems.map((item) => (
              <li key={item.itemId} className="flex items-center gap-3 py-2.5">
                {item.correct ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="flex-1 text-[14px] text-foreground">
                  {looksLikeLatex(item.prompt) ? <MathRenderer content={item.prompt} /> : item.prompt}
                </span>
                <span className="shrink-0 font-mono text-[13px] tabular-nums">
                  <span className={item.correct ? "text-muted-foreground" : "text-destructive line-through"}>
                    {item.given}
                  </span>
                  {!item.correct && <span className="ml-2 text-foreground">{item.expected}</span>}
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-muted-foreground">
                  {(item.latencyMs / 1000).toFixed(1)}s
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <RotateCcw className="h-4 w-4" /> Sit it again
        </button>
        <button
          onClick={onExit}
          className="rounded-xl border border-border px-6 py-3 text-[15px] text-foreground transition-colors hover:bg-secondary/40"
        >
          Done
        </button>
      </div>
    </div>
  );
}
