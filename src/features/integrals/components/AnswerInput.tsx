import { useEffect, useRef } from "react";
import { CornerDownLeft } from "lucide-react";
import Tex from "./Tex";
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
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  const preview = value.trim() ? previewLatex(value) : null;
  const bad = verdict !== null && verdict.status !== "correct";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <input
          ref={ref}
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

      <div className="min-h-[26px] px-1 text-[13px]">
        {preview ? (
          <span className="text-muted-foreground">
            reads as <Tex className="ml-1 text-foreground">{preview}</Tex>
          </span>
        ) : value.trim() ? (
          <span className="text-muted-foreground/70">…still reading that</span>
        ) : (
          <span className="text-muted-foreground/60">
            Type it however you like: <code className="font-mono">ln|x|</code>,{" "}
            <code className="font-mono">arctan(x)</code>, <code className="font-mono">sin^2 x</code> or pasted
            LaTeX all work. The <code className="font-mono">+ C</code> is optional.
          </span>
        )}
      </div>
    </div>
  );
}
