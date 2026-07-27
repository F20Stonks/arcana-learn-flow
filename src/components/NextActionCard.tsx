import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { TrackLite } from "@/lib/nextAction";
import { useNextAction } from "@/hooks/useNextAction";

/**
 * "What to do next" — one deterministic recommendation synthesized from due
 * reviews, exam dates, spec coverage, and track progress (see lib/nextAction.ts).
 * Fails soft: any error renders nothing.
 *
 * Visually this is the Dashboard's thesis: the app knows what you should do, so the
 * instruction gets the largest type on the page and the page's only accent. Everything
 * else on the Dashboard is a supporting readout.
 *
 * Superseded on the current Dashboard by UpNextCard, which renders the same
 * useNextAction() plan as a boarding-pass hero instead of this prose panel — kept
 * here, unused for now, in case a future surface wants the prose framing back.
 */
export default function NextActionCard({ tracks }: { tracks: TrackLite[] }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const plan = useNextAction(tracks);

  if (!plan) return null;
  const { primary, secondary } = plan;
  const overdue = primary.kind === "overdue_review";

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      aria-label="What to do next"
      className="panel-lit relative overflow-hidden rounded-lg border border-rule-strong bg-card"
    >
      {/* Measurement rail — the instrument motif: this panel is a readout, not a card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-px"
        style={{
          background: overdue ? "var(--status-red)" : "var(--primary)",
          opacity: 0.55,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-3"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, var(--tick) 0 1px, transparent 1px 9px)",
          opacity: 0.5,
          maskImage: "linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)",
        }}
      />

      <div className="pl-8 pr-6 py-7 sm:pl-10 sm:pr-8">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="eyebrow">Next</span>
          <span aria-hidden="true" className="h-px w-6 bg-rule-strong" />
          {overdue && (
            <span className="rounded-chip bg-destructive/12 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-destructive">
              Overdue
            </span>
          )}
        </div>

        {/* The one editorial moment on an otherwise instrument-cold surface. */}
        <h2 className="max-w-2xl font-serif text-[26px] font-normal leading-[1.28] tracking-[-0.01em] text-foreground sm:text-[30px]" style={{ textWrap: "balance" } as React.CSSProperties}>
          {primary.reason}
        </h2>

        <button
          onClick={() => navigate(primary.to)}
          className="group mt-6 inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-[transform,opacity] duration-200 ease-out hover:opacity-92 active:scale-[0.985]"
        >
          {primary.cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </button>

        {secondary.length > 0 && (
          <div className="mt-7 border-t border-border pt-4">
            <p className="eyebrow mb-2">Then</p>
            <div className="-mx-2">
              {secondary.map((s) => (
                <button
                  key={s.to}
                  onClick={() => navigate(s.to)}
                  className="group flex w-full items-center gap-3 rounded-control px-2 py-2 text-left text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent/50 hover:text-foreground"
                >
                  <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-tick transition-colors group-hover:bg-primary" />
                  <span className="flex-1 truncate">{s.reason}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-60" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
