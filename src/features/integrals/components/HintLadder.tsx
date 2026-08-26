import { Lightbulb } from "lucide-react";
import Tex from "./Tex";

interface Props {
  hints: string[];
  used: number;
  onReveal: () => void;
  disabled?: boolean;
}

/** Hints cost points, so the cost is stated on the button rather than discovered afterwards. */
export default function HintLadder({ hints, used, onReveal, disabled = false }: Props) {
  const remaining = hints.length - used;
  return (
    <div className="flex flex-col gap-2.5">
      {hints.slice(0, used).map((hint, i) => (
        <div
          key={i}
          data-testid="hint"
          className="reveal flex gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3"
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-[14px] leading-relaxed text-foreground">
            <Tex>{hint}</Tex>
          </p>
        </div>
      ))}

      {remaining > 0 && !disabled && (
        <button
          onClick={onReveal}
          className="self-start rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Reveal a hint · −20% <span className="text-muted-foreground/60">({remaining} left)</span>
        </button>
      )}
    </div>
  );
}
