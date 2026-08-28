import { useEffect, useId, useRef, useState } from "react";
import { Calculator, CornerDownLeft } from "lucide-react";
import Tex from "./Tex";
import MathKeyboard from "./MathKeyboard";
import { previewLatex } from "../answer";
import type { Verdict } from "../types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  verdict: Verdict | null;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * A plain text box, on purpose. An equation editor looks better in a screenshot but costs a beat
 * on every keystroke, and this is a timed game — students type `x^2/2 + C` faster than they can
 * click. The live preview underneath is what confirms the parser read them correctly.
 */
export default function AnswerInput({
  value,
  onChange,
  onSubmit,
  verdict,
  disabled = false,
  placeholder = "your answer, e.g. x^3/3 + C",
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  const [keypadOpen, setKeypadOpen] = useState(false);
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  // inputMode="none" only suppresses a touch device's own virtual keyboard — a physical keyboard
  // still works either way. Blurring and refocusing forces the browser to re-read that attribute
  // immediately rather than waiting for the next natural focus.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement === el) {
      el.blur();
      el.focus();
    }
  }, [keypadOpen]);

  const preview = value.trim() ? previewLatex(value) : null;
  const bad = verdict !== null && verdict.status !== "correct";
  const keypadId = `${id}-keypad`;

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="sr-only">
        Your answer to the integral
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          aria-describedby={`${id}-preview`}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode={keypadOpen ? "none" : undefined}
          className={`w-full rounded-xl border-2 bg-card py-3.5 pl-4 pr-24 font-mono text-[17px] text-foreground outline-hidden transition-colors placeholder:text-muted-foreground/40 disabled:opacity-60 ${
            bad ? "border-destructive/50" : "border-border focus:border-primary/60"
          }`}
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          Check <CornerDownLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-expanded={keypadOpen}
          aria-controls={keypadId}
          aria-label={keypadOpen ? "Hide math keyboard" : "Show math keyboard"}
          title={keypadOpen ? "Hide math keyboard" : "Math keyboard"}
          disabled={disabled}
          onClick={() => setKeypadOpen((v) => !v)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-40 ${
            keypadOpen
              ? "border-primary/60 bg-primary/[0.1] text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          <Calculator className="h-4 w-4" />
        </button>

        <div id={`${id}-preview`} className="min-h-[26px] flex-1 text-[13px]">
          {preview ? (
            <span className="text-muted-foreground">
              reads as <Tex className="ml-1 text-foreground">{preview}</Tex>
            </span>
          ) : value.trim() ? (
            <span className="text-muted-foreground/70">…still reading that</span>
          ) : (
            <span className="text-muted-foreground/60">
              Type it however you like — <code className="font-mono">ln|x|</code>,{" "}
              <code className="font-mono">sin x</code>, <code className="font-mono">arctan x</code>,{" "}
              <code className="font-mono">x**3</code>, or pasted LaTeX. The{" "}
              <code className="font-mono">+ C</code> is optional.
            </span>
          )}
        </div>
      </div>

      {keypadOpen && (
        <MathKeyboard
          id={keypadId}
          inputRef={ref}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      )}
    </div>
  );
}
