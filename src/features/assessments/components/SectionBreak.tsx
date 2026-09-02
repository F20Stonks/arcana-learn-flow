import { ArrowRight } from "lucide-react";
import type { ModuleSpec } from "../types";

interface Props {
  justFinished: ModuleSpec;
  next: ModuleSpec;
  sectionNumber: number;
  sectionCount: number;
  onContinue: () => void;
}

/**
 * Between sections of a battery.
 *
 * Shows no score. A real multi-section assessment does not tell you how the last section went
 * before you sit the next one, and knowing would change how you play it — so the debrief holds
 * everything until the battery is over.
 */
export default function SectionBreak({ justFinished, next, sectionNumber, sectionCount, onContinue }: Props) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Section {sectionNumber} of {sectionCount} complete
      </p>
      <h1 className="mt-3 font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
        {justFinished.name} submitted
      </h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Your results are held until the whole assessment is finished.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card px-5 py-4 text-left">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Up next</p>
        <p className="mt-1 text-[16px] font-semibold text-foreground">{next.name}</p>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">{next.blurb}</p>
      </div>

      <button
        onClick={onContinue}
        className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Continue <ArrowRight className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}
