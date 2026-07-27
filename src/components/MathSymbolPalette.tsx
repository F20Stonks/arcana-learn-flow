import { RefObject } from "react";

interface MathSymbol {
  label: string;
  /** Self-contained — always its own $...$ span, so it never depends on whether the cursor
   * happens to already be "inside" math mode elsewhere in the text. */
  template: string;
  /** Character range (relative to the start of `template`) to select after insertion, so typing
   * immediately replaces the placeholder instead of the student having to hunt for it. */
  selectFrom?: number;
  selectTo?: number;
}

const SYMBOLS: MathSymbol[] = [
  { label: "a⁄b", template: "$\\frac{a}{b}$", selectFrom: 7, selectTo: 8 },
  { label: "x²", template: "$x^{2}$", selectFrom: 1, selectTo: 2 },
  { label: "x₁", template: "$x_{1}$", selectFrom: 1, selectTo: 2 },
  { label: "√", template: "$\\sqrt{x}$", selectFrom: 7, selectTo: 8 },
  { label: "2×2", template: "$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$", selectFrom: 17, selectTo: 18 },
  { label: "vec", template: "$\\begin{pmatrix} a \\\\ b \\end{pmatrix}$", selectFrom: 17, selectTo: 18 },
  { label: "π", template: "$\\pi$" },
  { label: "θ", template: "$\\theta$" },
  { label: "Δ", template: "$\\Delta$" },
  { label: "∞", template: "$\\infty$" },
  { label: "≤", template: "$\\le$" },
  { label: "≥", template: "$\\ge$" },
  { label: "±", template: "$\\pm$" },
  { label: "→", template: "$\\to$" },
  { label: "∑", template: "$\\sum$" },
  { label: "∫", template: "$\\int$" },
];

interface Props {
  targetRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (next: string) => void;
}

/**
 * Inserts real LaTeX at the cursor so a student never has to know `\frac` or `\begin{pmatrix}`
 * exists — click a symbol, the placeholder inside it is pre-selected, type to replace. Shared
 * between the session chat input and Notes editing, since both are raw-LaTeX text fields.
 */
export default function MathSymbolPalette({ targetRef, value, onChange }: Props) {
  const insert = (sym: MathSymbol) => {
    const el = targetRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + sym.template + value.slice(end);
    onChange(next);
    // The DOM value hasn't caught up with `next` yet on this tick (React commits async) — wait a
    // beat before touching selection, or setSelectionRange clamps against the stale, shorter value.
    setTimeout(() => {
      if (!el) return;
      el.focus();
      const from = start + (sym.selectFrom ?? sym.template.length);
      const to = start + (sym.selectTo ?? sym.template.length);
      el.setSelectionRange(from, to);
    }, 0);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {SYMBOLS.map((s) => (
        <button
          key={s.label}
          type="button"
          // Without this, the mousedown shifts focus to the button before the click fires,
          // which for a click-to-edit field (Notes) would blur-and-commit the textarea —
          // closing edit mode a beat before the insertion ever happens.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insert(s)}
          title={s.template.replace(/\$/g, "")}
          className="px-2 py-1 rounded-control text-xs font-mono text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent hover:border-border transition-colors"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
