import { useEffect, useRef } from "react";
import { CornerDownLeft } from "lucide-react";
import Tex from "@/features/integrals/components/Tex";
import type { Question } from "../types";

interface Props {
  question: Question;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** Bumped per question so the input can refocus even when two questions look identical. */
  nonce: number;
  /** What the commit button says. A paper moves on; a drill checks and holds. */
  submitLabel?: string;
  /**
   * The question is answered and marked. The input goes read-only and its button disappears, so
   * the only thing left to press is the one that moves on — two live controls that both advance is
   * ambiguous on screen and worse to a screen reader.
   */
  locked?: boolean;
}

/**
 * One question, front and centre.
 *
 * Arithmetic sections run at six to ten seconds a question, so the prompt is set large and the
 * cursor is already in the box: a candidate who has to find the input first has spent a fifth of
 * their time on the interface. Everything else on screen is deliberately quiet.
 */
export default function QuestionCard({
  question,
  value,
  onChange,
  onSubmit,
  nonce,
  submitLabel = "Next",
  locked = false,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!locked) ref.current?.focus();
  }, [nonce, locked]);

  const short = question.prompt.length < 40;

  if (question.choices) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-card px-6 py-8">
          <p className="text-center text-[17px] leading-relaxed text-foreground">
            <Tex>{question.prompt}</Tex>
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Your answer"
          className="grid gap-2 sm:grid-cols-2"
        >
          {question.choices.map((choice, i) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={value === String(i)}
              disabled={locked}
              onClick={() => {
                onChange(String(i));
                // A multiple choice question has no separate confirm step in the real thing.
                queueMicrotask(onSubmit);
              }}
              className={`rounded-xl border px-4 py-3 text-left text-[15px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                value === String(i)
                  ? "border-primary/60 bg-primary/[0.08] text-foreground"
                  : "border-border text-foreground hover:border-primary/40 hover:bg-accent/40"
              }`}
            >
              <span className="readout mr-2.5 text-[12px] text-muted-foreground">{i + 1}</span>
              {choice}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card px-6 py-10">
        <div className="overflow-x-auto text-center">
          {/* Short prompts are formulas and want display size; a worded question wants reading size. */}
          {short ? (
            <Tex block className="text-foreground">
              {question.prompt}
            </Tex>
          ) : (
            <p className="text-[17px] leading-relaxed text-foreground">
              <Tex>{question.prompt}</Tex>
            </p>
          )}
        </div>
      </div>

      <div className="relative">
        <label htmlFor="oa-answer" className="sr-only">
          Your answer
        </label>
        <input
          id="oa-answer"
          ref={ref}
          value={value}
          readOnly={locked}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          // Numeric, but not `type="number"`: a spinner arrow is a way to lose a second, and
          // fractions like 5/36 are a legitimate answer that a number input refuses outright.
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="your answer"
          className={`w-full rounded-xl border-2 bg-card py-3.5 pl-4 font-mono text-[19px] text-foreground outline-hidden transition-colors placeholder:text-muted-foreground/40 focus:border-primary/60 ${
            locked ? "border-border/60 pr-4 opacity-70" : "border-border pr-28"
          }`}
        />
        {!locked && (
          <button
            onClick={onSubmit}
            disabled={!value.trim()}
            className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            {submitLabel} <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
