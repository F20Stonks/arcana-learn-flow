import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { parseMathSpans } from "@/lib/mathSpans";
import MathComposerPanel from "@/components/MathComposerPanel";

export interface RichMathFieldHandle {
  /** Inserts a chip at the last known cursor position (falls back to end-of-content). */
  insertLatex: (latex: string, display?: boolean) => void;
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Plain Enter fires this instead of inserting a newline (chat send). Omit for free multi-line
   * editing (Notes) — Shift+Enter always inserts a newline regardless. */
  onEnter?: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

// Chromium (and others) can't reliably host a real text caret in the "no man's land" immediately
// beside a contenteditable=false island — typing right after one can silently land somewhere else
// entirely. A zero-width space gives the browser a real, stable text-node anchor to place the
// caret in; it's stripped back out in serializeDom so it never reaches the saved value.
const ZWSP = "​";
const ZWSP_RE = new RegExp(ZWSP, "g");

const CHIP_CLASS_INLINE =
  "math-chip inline-flex items-baseline px-1 mx-px rounded-sm bg-accent/70 hover:bg-accent cursor-pointer align-baseline";
const CHIP_CLASS_DISPLAY =
  "math-chip block my-1 px-2 py-1.5 rounded-md bg-accent/70 hover:bg-accent cursor-pointer text-center";

function renderChipHtml(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: display });
  } catch {
    return display ? `$$${latex}$$` : `$${latex}$`;
  }
}

function createChip(latex: string, display: boolean, onClick: (node: HTMLElement) => void): HTMLElement {
  const chip = document.createElement(display ? "div" : "span");
  chip.contentEditable = "false";
  chip.dataset.latex = latex;
  chip.dataset.display = String(display);
  chip.className = display ? CHIP_CLASS_DISPLAY : CHIP_CLASS_INLINE;
  chip.innerHTML = renderChipHtml(latex, display);
  chip.title = "Click to edit";
  chip.addEventListener("mousedown", (e) => e.preventDefault());
  chip.addEventListener("click", (e) => {
    e.preventDefault();
    onClick(chip);
  });
  return chip;
}

function buildDom(container: HTMLElement, value: string, onChipClick: (node: HTMLElement) => void) {
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
      container.appendChild(createChip(span.latex, span.display, onChipClick));
      container.appendChild(document.createTextNode(ZWSP));
    }
  }
}

function serializeDom(container: HTMLElement): string {
  let out = "";
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent ?? "").replace(ZWSP_RE, "");
    } else if (node instanceof HTMLElement && node.classList.contains("math-chip")) {
      const latex = node.dataset.latex ?? "";
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
 * Rich text field where inserted math renders live as a KaTeX chip, never as raw LaTeX source —
 * the underlying stored value is still a plain "$...$"-delimited string (same format MathRenderer
 * already reads, same format the AI already writes), so nothing downstream of onChange needs to
 * change. Chips are non-editable atomic islands (click reopens the visual composer); everything
 * else is native contentEditable text.
 */
const RichMathField = forwardRef<RichMathFieldHandle, Props>(function RichMathField(
  { value, onChange, onEnter, placeholder, disabled, autoFocus, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [focused, setFocused] = useState(false);
  const [editingChip, setEditingChip] = useState<{ node: HTMLElement; latex: string; display: boolean } | null>(null);

  const openChipEditor = (node: HTMLElement) => {
    setEditingChip({ node, latex: node.dataset.latex ?? "", display: node.dataset.display === "true" });
  };

  const emitChange = () => {
    const container = containerRef.current;
    if (!container) return;
    const serialized = serializeDom(container);
    lastEmittedRef.current = serialized;
    onChange(serialized);
  };

  // Rebuild the DOM from `value` only on mount and when it changes for reasons OTHER than our own
  // typing (switching notes, clearing after send) — rebuilding on every keystroke would blow away
  // the live cursor position.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (value === lastEmittedRef.current) return;
    buildDom(container, value, openChipEditor);
    lastEmittedRef.current = value;
  }, [value]);

  useEffect(() => {
    if (autoFocus) containerRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the live cursor position while this field has focus, so a palette click (which moves
  // focus to a toolbar button or composer) still knows where to insert afterward.
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

  // Focus BEFORE restoring a selection — focusing an element that doesn't already hold focus
  // resets its caret to a default position, which would silently discard whatever range we set
  // beforehand. Always focus first, then place the caret just after the ZWSP anchor that follows
  // `chip` (landing the caret directly on the chip boundary is unreliable in Chromium — see ZWSP).
  const focusAfterNode = (chip: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;
    container.focus();
    let anchor = chip.nextSibling;
    if (!(anchor instanceof Text) || !anchor.data.startsWith(ZWSP)) {
      anchor = document.createTextNode(ZWSP);
      chip.after(anchor);
    }
    const range = document.createRange();
    range.setStart(anchor, 1);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    savedRangeRef.current = range.cloneRange();
  };

  const insertLatex = (latex: string, display = false) => {
    const container = containerRef.current;
    if (!container) return;
    let range = savedRangeRef.current;
    if (!range || !container.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(container);
      range.collapse(false);
    }
    range.deleteContents();
    const chip = createChip(latex, display, openChipEditor);
    range.insertNode(chip);
    chip.after(document.createTextNode(ZWSP));
    focusAfterNode(chip);
    emitChange();
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
      {editingChip && (
        <div className="mt-2">
          <MathComposerPanel
            seed={editingChip.latex}
            onCommit={(latex) => {
              editingChip.node.dataset.latex = latex;
              editingChip.node.innerHTML = renderChipHtml(latex, editingChip.display);
              setEditingChip(null);
              emitChange();
              focusAfterNode(editingChip.node);
            }}
            onCancel={() => {
              setEditingChip(null);
              focusAfterNode(editingChip.node);
            }}
          />
        </div>
      )}
    </div>
  );
});

export default RichMathField;
