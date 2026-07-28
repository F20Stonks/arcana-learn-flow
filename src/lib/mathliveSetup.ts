import type * as React from "react";
import { MathfieldElement } from "mathlive";

// Self-hosted fonts (copied from node_modules/mathlive/fonts into public/mathlive-fonts) —
// matches this app's existing convention of bundling its own fonts (@fontsource-*) rather than
// depending on the jsDelivr CDN mathlive falls back to by default. Must be set before the first
// <math-field> is constructed; changing it later has no effect.
MathfieldElement.fontsDirectory = "/mathlive-fonts";
MathfieldElement.soundsDirectory = null;

// Gaps in MathLive's default inline-shortcut dictionary found by actually writing a physics
// derivation with it (Schrödinger equation) — `psi`, `omega`, `theta` etc. are all built in, but
// `hbar` isn't, despite being in nearly every line of any quantum mechanics note. `hat`/`vec` seed
// their own #? placeholder the same way the built-in `sum`/`int` shortcuts do, so typing "hat" or
// "vec" mid-expression drops a fillable accent instead of requiring the toolbar.
export const EXTRA_INLINE_SHORTCUTS: Record<string, string> = {
  hbar: "\\hbar",
  hat: "\\hat{#?}",
  vec: "\\vec{#?}",
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement>;
    }
  }
}

export { MathfieldElement };
