import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import "@/lib/mathliveSetup";
import { EXTRA_INLINE_SHORTCUTS, type MathfieldElement } from "@/lib/mathliveSetup";
import { parseMathSpans } from "@/lib/mathSpans";

export interface RichMathFieldHandle {
  /** Creates a new live math chip at the last known cursor position (falls back to end-of-content)
   * and focuses it — the student types directly into it, no popup involved. */
  insertLatex: (seed: string) => void;
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Plain Enter fires this instead of inserting a newline (chat send). Omit for free multi-line
   * editing (Notes) — Shift+Enter always inserts a newline regardless. Ignored while focus is
   * inside a math chip (MathLive owns Enter there). */
  onEnter?: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

// Chromium (and others) can't reliably host a real text caret in the "no man's land" immediately
// beside an embedded custom element — a zero-width space gives it a real, stable text-node anchor
// to place the caret in; it's stripped back out in serializeDom so it never reaches the saved value.
const ZWSP = "​";
const ZWSP_RE = new RegExp(ZWSP, "g");

const CHIP_CLASS_INLINE = "math-chip inline-block align-baseline mx-px";
const CHIP_CLASS_DISPLAY = "math-chip block my-1";

// `.inlineShortcuts`/`.value`/`.mathVirtualKeyboardPolicy` all touch MathLive's internal model,
// which throws "Mathfield not mounted" if accessed before the element is connected to the DOM —
// createChip only sets generic, connection-independent DOM properties; callers must append the
// returned element to a live container first, then call mountChip.
function createChip(display: boolean, onMoveOut: (direction: string, chip: HTMLElement) => void) {
  const chip = document.createElement("math-field") as MathfieldElement;
  chip.dataset.display = String(display);
  chip.className = display ? CHIP_CLASS_DISPLAY : CHIP_CLASS_INLINE;
  if (display) chip.style.fontSize = "1.15em";
  // MathLive's host box has no background of its own, but leaving it unset renders whatever the
  // browser's own light-mode form-control default is — this app is dark-only, so pin every theme
  // knob explicitly rather than let it drift with the OS color-scheme.
  chip.style.backgroundColor = "transparent";
  chip.style.color = "var(--foreground)";
  chip.style.setProperty("--caret-color", "var(--primary)");
  chip.style.setProperty("--placeholder-color", "var(--muted-foreground)");
  chip.style.setProperty("--selection-color", "var(--primary-foreground)");
  chip.style.setProperty("--selection-background-color", "var(--primary)");
  chip.style.setProperty("--primary", "var(--primary)");
  chip.addEventListener("move-out", ((e: CustomEvent<{ direction: string }>) => {
    onMoveOut(e.detail.direction, chip);
  }) as EventListener);
  return chip;
}

function mountChip(chip: MathfieldElement, seed: string) {
  chip.inlineShortcuts = { ...chip.inlineShortcuts, ...EXTRA_INLINE_SHORTCUTS };
  chip.mathVirtualKeyboardPolicy = "manual";
  chip.value = seed;
}

function buildDom(container: HTMLElement, value: string, onMoveOut: (direction: string, chip: HTMLElement) => void) {
  container.innerHTML = "";
  for (const span of parseMathSpans(value)) {
    if (span.type === "text") {
      // Preserve embedded newlines as <br> so serialization round-trips losslessly.
      const lines = span.content.split("\n");
      lines.forEach((line, i) => {
        if (i > 0) container.appendChild(document.createElement("br"));
        if (line) container.appendChild(document.createTextNode(line));
      });
    } else {
      const chip = createChip(span.display, onMoveOut);
      container.appendChild(chip);
      mountChip(chip, span.latex);
      container.appendChild(document.createTextNode(ZWSP));
    }
  }
}

function serializeDom(container: HTMLElement): string {
  let out = "";
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent ?? "").replace(ZWSP_RE, "");
    } else if (node instanceof HTMLElement && node.tagName === "MATH-FIELD") {
      // Two chips sitting directly next to each other (their only DOM separator, a ZWSP, is
      // stripped above) would otherwise butt their $ delimiters together — "...4ac$$$hbar$" is
      // ambiguous and remark-math fails to parse the whole rest of the paragraph as a result.
      if (out.endsWith("$")) out += " ";
      // A blank never filled in (student sent/clicked away before tabbing to it) shouldn't survive
      // as literal "\placeholder{}" — KaTeX renders that as the visible word "placeholder" forever.
      const latex = (node as MathfieldElement).value.replace(/\\placeholder\{\}/g, "");
      out += node.dataset.display === "true" ? `$$${latex}$$` : `$${latex}$`;
    } else if (node instanceof HTMLBRElement) {
      out += "\n";
    } else if (node instanceof HTMLElement) {
      out += (node.textContent ?? "") + "\n";
    }
  }
  return out;
}

/**
 * Rich text field where math is a permanently-live MathLive chip, never a static render you have
 * to reopen a popup to edit — click directly into one and it's instantly editable in place. The
 * underlying stored value is still a plain "$...$"-delimited string (same format MathRenderer
 * already reads, same format the AI already writes); only the editing widget changed.
 */
const RichMathField = forwardRef<RichMathFieldHandle, Props>(function RichMathField(
  { value, onChange, onEnter, placeholder, disabled, autoFocus, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [focused, setFocused] = useState(false);

  const emitChange = () => {
    const container = containerRef.current;
    if (!container) return;
    const serialized = serializeDom(container);
    lastEmittedRef.current = serialized;
    onChange(serialized);
  };

  // Arrow/Tab past a chip's edge with nowhere left to go inside it — MathLive's cue that focus
  // should move back out to the surrounding prose, right before or after the chip.
  const handleMoveOut = (direction: string, chip: HTMLElement) => {
    const container = containerRef.current;
    if (!container || (direction !== "forward" && direction !== "backward")) return;
    const range = document.createRange();
    if (direction === "forward") range.setStartAfter(chip);
    else range.setStartBefore(chip);
    range.collapse(true);
    container.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    savedRangeRef.current = range.cloneRange();
  };

  // Rebuild the DOM from `value` only on mount and when it changes for reasons OTHER than our own
  // typing (switching notes, clearing after send) — rebuilding on every keystroke would blow away
  // the live cursor position and any chip currently being edited.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (value === lastEmittedRef.current) return;
    buildDom(container, value, handleMoveOut);
    lastEmittedRef.current = value;
  }, [value]);

  useEffect(() => {
    if (autoFocus) containerRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // contentEditable={false} on the container blocks prose typing but has no effect on the
  // independent focusable chips inside it — each MathfieldElement's own readOnly has to be kept
  // in sync explicitly, since `disabled` (e.g. isStreaming) can flip after chips already exist.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll("math-field").forEach((el) => {
      (el as MathfieldElement).readOnly = !!disabled;
    });
  }, [disabled, value]);

  // Track the live cursor position while this field has focus, so a palette click (which moves
  // focus to a toolbar button) still knows where to insert afterward.
  useEffect(() => {
    const handler = () => {
      const container = containerRef.current;
      if (!container) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (container.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  const insertBreak = () => {
    const container = containerRef.current;
    const sel = window.getSelection();
    if (!container || !sel) return;
    let range = savedRangeRef.current;
    if (!range || !container.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(container);
      range.collapse(false);
    }
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRangeRef.current = range.cloneRange();
    emitChange();
  };

  const insertLatex = (seed: string) => {
    const container = containerRef.current;
    if (!container) return;
    let range = savedRangeRef.current;
    if (!range || !container.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(container);
      range.collapse(false);
    }
    range.deleteContents();
    const chip = createChip(false, handleMoveOut);
    range.insertNode(chip);
    mountChip(chip, seed);
    const zwsp = document.createTextNode(ZWSP);
    chip.after(zwsp);
    emitChange();
    chip.focus();
    if (seed.includes("#?")) chip.executeCommand("moveToNextPlaceholder");
  };

  useImperativeHandle(ref, () => ({
    insertLatex,
    focus: () => containerRef.current?.focus(),
  }));

  const isEmpty = value === "";

  return (
    <div className="relative flex-1 min-w-0">
      {placeholder && isEmpty && !focused && (
        <span className="absolute left-0 top-0 text-sm text-muted-foreground pointer-events-none select-none">
          {placeholder}
        </span>
      )}
      <div
        ref={containerRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          // MathLive owns keystrokes originating from inside a chip — let it handle its own Enter,
          // Tab, arrow navigation, etc. entirely undisturbed.
          if ((e.target as HTMLElement).tagName === "MATH-FIELD") return;
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
            e.preventDefault();
            insertLatex("");
            return;
          }
          if (e.key === "Enter") {
            if (e.shiftKey || !onEnter) {
              e.preventDefault();
              insertBreak();
            } else {
              e.preventDefault();
              onEnter();
            }
          }
        }}
        className={
          className ??
          "text-sm text-foreground outline-hidden leading-relaxed whitespace-pre-wrap break-words min-h-[1.5em]"
        }
      />
    </div>
  );
});

export default RichMathField;
