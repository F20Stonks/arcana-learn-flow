import { CSSProperties, useState } from "react";
// Side-effect-only import (registers <math-field> + sets fontsDirectory) kept separate from the
// type import below — `MathfieldElement` is only ever used in type positions in this file, and
// SWC/esbuild's isolatedModules transform silently elides an import whose binding looks type-only
// from single-file analysis, which would drop this module's registration side effect entirely.
import "@/lib/mathliveSetup";
import type { MathfieldElement } from "@/lib/mathliveSetup";

interface Props {
  /** Pure LaTeX (no $ wrapper), optionally containing \placeholder{} blanks to fill in. */
  seed: string;
  onCommit: (latex: string) => void;
  onCancel: () => void;
}

/**
 * A visual math editor (MathLive) for composing or editing one expression — a real fraction bar
 * / real matrix grid you click and fill in, instead of typing LaTeX source. Purely presentational:
 * doesn't know whether the result becomes a chip in a rich field or gets spliced into plain text.
 */
export default function MathComposerPanel({ seed, onCommit, onCancel }: Props) {
  const [field, setField] = useState<MathfieldElement | null>(null);

  const commit = () => {
    const latex = field?.value.trim() ?? "";
    if (latex) onCommit(latex);
    else onCancel();
  };

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-primary/40 bg-card px-3 py-2"
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <math-field
        ref={(node: MathfieldElement | null) => {
          setField(node);
          if (!node) return;
          // The custom element's internal model isn't guaranteed ready in the same tick it's
          // attached (its heavy setup is deferred internally) — a raw ref callback can fire
          // before `.executeCommand` exists yet, so give it a frame before touching the API.
          requestAnimationFrame(() => {
            node.value = seed;
            node.focus();
            if (seed.includes("\\placeholder") && typeof node.executeCommand === "function") {
              node.executeCommand("moveToNextPlaceholder");
            }
          });
        }}
        math-virtual-keyboard-policy="manual"
        className="flex-1 text-sm"
        style={{
          "--caret-color": "var(--primary)",
          "--placeholder-color": "var(--muted-foreground)",
          "--selection-background-color": "var(--accent)",
          "--primary": "var(--primary)",
          color: "var(--foreground)",
          backgroundColor: "transparent",
        } as CSSProperties}
      />
      <button
        type="button"
        onClick={commit}
        className="shrink-0 px-2.5 py-1 rounded-control text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Insert
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 px-2 py-1 rounded-control text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
