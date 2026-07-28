import { useState } from "react";
import MathComposerPanel from "@/components/MathComposerPanel";

interface AtomicSymbol {
  label: string;
  /** Pure LaTeX, no $ wrapper — inserted as a chip directly, no composer needed since there's
   * nothing internal to fill in. */
  latex: string;
}

const SYMBOLS: AtomicSymbol[] = [
  { label: "π", latex: "\\pi" },
  { label: "θ", latex: "\\theta" },
  { label: "Δ", latex: "\\Delta" },
  { label: "∞", latex: "\\infty" },
  { label: "≤", latex: "\\le" },
  { label: "≥", latex: "\\ge" },
  { label: "±", latex: "\\pm" },
  { label: "→", latex: "\\to" },
  { label: "∑", latex: "\\sum" },
  { label: "∫", latex: "\\int" },
];

interface Template {
  label: string;
  /** Pure LaTeX with \placeholder{} marking each blank — MathLive renders these as fillable
   * boxes and lets Tab hop between them, so the student edits a real fraction bar / real matrix
   * grid instead of raw backslash syntax. */
  seed: string;
}

const TEMPLATES: Template[] = [
  { label: "a⁄b", seed: "\\frac{\\placeholder{}}{\\placeholder{}}" },
  { label: "x²", seed: "x^{\\placeholder{}}" },
  { label: "x₁", seed: "x_{\\placeholder{}}" },
  { label: "√", seed: "\\sqrt{\\placeholder{}}" },
  { label: "2×2", seed: "\\begin{pmatrix}\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}\\end{pmatrix}" },
  { label: "vec", seed: "\\begin{pmatrix}\\placeholder{}\\\\\\placeholder{}\\end{pmatrix}" },
];

interface Props {
  /** Called with the finished LaTeX (no $ wrapper) whenever a symbol should be inserted. */
  onInsert: (latex: string) => void;
}

/**
 * Toolbar for building math visually instead of typing LaTeX source. Atomic symbols (π, ≤, ∑…)
 * insert directly since there's nothing to edit. Structural shapes (fractions, matrices…) and the
 * open-ended "Custom" button open an inline MathLive field — a real fraction bar / real grid you
 * click and fill in, Desmos-style — and only the finished LaTeX ever reaches `onInsert`.
 */
export default function MathSymbolPalette({ onInsert }: Props) {
  const [composerSeed, setComposerSeed] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {SYMBOLS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onInsert(s.latex)}
            title={s.latex}
            className="px-2 py-1 rounded-control text-xs font-mono text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent hover:border-border transition-colors"
          >
            {s.label}
          </button>
        ))}
        <span className="w-px my-0.5 bg-border" aria-hidden="true" />
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setComposerSeed(t.seed)}
            title="Open visual math editor"
            className="px-2 py-1 rounded-control text-xs font-mono text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent hover:border-border transition-colors"
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setComposerSeed("")}
          title="Build a custom expression visually"
          className="px-2 py-1 rounded-control text-xs text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent hover:border-border transition-colors"
        >
          + Custom
        </button>
      </div>

      {composerSeed !== null && (
        <MathComposerPanel
          seed={composerSeed}
          onCommit={(latex) => {
            onInsert(latex);
            setComposerSeed(null);
          }}
          onCancel={() => setComposerSeed(null)}
        />
      )}
    </div>
  );
}
