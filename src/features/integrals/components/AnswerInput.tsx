import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CornerDownLeft, Keyboard } from "lucide-react";
import Tex from "./Tex";
import SymbolPalette, { type Token } from "./SymbolPalette";
import { readAnswer } from "../answer";
import type { Problem, Verdict } from "../types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  verdict: Verdict | null;
  disabled?: boolean;
  /** The problem being answered — sets the placeholder, and which palette keys make sense. */
  problem?: Problem;
  placeholder?: string;
  /**
   * Drop the built-in Check button. For a surface that already owns a single primary action of its
   * own — the UKUIB lesson player's footer, which has to double as "Continue" once an answer is in
   * — two Check buttons on one screen is a worse affordance than one. Enter still submits.
   */
  hideSubmit?: boolean;
}

/** A definite integral wants a number; an indefinite one wants a function of x. */
function placeholderFor(problem: Problem | undefined): string {
  if (problem?.kind === "definite") return "a number, e.g. pi/4";
  return "your answer, e.g. x^3/3 + C";
}

const PALETTE_KEY = "arcana.integrals.palette";

/** Sticky per browser: whoever wants the keys wants them on every problem, not once. */
function storedPalettePreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(PALETTE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Typing stays the fast path. An equation editor looks better in a screenshot but costs a beat on
 * every keystroke, and this is a timed game — students type `x^2/2 + C` faster than they can click.
 * The live preview underneath is what confirms the parser read them correctly.
 *
 * The palette is the supplement, not the replacement: on a phone `^`, `√` and `π` are two keyboard
 * layers deep, and some students would simply rather build the thing than trust a parser. Both
 * paths end up as the same string against the same grader, so neither can be the "wrong" one.
 */
export default function AnswerInput({
  value,
  onChange,
  onSubmit,
  verdict,
  disabled = false,
  problem,
  placeholder,
  hideSubmit = false,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const id = useId();
  const [paletteOpen, setPaletteOpen] = useState(storedPalettePreference);

  useEffect(() => {
    if (disabled) return;
    // Only where a keyboard is already on screen. On a phone, autofocus throws up the keyboard
    // over the integral the student has not read yet.
    const wide = globalThis.matchMedia?.("(min-width: 640px)").matches ?? true;
    if (wide) ref.current?.focus();
  }, [disabled]);

  const togglePalette = () => {
    setPaletteOpen((open) => {
      try {
        globalThis.localStorage?.setItem(PALETTE_KEY, open ? "0" : "1");
      } catch {
        // A preference we cannot persist is still a preference for this run.
      }
      return !open;
    });
  };

  /** Insert at the caret and put it somewhere useful — inside `sin()`, after `^`. */
  const insert = (token: Token) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token.insert + value.slice(end));
    pendingCaret.current = start + token.insert.length - (token.back ?? 0);
  };

  /** Delete the selection, or the character before the caret. */
  const backspace = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    if (start !== end) {
      onChange(value.slice(0, start) + value.slice(end));
      pendingCaret.current = start;
    } else if (start > 0) {
      onChange(value.slice(0, start - 1) + value.slice(start));
      pendingCaret.current = start - 1;
    }
  };

  // Rewriting the value sends the caret to the end, so it has to be put back — after the DOM has
  // the new text but before the frame is painted, or the caret visibly jumps.
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    ref.current?.focus();
    ref.current?.setSelectionRange(caret, caret);
  }, [value]);

  const reading = readAnswer(value);
  const bad = verdict !== null && verdict.status !== "correct";

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
          placeholder={placeholder ?? placeholderFor(problem)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={`w-full rounded-xl border-2 bg-card py-3.5 pl-4 font-mono text-[17px] text-foreground outline-hidden transition-colors placeholder:text-muted-foreground/40 disabled:opacity-60 ${
            hideSubmit ? "pr-4" : "pr-24"
          } ${bad ? "border-destructive/50" : "border-border focus:border-primary/60"}`}
        />
        {!hideSubmit && (
          <button
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            Check <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div id={`${id}-preview`} className="min-h-[26px] flex-1 px-1 text-[13px]">
          {reading.state === "ok" && (
            <span className="text-muted-foreground">
              reads as <Tex className="ml-1 text-foreground">{reading.latex}</Tex>
            </span>
          )}
          {reading.state === "incomplete" && (
            <span className="text-muted-foreground/70">…still reading that</span>
          )}
          {/* The old input said "…still reading that" here too, and never stopped. Saying which of
              the two it is turns a box that looks stuck into one that has told you what to fix. */}
          {reading.state === "unreadable" && (
            <span className="text-amber-500">
              Can't read that — check the brackets and operators. Nothing is graded until it parses.
            </span>
          )}
          {reading.state === "empty" && (
            <span className="text-muted-foreground/60">
              Type it however you like — <code className="font-mono">ln|x|</code>,{" "}
              <code className="font-mono">sin x</code>, <code className="font-mono">arctan x</code>,{" "}
              <code className="font-mono">x**3</code>, or pasted LaTeX. The{" "}
              <code className="font-mono">+ C</code> is optional.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={togglePalette}
          aria-expanded={paletteOpen}
          aria-controls={`${id}-palette`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Keyboard className="h-3.5 w-3.5" />
          {paletteOpen ? "Hide keys" : "Symbols"}
        </button>
      </div>

      {paletteOpen && (
        <div id={`${id}-palette`}>
          <SymbolPalette problem={problem} onInsert={insert} onBackspace={backspace} />
        </div>
      )}
    </div>
  );
}
