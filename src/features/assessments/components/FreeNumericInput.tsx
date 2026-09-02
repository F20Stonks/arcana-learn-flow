import { useRef, useState } from "react";

interface Props {
  onSubmit: (raw: string) => void;
  /** Rendered under the field when the module allows skipping. */
  onSkip?: () => void;
}

/**
 * Typed numeric answer.
 *
 * Deliberately NOT src/features/drills/components/NumericAnswerInput.tsx, whose guard is
 * /^-?\d*$/ — integers only. These tests ask for decimals ("16.1"), fractions ("5/6") and
 * negatives, and a field that silently refuses the keystroke would mark a correct answer wrong.
 *
 * Remounted with a fresh `key` per item by the caller, so autofocus and an empty field come free.
 */
export default function FreeNumericInput({ onSubmit, onSkip }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value);
  };

  return (
    <div className="flex w-full max-w-[320px] flex-col items-center gap-3">
      <input
        ref={ref}
        autoFocus
        inputMode="decimal"
        autoComplete="off"
        aria-label="Your answer"
        value={value}
        onChange={(e) => {
          // Digits, one leading minus, decimal points and a fraction slash. Everything the
          // checker can read, and nothing it cannot.
          const v = e.target.value;
          if (/^-?[\d./]*$/.test(v)) setValue(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="?"
        className="w-full rounded-2xl border-2 border-border bg-card px-6 py-4 text-center font-mono text-4xl tabular-nums text-foreground outline-hidden transition-colors focus:border-primary/60 placeholder:text-muted-foreground/30"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={!value.trim()}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          Submit
        </button>
        {onSkip && (
          <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground">
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
