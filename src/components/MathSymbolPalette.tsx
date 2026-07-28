import { Fragment, useEffect, useState } from "react";
import { Keyboard, KeyboardOff } from "lucide-react";

interface Entry {
  label: string;
  /** Pure LaTeX (no $ wrapper). `#?` marks a fillable blank — MathLive's own placeholder token
   * (the same one its built-in "sum"/"int" shortcuts use), so Tab hops between them. */
  seed: string;
}

// Greek + basics — the ones with no internal structure insert and are done; a student can also
// just type these names directly into a live chip (MathLive recognizes them natively), these
// buttons are for discoverability/mouse-preference, not the only way to get them.
const BASICS: Entry[] = [
  { label: "π", seed: "\\pi" },
  { label: "θ", seed: "\\theta" },
  { label: "Δ", seed: "\\Delta" },
  { label: "ħ", seed: "\\hbar" },
  { label: "∞", seed: "\\infty" },
  { label: "≤", seed: "\\le" },
  { label: "≥", seed: "\\ge" },
  { label: "±", seed: "\\pm" },
  { label: "→", seed: "\\to" },
];

// Calculus — found to matter most by actually writing a physics derivation with this tool:
// partial/total derivatives recur constantly and previously needed 4-5 chained keystrokes with no
// dedicated shortcut.
const CALCULUS: Entry[] = [
  { label: "a⁄b", seed: "\\frac{#?}{#?}" },
  { label: "∂f/∂x", seed: "\\frac{\\partial #?}{\\partial #?}" },
  { label: "∂²f/∂x²", seed: "\\frac{\\partial^2 #?}{\\partial #?^2}" },
  { label: "df/dx", seed: "\\frac{d#?}{d#?}" },
  { label: "∑", seed: "\\sum_{#?}^{#?}" },
  { label: "∫", seed: "\\int_{#?}^{#?}" },
  { label: "lim", seed: "\\lim_{#?\\to#?}#?" },
  { label: "√", seed: "\\sqrt{#?}" },
  { label: "ⁿ√", seed: "\\sqrt[#?]{#?}" },
];

// Structures
const STRUCTURES: Entry[] = [
  { label: "x²", seed: "x^{#?}" },
  { label: "x₁", seed: "x_{#?}" },
  { label: "|x|", seed: "\\left|#?\\right|" },
  { label: "x̂", seed: "\\hat{#?}" },
  { label: "x⃗", seed: "\\vec{#?}" },
  { label: "2×2", seed: "\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}" },
  { label: "vec", seed: "\\begin{pmatrix}#?\\\\#?\\end{pmatrix}" },
];

const GROUPS = [BASICS, CALCULUS, STRUCTURES];

interface Props {
  /** Called with a LaTeX seed (may contain #? placeholders) whenever a new expression should be
   * dropped in as a live, editable chip at the current cursor position. */
  onInsert: (seed: string) => void;
}

/**
 * Toolbar for starting math without knowing any LaTeX vocabulary up front — every button drops a
 * live, directly-editable chip at the cursor (Tab hops between any blanks). This is the visible,
 * mouse-driven entry point; once inside a chip, typing shorthand (theta, sum, 1/2, x^2, hbar…) is
 * faster and MathLive's own autocomplete teaches the vocabulary as you go. Ctrl/Cmd+M does the
 * same as "+ Custom" without leaving the keyboard.
 */
export default function MathSymbolPalette({ onInsert }: Props) {
  // Mirrors MathLive's own global virtual-keyboard visibility so the button's icon stays correct
  // no matter what toggled it (this button, or the small native toggle MathLive renders inside a
  // focused chip itself) — a plain document-level click listener sidesteps `window.mathVirtualKeyboard`
  // not existing yet until the first chip has ever mounted, and re-reads the true state after
  // whatever handler (ours or MathLive's own) already ran on the same click.
  const [kbdVisible, setKbdVisible] = useState(false);
  useEffect(() => {
    const sync = () => setKbdVisible(!!window.mathVirtualKeyboard?.visible);
    document.addEventListener("click", sync);
    return () => document.removeEventListener("click", sync);
  }, []);

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {GROUPS.map((group, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="w-px my-0.5 bg-border" aria-hidden="true" />}
          {group.map((e) => (
            <button
              key={e.label}
              type="button"
              onClick={() => onInsert(e.seed)}
              title={e.seed.replace(/#\?/g, "▢")}
              className="px-2 py-1 rounded-control text-xs font-mono text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent hover:border-border transition-colors"
            >
              {e.label}
            </button>
          ))}
        </Fragment>
      ))}
      <span className="w-px my-0.5 bg-border" aria-hidden="true" />
      <button
        type="button"
        onClick={() => onInsert("")}
        title="New expression (Ctrl+M / ⌘M)"
        className="px-2 py-1 rounded-control text-xs text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent hover:border-border transition-colors"
      >
        + Custom
      </button>
      <button
        type="button"
        onClick={() => {
          const kbd = window.mathVirtualKeyboard;
          if (!kbd) return;
          if (kbd.visible) kbd.hide();
          else kbd.show({ animate: true });
        }}
        title={kbdVisible ? "Hide keyboard" : "Show keyboard"}
        aria-label={kbdVisible ? "Hide keyboard" : "Show keyboard"}
        className="ml-auto px-2 py-1 rounded-control text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent hover:border-border transition-colors"
      >
        {kbdVisible ? <KeyboardOff className="h-3.5 w-3.5" /> : <Keyboard className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
