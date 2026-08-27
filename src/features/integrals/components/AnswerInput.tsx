import { useEffect, useId, useRef, useState } from "react";
import { CornerDownLeft, Delete } from "lucide-react";
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

type Mode = "type" | "build";

/**
 * A palette button either inserts literal text at the cursor, or (for a function/root/bars) inserts
 * a pair with the cursor left between them, ready for the argument.
 */
interface Key {
  label: string;
  insert: string;
  /** Where the cursor lands, counted back from the end of what was just inserted. 0 = right after. */
  cursorBack?: number;
}

const CORE_KEYS: Key[] = [
  { label: "x", insert: "x" },
  { label: "e", insert: "e" },
  { label: "π", insert: "pi" },
  { label: "C", insert: "C" },
];

const OPERATOR_KEYS: Key[] = [
  { label: "+", insert: "+" },
  { label: "−", insert: "-" },
  { label: "×", insert: "*" },
  { label: "÷", insert: "/" },
  { label: "^", insert: "^" },
  { label: "√", insert: "sqrt()", cursorBack: 1 },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "|x|", insert: "||", cursorBack: 1 },
];

const FUNCTION_KEYS: Key[] = [
  { label: "sin", insert: "sin()", cursorBack: 1 },
  { label: "cos", insert: "cos()", cursorBack: 1 },
  { label: "tan", insert: "tan()", cursorBack: 1 },
  { label: "ln", insert: "ln()", cursorBack: 1 },
  { label: "arcsin", insert: "arcsin()", cursorBack: 1 },
  { label: "arctan", insert: "arctan()", cursorBack: 1 },
];

/**
 * A plain text box, on purpose. An equation editor looks better in a screenshot but costs a beat
 * on every keystroke, and this is a timed game — students type `x^2/2 + C` faster than they can
 * click. The live preview underneath is what confirms the parser read them correctly.
 *
 * The palette below is a supplement, not a replacement: a student who wants zero parsing ambiguity
 * can build the same string by clicking instead of typing it. Both paths land in the identical
 * `value` string compared against the stored answer — nothing about grading changes.
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
  const [mode, setMode] = useState<Mode>("type");
  // Where to put the cursor after the next value change lands — clicking a palette button blurs
  // the input, so the caret position has to be restored by hand once React re-renders with it.
  const pendingCaret = useRef<number | null>(null);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (pendingCaret.current === null) return;
    const el = ref.current;
    const pos = pendingCaret.current;
    pendingCaret.current = null;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pos, pos);
  }, [value]);

  const insert = (key: Key) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + key.insert + value.slice(end);
    pendingCaret.current = start + key.insert.length - (key.cursorBack ?? 0);
    onChange(next);
  };

  const backspace = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    if (start === end) {
      if (start === 0) return;
      pendingCaret.current = start - 1;
      onChange(value.slice(0, start - 1) + value.slice(end));
    } else {
      pendingCaret.current = start;
      onChange(value.slice(0, start) + value.slice(end));
    }
  };

  const preview = value.trim() ? previewLatex(value) : null;
  const bad = verdict !== null && verdict.status !== "correct";

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="sr-only">
        Your answer to the integral
      </label>

      <div className="flex items-center gap-1 self-start rounded-lg border border-border bg-card p-0.5 text-[12px]">
        {(["type", "build"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === m
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "type" ? "Type" : "Build"}
          </button>
        ))}
      </div>

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

      {mode === "build" && !disabled && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card/60 p-3">
          <div className="flex flex-wrap gap-1.5">
            {CORE_KEYS.map((k) => (
              <PaletteKey key={k.label} k={k} onPress={insert} />
            ))}
            <button
              type="button"
              onClick={backspace}
              aria-label="Delete last character"
              className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <Delete className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OPERATOR_KEYS.map((k) => (
              <PaletteKey key={k.label} k={k} onPress={insert} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FUNCTION_KEYS.map((k) => (
              <PaletteKey key={k.label} k={k} onPress={insert} />
            ))}
          </div>
        </div>
      )}

      <div id={`${id}-preview`} className="min-h-[26px] px-1 text-[13px]">
        {preview ? (
          <span className="text-muted-foreground">
            reads as <Tex className="ml-1 text-foreground">{preview}</Tex>
          </span>
        ) : value.trim() ? (
          <span className="text-muted-foreground/70">…still reading that</span>
        ) : mode === "build" ? (
          <span className="text-muted-foreground/60">
            Click symbols to build the answer — the box above still accepts typing too.
          </span>
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
  );
}

function PaletteKey({ k, onPress }: { k: Key; onPress: (k: Key) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPress(k)}
      className="min-w-[2.25rem] rounded-lg border border-border px-2.5 py-1.5 font-mono text-[13px] text-foreground transition-colors hover:border-primary/40 hover:bg-accent/50"
    >
      {k.label}
    </button>
  );
}
