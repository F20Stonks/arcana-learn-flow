import type * as React from "react";
import { MathfieldElement } from "mathlive";

// Self-hosted fonts (copied from node_modules/mathlive/fonts into public/mathlive-fonts) —
// matches this app's existing convention of bundling its own fonts (@fontsource-*) rather than
// depending on the jsDelivr CDN mathlive falls back to by default. Must be set before the first
// <math-field> is constructed; changing it later has no effect.
MathfieldElement.fontsDirectory = "/mathlive-fonts";
MathfieldElement.soundsDirectory = null;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement>;
    }
  }
}

export { MathfieldElement };
