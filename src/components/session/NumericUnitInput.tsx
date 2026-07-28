import { useState } from "react";
import { checkNumericAnswer } from "@/lib/answerCheck";

interface Props {
  withUnit: boolean;
  expectedValue: string;
  expectedUnit: string;
  disabled: boolean;
  onSend: (text: string) => void;
  onEscape: () => void;
}

/**
 * Value (+ optional unit) answer for physics-style questions where "right number, wrong/missing
 * unit" needs to be distinguishable from "wrong number" — free text (not type=number) so fractions
 * and symbolic forms stay typeable. Checked instantly client-side (see answerCheck.ts) against the
 * value the tutor embedded in the <choices> tag, so the outgoing message carries a fixed verdict
 * instead of leaving the model to redo the arithmetic itself every time.
 */
export default function NumericUnitInput({ withUnit, expectedValue, expectedUnit, disabled, onSend, onEscape }: Props) {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    const verdict = checkNumericAnswer(value, unit, expectedValue, expectedUnit);
    const answerText = withUnit ? `${value} ${unit}`.trim() : value.trim();
    const unitNote =
      verdict.unitCorrect === null ? "" : verdict.unitCorrect ? ", unit correct" : `, unit ${unit.trim() ? "incorrect" : "missing"}`;
    onSend(`${answerText} (checked: number ${verdict.numericCorrect ? "correct" : "incorrect"}${unitNote})`);
  };

  return (
    <div className="p-4 border-t border-border space-y-3">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Value</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) submit(); }}
            inputMode="decimal"
            autoFocus
            disabled={disabled}
            className="w-32 h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground outline-hidden focus:border-primary/50 disabled:opacity-40"
          />
        </label>
        {withUnit && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Unit</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) submit(); }}
              disabled={disabled}
              className="w-28 h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground outline-hidden focus:border-primary/50 disabled:opacity-40"
            />
          </label>
        )}
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          Submit
        </button>
      </div>
      <button onClick={onEscape} className="text-xs text-muted-foreground hover:text-foreground">
        Type instead →
      </button>
    </div>
  );
}
