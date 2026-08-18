import { useRef, useState } from "react";

interface Props {
  onSubmit: (raw: string) => void;
}

/** Remounted with a fresh `key` per problem by the caller, so autoFocus + empty state come free —
 *  no manual clear/refocus effect needed between problems. */
export default function NumericAnswerInput({ onSubmit }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value);
    setValue("");
    ref.current?.focus();
  };

  return (
    <div className="flex w-full max-w-[280px] flex-col items-center gap-3">
      <input
        ref={ref}
        autoFocus
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (/^-?\d*$/.test(v)) setValue(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="?"
        className="w-full rounded-2xl border-2 border-border bg-card px-6 py-4 text-center font-mono text-4xl tabular-nums text-foreground outline-hidden transition-colors focus:border-primary/60 placeholder:text-muted-foreground/40"
      />
      <button
        onClick={submit}
        disabled={!value.trim()}
        className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
      >
        Submit
      </button>
    </div>
  );
}
