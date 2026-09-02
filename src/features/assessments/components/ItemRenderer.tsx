import { MathRenderer } from "@/components/MathRenderer";
import type { AssessmentItem, ModuleSpec } from "../types";
import ChoiceInput from "./ChoiceInput";
import FreeNumericInput from "./FreeNumericInput";

interface Props {
  item: AssessmentItem;
  module: ModuleSpec;
  onSubmit: (raw: string) => void;
  onSkip: () => void;
}

const looksLikeLatex = (s: string) => s.includes("\\") || s.includes("$");

/**
 * One question, and nothing else.
 *
 * No score, no streak, no correct/incorrect flash — the deliberate difference from
 * src/features/drills/components/DrillRunner.tsx. A real assessment gives no signal at all until
 * it is over, and a candidate who practises with feedback is practising a different task.
 */
export default function ItemRenderer({ item, module, onSubmit, onSkip }: Props) {
  const skip = module.allowSkip ? onSkip : undefined;

  return (
    <div className="flex flex-col items-center gap-8 rounded-2xl border border-border bg-card px-6 py-10 sm:px-10">
      <div className="min-h-[3.5rem] text-center text-[30px] font-semibold leading-tight text-foreground sm:text-[34px]">
        {looksLikeLatex(item.prompt) ? <MathRenderer content={item.prompt} /> : item.prompt}
      </div>

      {module.input === "choice" && item.choices ? (
        <ChoiceInput key={item.id} choices={item.choices} onSubmit={onSubmit} onSkip={skip} />
      ) : (
        <FreeNumericInput key={item.id} onSubmit={onSubmit} onSkip={skip} />
      )}
    </div>
  );
}
