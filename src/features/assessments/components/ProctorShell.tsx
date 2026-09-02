import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { FirmSpec } from "../types";
import { useAssessmentRun } from "../engine/useAssessmentRun";
import { saveRun } from "../engine/persistence";
import { formatClock } from "../engine/scoring";
import InstructionScreen from "./InstructionScreen";
import ItemRenderer from "./ItemRenderer";
import SectionBreak from "./SectionBreak";
import Debrief from "./Debrief";

interface Props {
  firm: FirmSpec;
  /** Restrict to one module — the single-module practice route. */
  onlyModuleId?: string;
  onExit: () => void;
}

/**
 * The full-screen assessment surface.
 *
 * Runs outside AppShell on purpose: the sidebar, the nav and the XP counter are exactly the things
 * a real assessment does not have, and their absence is most of what makes this feel like the real
 * screen rather than another drill.
 */
export default function ProctorShell({ firm, onlyModuleId, onExit }: Props) {
  const { user } = useAuth();
  const run = useAssessmentRun({ firm, onlyModuleId });
  const [confirmingExit, setConfirmingExit] = useState(false);

  // Written once, when the battery seals. Abandoned runs are still real data — the sections already
  // sat happened, and so did the questions answered in the one walked out of — so they are saved
  // and flagged rather than dropped. Nothing here awaits the write: a candidate who has just spent
  // eight minutes on a test sees their debrief whether or not Supabase answered.
  useEffect(() => {
    if (run.status !== "finished" || !run.result || !user) return;
    saveRun(user.id, run.result, run.abandoned).catch(() => {
      /* saveRun already warns; the debrief renders either way. */
    });
  }, [run.status, run.result, run.abandoned, user]);

  if (run.status === "instructions") {
    if (!run.module) return null;
    return (
      <InstructionScreen
        firmName={firm.name}
        module={run.module}
        sectionNumber={run.sectionIndex + 1}
        sectionCount={run.modules.length}
        onBegin={run.beginSection}
        onExit={onExit}
      />
    );
  }

  if (run.status === "break") {
    const justFinished = run.modules[run.sectionIndex];
    const next = run.modules[run.sectionIndex + 1];
    if (!justFinished || !next) return null;
    return (
      <SectionBreak
        justFinished={justFinished}
        next={next}
        sectionNumber={run.sectionIndex + 1}
        sectionCount={run.modules.length}
        onContinue={run.continueToNextSection}
      />
    );
  }

  if (run.status === "finished") {
    return <Debrief firm={firm} result={run.result} onExit={onExit} />;
  }

  const module = run.module;
  const item = run.item;
  if (!module || !item) return null;

  const onSectionClock = module.durationS !== null;
  const totalMs = onSectionClock ? module.durationS * 1000 : (module.perItemMs ?? 0);
  const remainingMs = onSectionClock ? run.timeLeftMs : (run.itemTimeLeftMs ?? 0);
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  // The last thirty seconds turn the bar red. Every one of these tests is lost on the clock.
  const urgent = remainingMs <= 30_000;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setConfirmingExit(true)}
          aria-label="Leave assessment"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-5">
          {/* Position, never a score. The candidate learns nothing about how they are doing. */}
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {run.itemIndex + 1} / {module.itemCount}
          </span>
          <span
            className={`font-mono text-lg font-semibold tabular-nums ${urgent ? "text-destructive" : "text-foreground"}`}
          >
            {formatClock(remainingMs)}
          </span>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/40">
        <div
          className={`h-full rounded-full transition-[width] duration-150 ease-linear ${urgent ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>

      <ItemRenderer item={item} module={module} onSubmit={run.submit} onSkip={run.skip} />

      {module.allowBack && run.itemIndex > 0 && (
        <button
          onClick={run.back}
          className="flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous question
        </button>
      )}

      {confirmingExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
            <h2 className="text-[17px] font-semibold text-foreground">Leave the assessment?</h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              The clock does not stop and this attempt cannot be resumed. You will still see a
              debrief for the questions you answered.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setConfirmingExit(false)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary/40"
              >
                Keep going
              </button>
              <button
                onClick={run.abandon}
                className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
