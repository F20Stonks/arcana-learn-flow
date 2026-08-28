import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { ArrowLeft, ArrowRight, CornerDownLeft, Delete } from "lucide-react";

interface Key {
  /** What's printed on the button. */
  label: string;
  /** Screen-reader name — the button's visible label is rarely enough on its own. */
  aria: string;
  /** Text inserted at the cursor. */
  before: string;
  /** Text inserted after the cursor (or after the wrapped selection). */
  after?: string;
  /**
   * If there's a selection when this key is pressed, wrap it as the argument instead of
   * replacing it — selecting `x^2` and tapping `sin` gives `sin(x^2)`, not `sin()`.
   */
  wrap?: boolean;
}

const DIGITS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => ({
  label: d,
  aria: d,
  before: d,
}));
const digit = (d: string) => DIGITS.find((k) => k.label === d)!;

const TRIG_GROUPS: { title: string; keys: Key[] }[] = [
  {
    title: "Trig",
    keys: ["sin", "cos", "tan", "sec", "csc", "cot"].map((fn) => ({
      label: fn,
      aria: `${fn} function`,
      before: `${fn}(`,
      after: ")",
      wrap: true,
    })),
  },
  {
    title: "Inverse",
    keys: ["asin", "acos", "atan", "asec", "acsc", "acot"].map((fn) => ({
      label: `${fn.slice(1)}⁻¹`,
      aria: `inverse ${fn.slice(1)}, arc${fn.slice(1)}`,
      before: `${fn}(`,
      after: ")",
      wrap: true,
    })),
  },
  {
    title: "Hyperbolic",
    keys: ["sinh", "cosh", "tanh", "sech", "csch", "coth"].map((fn) => ({
      label: fn,
      aria: `${fn} function`,
      before: `${fn}(`,
      after: ")",
      wrap: true,
    })),
  },
  {
    title: "Inverse hyperbolic",
    keys: ["asinh", "acosh", "atanh", "asech", "acsch", "acoth"].map((fn) => ({
      label: `${fn.slice(1)}⁻¹`,
      aria: `inverse ${fn.slice(1)}`,
      before: `${fn}(`,
      after: ")",
      wrap: true,
    })),
  },
];

const FUNC_KEYS: Key[] = [
  { label: "logₐ", aria: "log base a — log(value, base)", before: "log(", after: ",)" },
  { label: "∛", aria: "cube root", before: "cbrt(", after: ")", wrap: true },
  { label: "ⁿ√", aria: "nth root — nthRoot(value, n)", before: "nthRoot(", after: ")", wrap: true },
  { label: "⌊x⌋", aria: "floor function", before: "floor(", after: ")", wrap: true },
  { label: "⌈x⌉", aria: "ceiling function", before: "ceil(", after: ")", wrap: true },
  { label: "round", aria: "round function", before: "round(", after: ")", wrap: true },
  { label: "min", aria: "minimum — min(a, b)", before: "min(", after: ",)" },
  { label: "max", aria: "maximum — max(a, b)", before: "max(", after: ",)" },
  { label: "Γ", aria: "gamma function", before: "gamma(", after: ")", wrap: true },
  { label: "erf", aria: "error function, erf", before: "erf(", after: ")", wrap: true },
  { label: "eˣ", aria: "e to the x, exponential", before: "exp(", after: ")", wrap: true },
  { label: "∞", aria: "infinity", before: "Infinity" },
  { label: ",", aria: "comma", before: "," },
];

interface Props {
  inputRef: RefObject<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  id?: string;
}

/**
 * A clickable symbol palette that supplements typing rather than replacing it — everything it
 * inserts lands in the same text box `normalize()` already reads, so grading never has to know
 * which mode built the answer. Reads and writes the input's own selection range directly instead
 * of tracking cursor position in React state, which is what lets repeated taps land exactly where
 * the last one finished even though clicking a button never focuses it away from the input.
 */
export default function MathKeyboard({ inputRef, value, onChange, onSubmit, disabled = false, id }: Props) {
  const [panel, setPanel] = useState<"main" | "trig" | "func">("main");

  const selection = (): [number, number] => {
    const el = inputRef.current;
    const s = el?.selectionStart ?? value.length;
    const e = el?.selectionEnd ?? value.length;
    return [s ?? value.length, e ?? value.length];
  };

  const restoreCaret = (pos: number) => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const press = (key: Key) => {
    const el = inputRef.current;
    const current = el?.value ?? value;
    const [start, end] = selection();
    const selected = current.slice(start, end);
    const after = key.after ?? "";

    let inserted: string;
    let cursor: number;
    if (key.wrap && selected) {
      inserted = key.before + selected + after;
      cursor = start + inserted.length;
    } else {
      inserted = key.before + after;
      cursor = start + key.before.length;
    }

    onChange(current.slice(0, start) + inserted + current.slice(end));
    restoreCaret(cursor);
  };

  const backspace = () => {
    const el = inputRef.current;
    const current = el?.value ?? value;
    const [start, end] = selection();
    let next: string;
    let cursor: number;
    if (end > start) {
      next = current.slice(0, start) + current.slice(end);
      cursor = start;
    } else if (start > 0) {
      next = current.slice(0, start - 1) + current.slice(start);
      cursor = start - 1;
    } else {
      return;
    }
    onChange(next);
    restoreCaret(cursor);
  };

  const moveCaret = (dir: -1 | 1) => {
    const el = inputRef.current;
    if (!el) return;
    const [start, end] = selection();
    const at = dir < 0 ? (end > start ? start : Math.max(0, start - 1)) : end > start ? end : Math.min((el.value ?? value).length, end + 1);
    el.focus();
    el.setSelectionRange(at, at);
  };

  const clearAll = () => {
    onChange("");
    restoreCaret(0);
  };

  return (
    <div
      id={id}
      role="group"
      aria-label="Math symbol keyboard"
      className="reveal flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:p-4"
    >
      {panel === "main" && (
        <MainGrid
          disabled={disabled}
          onPress={press}
          onBackspace={backspace}
          onMove={moveCaret}
          onClear={clearAll}
          onOpenTrig={() => setPanel("trig")}
          onOpenFunc={() => setPanel("func")}
        />
      )}
      {panel === "trig" && (
        <TrigPanel disabled={disabled} onPress={press} onBack={() => setPanel("main")} />
      )}
      {panel === "func" && (
        <FuncPanel disabled={disabled} onPress={press} onBack={() => setPanel("main")} />
      )}

      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
      >
        Check <CornerDownLeft className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function KeyButton({
  keyDef,
  disabled,
  onPress,
  variant = "default",
}: {
  keyDef: Key;
  disabled?: boolean;
  onPress: (key: Key) => void;
  variant?: "default" | "accent";
}) {
  return (
    <button
      type="button"
      aria-label={keyDef.aria}
      disabled={disabled}
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => onPress(keyDef)}
      className={`flex min-h-[2.75rem] items-center justify-center rounded-lg border text-[15px] transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        variant === "accent"
          ? "border-primary/30 bg-primary/[0.07] font-medium text-primary hover:border-primary/50 hover:bg-primary/[0.12]"
          : "border-border bg-background font-mono text-foreground hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10"
      }`}
    >
      {keyDef.label}
    </button>
  );
}

/** Tap for one step, hold for repeat — for backspace and the cursor keys, where one tap is rarely enough. */
function useTapOrHold(action: () => void, disabled?: boolean) {
  const viaPointer = useRef(false);
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);

  return {
    onPointerDown: (e: PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      viaPointer.current = true;
      action();
      timer.current = window.setTimeout(() => {
        timer.current = window.setInterval(action, 60);
      }, 450);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: () => {
      if (viaPointer.current) {
        viaPointer.current = false;
        return;
      }
      if (!disabled) action();
    },
  };
}

function RepeatButton({
  aria,
  children,
  action,
  disabled,
}: {
  aria: string;
  children: React.ReactNode;
  action: () => void;
  disabled?: boolean;
}) {
  const handlers = useTapOrHold(action, disabled);
  return (
    <button
      type="button"
      aria-label={aria}
      disabled={disabled}
      {...handlers}
      className="flex min-h-[2.75rem] items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

interface MainGridProps {
  disabled?: boolean;
  onPress: (key: Key) => void;
  onBackspace: () => void;
  onMove: (dir: -1 | 1) => void;
  onClear: () => void;
  onOpenTrig: () => void;
  onOpenFunc: () => void;
}

function MainGrid({ disabled, onPress, onBackspace, onMove, onClear, onOpenTrig, onOpenFunc }: MainGridProps) {
  const k = (label: string, aria: string, before: string, after?: string, wrap?: boolean): Key => ({
    label,
    aria,
    before,
    after,
    wrap,
  });

  return (
    <div className="grid grid-cols-6 gap-1.5">
      {[digit("1"), digit("2"), digit("3"), k("(", "open parenthesis", "("), k(")", "close parenthesis", ")")].map(
        (key) => (
          <KeyButton key={key.aria} keyDef={key} disabled={disabled} onPress={onPress} />
        ),
      )}
      <RepeatButton aria="Backspace" action={onBackspace} disabled={disabled}>
        <Delete className="h-4 w-4" />
      </RepeatButton>

      {[digit("4"), digit("5"), digit("6"), k("+", "plus", "+"), k("−", "minus", "-"), k("×", "times", "*")].map(
        (key) => (
          <KeyButton key={key.aria} keyDef={key} disabled={disabled} onPress={onPress} />
        ),
      )}

      {[
        digit("7"),
        digit("8"),
        digit("9"),
        k("÷", "divide", "/"),
        k("xⁿ", "power, x to the n", "^(", ")"),
        k("√", "square root", "sqrt(", ")", true),
      ].map((key) => (
        <KeyButton key={key.aria} keyDef={key} disabled={disabled} onPress={onPress} />
      ))}

      {[digit("0"), k(".", "decimal point", "."), k("x", "variable x", "x"), k("|x|", "absolute value", "|", "|", true), k("ln", "natural log", "ln(", ")", true)].map(
        (key) => (
          <KeyButton key={key.aria} keyDef={key} disabled={disabled} onPress={onPress} />
        ),
      )}
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onOpenTrig}
        className="flex min-h-[2.75rem] items-center justify-center rounded-lg border border-primary/30 bg-primary/[0.07] text-[13px] font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/[0.12] disabled:pointer-events-none disabled:opacity-40"
      >
        Trig
      </button>

      {[k("π", "pi", "pi"), k("e", "euler's number e", "e")].map((key) => (
        <KeyButton key={key.aria} keyDef={key} disabled={disabled} onPress={onPress} />
      ))}
      <RepeatButton aria="Move cursor left" action={() => onMove(-1)} disabled={disabled}>
        <ArrowLeft className="h-4 w-4" />
      </RepeatButton>
      <RepeatButton aria="Move cursor right" action={() => onMove(1)} disabled={disabled}>
        <ArrowRight className="h-4 w-4" />
      </RepeatButton>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onOpenFunc}
        className="flex min-h-[2.75rem] items-center justify-center rounded-lg border border-primary/30 bg-primary/[0.07] text-[13px] font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/[0.12] disabled:pointer-events-none disabled:opacity-40"
      >
        Func
      </button>
      <button
        type="button"
        aria-label="Clear the answer"
        disabled={disabled}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onClear}
        className="flex min-h-[2.75rem] items-center justify-center rounded-lg border border-border bg-background text-[13px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
      >
        C
      </button>
    </div>
  );
}

function BackRow({ title, onBack, disabled }: { title: string; onBack: () => void; disabled?: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onBack}
        className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <span className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{title}</span>
    </div>
  );
}

function TrigPanel({ disabled, onPress, onBack }: { disabled?: boolean; onPress: (key: Key) => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <BackRow title="Trig functions" onBack={onBack} disabled={disabled} />
      {TRIG_GROUPS.map((group) => (
        <div key={group.title} className="grid grid-cols-6 gap-1.5">
          {group.keys.map((key) => (
            <KeyButton key={key.aria} keyDef={key} disabled={disabled} onPress={onPress} />
          ))}
        </div>
      ))}
    </div>
  );
}

function FuncPanel({ disabled, onPress, onBack }: { disabled?: boolean; onPress: (key: Key) => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <BackRow title="Functions" onBack={onBack} disabled={disabled} />
      <div className="grid grid-cols-4 gap-1.5">
        {FUNC_KEYS.map((key) => (
          <KeyButton key={key.aria} keyDef={key} disabled={disabled} onPress={onPress} />
        ))}
      </div>
    </div>
  );
}
