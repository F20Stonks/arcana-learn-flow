/**
 * Integral Arena — domain types.
 *
 * Self-contained feature: everything the game needs (problem bank, answer checking, scoring,
 * progression) lives under src/features/integrals and touches nothing else in the app except
 * AppShell and the router.
 */

/** The techniques the training mode teaches, in the order a student meets them. */
export type TechniqueId =
  | "power"
  | "u-sub"
  | "parts"
  | "trig-identity"
  | "trig-sub"
  | "partial-fractions"
  | "complete-square"
  | "symmetry"
  | "feynman"
  | "t-sub"
  | "recurrence"
  | "inverse-integral"
  | "floor-function"
  | "beta-integrals"
  | "introducing-constants";

/** 1 = warm-up, 5 = the one that eats your lunch break. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

/**
 * Indefinite problems are graded up to an additive constant; definite ones are graded as a single
 * number. Two different checkers, one problem type — see answer.ts.
 */
export type ProblemKind = "indefinite" | "definite";

export interface Problem {
  id: string;
  kind: ProblemKind;
  /** The integrand, as LaTeX, without the ∫ or the dx — the UI wraps it. */
  integrand: string;
  /**
   * The same integrand in gradeable syntax. Nothing in the game shows it; it exists so the bank
   * can check itself — see problems.test.ts, which differentiates every stored answer and compares
   * it back to this. A typo in `answer` fails the suite instead of failing a student.
   */
  integrandExpr: string;
  /** Definite problems only: LaTeX bounds, rendered on the sign. */
  lower?: string;
  upper?: string;
  /**
   * The reference antiderivative (indefinite) or exact value (definite), in the same relaxed
   * syntax students type. Never shown raw — `answerLatex` is what the UI renders.
   */
  answer: string;
  answerLatex: string;
  /**
   * Where the grader is allowed to sample. Must be an interval on which the reference
   * antiderivative is real, finite and free of poles — see checkIndefinite.
   */
  domain: [number, number];
  difficulty: Difficulty;
  /** Primary technique first: that's the one training mode files it under. */
  techniques: TechniqueId[];
  /** Progressive: hint 0 nudges, the last one all but hands it over. */
  hints: string[];
  /** The worked solution, revealed after a solve or a give-up. Each line is LaTeX-in-prose. */
  steps: string[];
}

export interface Technique {
  id: TechniqueId;
  name: string;
  /** One line, shown on the technique card. */
  tagline: string;
  /** When to reach for it — the recognition cue, which is the part students actually lack. */
  whenToUse: string;
  /** The recipe, as numbered beats. */
  recipe: string[];
  /** A fully worked example: prompt, then the beats of the work. */
  example: { integrand: string; work: string[]; result: string };
  /** Gotchas worth naming out loud. */
  pitfalls: string[];
}

/** The verdict a graded attempt produces. */
export type Verdict =
  | { status: "correct" }
  | { status: "incorrect"; reason?: string }
  | { status: "unparseable"; reason: string }
  /** Right shape, wrong constant — the classic dropped 1/2. Worth its own message. */
  | { status: "off-by-constant-factor"; factor: number };
