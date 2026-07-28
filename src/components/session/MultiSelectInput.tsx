import { useState } from "react";
import MathRenderer from "@/components/MathRenderer";

interface Props {
  options: string[];
  disabled: boolean;
  onSend: (text: string) => void;
  onEscape: () => void;
}

/**
 * "Select all that apply" — reuses the existing mcq button styling but toggles multiple options
 * before an explicit Submit, instead of the single-click-to-send behaviour mcq/truefalse/match
 * use. Fills a real gap: today there's no way to ask a select-all-that-apply question at all.
 */
export default function MultiSelectInput({ options, disabled, onSend, onEscape }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const submit = () => {
    if (selected.size === 0) return;
    onSend(options.filter((_, i) => selected.has(i)).join("; "));
  };

  return (
    <div className="p-4 border-t border-border bg-background">
      <div className="flex flex-wrap gap-2 mb-2">
        {options.map((opt, idx) => {
          const isOn = selected.has(idx);
          return (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              disabled={disabled}
              className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl border text-sm text-left leading-snug transition-colors disabled:opacity-40 ${
                isOn
                  ? "bg-primary/10 border-primary text-foreground"
                  : "bg-card border-border text-foreground hover:bg-accent hover:border-primary/40"
              }`}
            >
              <MathRenderer content={opt} />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={disabled || selected.size === 0}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          Submit ({selected.size || 0})
        </button>
        <button onClick={onEscape} className="text-xs text-muted-foreground hover:text-foreground">
          Type instead →
        </button>
      </div>
    </div>
  );
}
