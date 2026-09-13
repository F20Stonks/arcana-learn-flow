import { Delete } from "lucide-react";
import type { Problem } from "../types";

export interface Token {
  /** What appears on the key. */
  label: string;
  /** What it types. Always in the plainest syntax the grader accepts, never LaTeX. */
  insert: string;
  /** Where the caret lands, counted back from the end of the inserted text. */
  back?: number;
  /** Read out to assistive tech, and shown on hover — the key faces are symbols, not words. */
  title: string;
}

interface Group {
  name: string;
  tokens: Token[];
}

const STRUCTURE: Group = {
  name: "Build",
  tokens: [
    { label: "( )", insert: "()", back: 1, title: "Brackets" },
    { label: "x", insert: "x", title: "x" },
    { label: "^", insert: "^", title: "To the power of" },
    { label: "√", insert: "sqrt()", back: 1, title: "Square root" },
    { label: "a/b", insert: "/", title: "Divide" },
    { label: "|x|", insert: "abs()", back: 1, title: "Absolute value" },
    { label: "π", insert: "pi", title: "pi" },
    { label: "e", insert: "e", title: "Euler's number" },
  ],
};

const LOGS: Group = {
  name: "Log & exp",
  tokens: [
    { label: "ln", insert: "ln()", back: 1, title: "Natural log" },
    { label: "eˣ", insert: "exp()", back: 1, title: "e to the power of" },
    { label: "log₁₀", insert: "log10()", back: 1, title: "Log base 10" },
  ],
};

const TRIG: Group = {
  name: "Trig",
  tokens: [
    { label: "sin", insert: "sin()", back: 1, title: "Sine" },
    { label: "cos", insert: "cos()", back: 1, title: "Cosine" },
    { label: "tan", insert: "tan()", back: 1, title: "Tangent" },
    { label: "sec", insert: "sec()", back: 1, title: "Secant" },
    { label: "csc", insert: "csc()", back: 1, title: "Cosecant" },
    { label: "cot", insert: "cot()", back: 1, title: "Cotangent" },
  ],
};

const INVERSE: Group = {
  name: "Inverse & hyperbolic",
  tokens: [
    { label: "arcsin", insert: "arcsin()", back: 1, title: "Inverse sine" },
    { label: "arccos", insert: "arccos()", back: 1, title: "Inverse cosine" },
    { label: "arctan", insert: "arctan()", back: 1, title: "Inverse tangent" },
    { label: "sinh", insert: "sinh()", back: 1, title: "Hyperbolic sine" },
    { label: "cosh", insert: "cosh()", back: 1, title: "Hyperbolic cosine" },
    { label: "tanh", insert: "tanh()", back: 1, title: "Hyperbolic tangent" },
    { label: "artanh", insert: "artanh()", back: 1, title: "Inverse hyperbolic tangent" },
  ],
};

/**
 * Special-value functions. A student who correctly reduces an integral to e.g. ζ(2) or Γ(5/2)
 * shouldn't have to separately know (or look up) its elementary closed form to get credit — these
 * evaluate live, exactly like a memorised constant would, and grade identically either way.
 */
const SPECIAL: Group = {
  name: "Special values",
  tokens: [
    { label: "Γ( )", insert: "gamma()", back: 1, title: "Gamma function, evaluated at a value" },
    { label: "ζ( )", insert: "zeta()", back: 1, title: "Riemann zeta function, evaluated at a value" },
    { label: "B( , )", insert: "beta(,)", back: 2, title: "Euler beta function B(a, b)" },
    { label: "erf( )", insert: "erf()", back: 1, title: "Error function" },
    { label: "⌊ ⌋", insert: "floor()", back: 1, title: "Floor" },
    { label: "⌈ ⌉", insert: "ceil()", back: 1, title: "Ceiling" },
  ],
};

const PLUS_C: Token = { label: "+ C", insert: " + C", title: "Constant of integration" };

/**
 * The keys on offer for one problem.
 *
 * A definite integral's answer is a number, so `x` and `+ C` are not just unnecessary there —
 * offering them invites the two mistakes the grader has to reject by name.
 */
function tokensFor(problem: Problem | undefined): Group[] {
  const definite = problem?.kind === "definite";
  const structure: Group = {
    ...STRUCTURE,
    tokens: definite
      ? STRUCTURE.tokens.filter((t) => t.label !== "x")
      : [...STRUCTURE.tokens, PLUS_C],
  };
  return [structure, LOGS, TRIG, INVERSE, SPECIAL];
}

interface Props {
  problem?: Problem;
  onInsert: (token: Token) => void;
  /** Building an answer by clicking is no use if fixing a slip means reaching for the keyboard. */
  onBackspace?: () => void;
}

/**
 * A structural way in, alongside the free-text box rather than instead of it.
 *
 * The typed parser is the fast path and stays the default — but it is only as good as a student's
 * confidence in it, and on a phone the characters this game is made of (^, √, π) are two keyboard
 * layers deep. These keys type the plainest syntax the grader accepts, so anything built here is
 * unambiguous by construction.
 *
 * `onMouseDown` is where the press is cancelled, not `onClick`: the input must not lose focus, or
 * the caret position the insertion depends on is gone before the handler runs.
 */
export default function SymbolPalette({ problem, onInsert, onBackspace }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3">
      {tokensFor(problem).map((group) => (
        <div key={group.name}>
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
            {group.name}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {onBackspace && group.name === "Build" && (
              <button
                type="button"
                title="Delete"
                aria-label="Delete the character before the cursor"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onBackspace}
                className="order-last ml-auto flex items-center rounded-lg border border-border bg-background px-2.5 py-2 text-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <Delete className="h-4 w-4" />
              </button>
            )}
            {group.tokens.map((token) => (
              <button
                key={token.label}
                type="button"
                title={token.title}
                aria-label={token.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(token)}
                className="readout min-w-[2.5rem] rounded-lg border border-border bg-background px-2.5 py-2 text-[14px] text-foreground transition-colors hover:border-primary/50 hover:bg-accent/60 active:bg-accent"
              >
                {token.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
