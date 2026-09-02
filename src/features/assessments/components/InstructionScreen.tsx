import { Play, X } from "lucide-react";
import type { ModuleSpec } from "../types";

interface Props {
  firmName: string;
  module: ModuleSpec;
  sectionNumber: number;
  sectionCount: number;
  onBegin: () => void;
  onExit: () => void;
}

/**
 * The screen before the clock starts.
 *
 * These rules are not flavour text: every line here is enforced by useAssessmentRun. If the screen
 * says you cannot skip, the skip control is not rendered. Getting that wrong would teach a
 * candidate the wrong habits for the real thing, which is the whole point of the feature.
 */
export default function InstructionScreen({
  firmName,
  module,
  sectionNumber,
  sectionCount,
  onBegin,
  onExit,
}: Props) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <button
        onClick={onExit}
        aria-label="Leave assessment"
        className="absolute right-6 top-6 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </button>

      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
        {firmName}
        {sectionCount > 1 && ` · Section ${sectionNumber} of ${sectionCount}`}
      </p>

      <h1 className="mt-3 font-display text-[34px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
        {module.name}
      </h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{module.blurb}</p>

      <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
        <div className="bg-card px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Questions</p>
          <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">{module.itemCount}</p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Time</p>
          <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
            {module.durationS !== null
              ? `${Math.round(module.durationS / 60)} min`
              : `${Math.round((module.perItemMs ?? 0) / 1000)}s each`}
          </p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Marking</p>
          <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
            {module.negativeMarking ? "+1 / −1" : "+1 / 0"}
          </p>
        </div>
      </div>

      <ul className="mt-7 flex flex-col gap-2.5">
        {module.rules.map((rule) => (
          <li key={rule} className="flex gap-3 text-[14.5px] leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-primary" />
            {rule}
          </li>
        ))}
      </ul>

      <button
        onClick={onBegin}
        className="mt-9 flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Play className="h-5 w-5" /> Begin
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        The clock starts the moment you press this. There is no pause.
      </p>
    </div>
  );
}
