import type { BinaryOption } from "../types";

interface Props {
  options: [BinaryOption, BinaryOption];
  onSubmit: (value: string) => void;
}

export default function BinaryChoiceInput({ options, onSubmit }: Props) {
  return (
    <div className="flex gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSubmit(opt.value)}
          className="rounded-xl border-2 border-border bg-card px-8 py-4 text-base font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-accent"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
