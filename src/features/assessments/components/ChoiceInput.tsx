import { useEffect } from "react";
import type { ItemChoice } from "../types";

interface Props {
  choices: ItemChoice[];
  onSubmit: (choiceId: string) => void;
  onSkip?: () => void;
}

/**
 * Multiple choice, as the Flow Traders math test and every probability screen set it.
 *
 * Number keys select, because at six seconds a question the mouse is the bottleneck — the real
 * tests are won by candidates who never leave the keyboard.
 */
export default function ChoiceInput({ choices, onSubmit, onSkip }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= choices.length) {
        e.preventDefault();
        onSubmit(choices[n - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, onSubmit]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-2.5">
      {choices.map((choice, i) => (
        <button
          key={choice.id}
          onClick={() => onSubmit(choice.id)}
          className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/40"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border font-mono text-[11px] text-muted-foreground">
            {i + 1}
          </span>
          <span className="font-mono text-[15px] tabular-nums text-foreground">{choice.label}</span>
        </button>
      ))}
      {onSkip && (
        <button onClick={onSkip} className="mt-1 self-center text-xs text-muted-foreground hover:text-foreground">
          Skip
        </button>
      )}
    </div>
  );
}
