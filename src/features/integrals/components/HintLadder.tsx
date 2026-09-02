import { Lightbulb } from "lucide-react";
import Tex from "./Tex";
import { nextHintCost } from "../scoring";

interface Props {
  hints: string[];
  used: number;
  onReveal: () => void;
  disabled?: boolean;
}

/**
 * Hints cost points, so the cost is stated on the button rather than discovered afterwards — and
 * it is the cost of the *next* one, which is not always 20%: the penalty caps at 60%, so a fourth
 * hint is free and the button now says so instead of quoting a price nobody is charged.
 */
export default function HintLadder({ hints, used, onReveal, disabled = false }: Props) {
  const remaining = hints.length - used;
  const cost = nextHintCost(used);
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
          Reveal a hint ·{" "}
          {cost > 0 ? `−${Math.round(cost * 100)}%` : "free, the penalty is already capped"}{" "}
          <span className="text-muted-foreground/60">({remaining} left)</span>
        </button>
      )}
    </div>
  );
}
