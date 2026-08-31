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
  | "introducing-constants"
  | "log-power-integrals"
  | "reciprocal-substitution"
  | "gamma-function"
  | "zeta-series"
  | "wallis-product"
  | "gaussian-hypersphere";

/** 1 = warm-up, 5 = the one that eats your lunch break. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

/**
 * Competition/document provenance for a problem. `name` is a competition or source document
 * ("original" for pedagogical examples with no single-competition source); `year` and `round`
 * are whatever the source document actually gives — a specific year and section/round for a
 * real competition set, absent for "original".
 */
export interface ProblemSource {
  name: string;
  year?: number;
  round?: string;
}

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
  /**
   * Where the problem came from — a specific competition, or {name: "original"} for
   * pedagogical examples with no single-competition provenance. Lets a student practice a
   * technique across the whole bank (technique filter) or work one competition's set exactly as
   * it was set (source filter) — two independent ways to slice the same bank.
   */
  source: ProblemSource;
  /** Progressive: hint 0 nudges, the last one all but hands it over. */
  hints: string[];
  /** The worked solution, revealed after a solve or a give-up. Each line is LaTeX-in-prose. */
  steps: string[];
}

/**
 * A fully worked example: prompt, then the beats of the work, then the result.
 *
 * `integrandExpr`/`resultExpr`/`domain`/`kind` are the same machine-checkable-mirror pattern as
 * `Problem.integrandExpr`/`answer`/`domain`/`kind` — optional, and set only when the example states
 * a literal evaluatable integral (as opposed to a derivation of an identity, or a qualitative aside
 * with no single closed-form claim). When present, lessonExamples.test.ts differentiates
 * (`kind: "indefinite"`) or numerically integrates (`kind: "definite"`) `integrandExpr` and checks
 * it against `resultExpr`, exactly the guardrail `problems.test.ts` already applies to the graded
 * bank: a lesson containing wrong algebra is worse than a terse correct one, and prose alone is
 * invisible to any existing test.
 */
export interface WorkedExample {
  /** LaTeX shown to the reader, without the ∫ or the dx — the UI wraps it. */
  integrand: string;
  work: string[];
  result: string;
  integrandExpr?: string;
  resultExpr?: string;
  /** Required whenever integrandExpr is set. Same meaning as Problem.domain: where the checker may
   *  sample (indefinite) or the bounds to integrate over (definite). */
  domain?: [number, number];
  kind?: ProblemKind;
}

/**
 * A completion problem: work shown down to a gap, then the gap itself. Evidence on retention (see
 * UK_BEE_BURST.md WS-10) says a partially worked example with the last step or two left blank beats
 * both a fully worked example and an unaided problem for a learner at this stage — it forces the
 * reader to actually execute the technique's characteristic final move, rather than only recognising
 * it on the page.
 *
 * `integrandExpr`/`resultExpr`/`domain`/`kind` are the same optional machine-checkable-mirror pattern
 * as `WorkedExample` — set whenever `setup` + `blank` + `answer` together state a literal evaluatable
 * integral (the overwhelming majority of completions), so lessonExamples.test.ts can differentiate or
 * numerically integrate the claim exactly as it already does for graduated examples. `resultExpr` is
 * the FULL closed form once the blank is filled in, not just the filled-in piece — the thing being
 * checked is "this integral equals this," the same claim a WorkedExample makes, just revealed in two
 * stages instead of one.
 */
export interface Completion {
  /** LaTeX lines already filled in, prose-in-math exactly like WorkedExample.work — starts from the
   *  integral itself and narrates the steps down to (but not including) the gap. */
  setup: string[];
  /** What's missing, described for the reader — shown before the reveal, alongside the setup. */
  blank: string;
  /** The correct completion, revealed on demand. */
  answer: string;
  integrandExpr?: string;
  resultExpr?: string;
  domain?: [number, number];
  kind?: ProblemKind;
}

export interface Technique {
  id: TechniqueId;
  name: string;
  /** One line, shown on the technique card. */
  tagline: string;
  /**
   * What the reader should already be solid on — so someone stuck mid-lesson knows exactly where
   * to go back to, rather than re-reading the same paragraph. Free text (technique names where
   * that's the prerequisite, or a bare skill like "the double-angle identities"); LessonBody links
   * any entry that matches an existing technique's name. Populated for lessons rebuilt in the
   * A-level-bridge pass (see UK_BEE_BURST.md); absent — not required — elsewhere.
   */
  prerequisites?: string[];
  /** When to reach for it — the recognition cue, which is the part students actually lack. */
  whenToUse: string;
  /**
   * Why the move works, in plain terms, before the recipe says what to do — the derivation or
   * motivating picture behind the recipe, not just the recognition cue `whenToUse` already gives.
   * A reader who understands *why* t = tan(x/2) turns sin and cos rational doesn't have to memorise
   * the substitution as an arbitrary incantation.
   */
  intuition?: string;
  /** The recipe, as numbered beats. */
  recipe: string[];
  /**
   * The legacy singular worked example. Kept so every existing reader of `.example` — LessonBody's
   * fallback rendering, mathText.test.ts's render-everything check — keeps working unedited. Equal
   * to `examples[0]` wherever `examples` is populated (never authored separately, so the two can
   * never drift apart).
   */
  example: WorkedExample;
  /**
   * Graduated worked examples, in order: the first spells out every algebraic step including the
   * ones that feel obvious, later ones compress as the reader gains footing. Optional until a
   * lesson has been rebuilt for the A-level-bridge pass (see UK_BEE_BURST.md WS-2).
   */
  examples?: WorkedExample[];
  /** Gotchas worth naming out loud. */
  pitfalls: string[];
  /**
   * One scaffolded problem to try before the reader is dropped into the graded bank — reveal-only
   * (a hint, then the answer), not a live-graded input: this is a self-check, not another Problem.
   */
  checkYourself?: { prompt: string; answer: string; hint: string };
  /**
   * Partially worked examples — see `Completion`'s own doc comment for why these exist. Zero or more
   * per technique; unlike `examples`, there is no legacy singular field to keep in sync with.
   */
  completions?: Completion[];
  /**
   * One question that forces processing rather than recognition — "why this substitution and not the
   * obvious one," not "what is the substitution." Reveal-only, exactly like `checkYourself`'s shape
   * and rendering convention, but there is no numeric answer to grade: this is prose reasoning, so it
   * carries no machine-checkable mirror the way `checkYourself.answer` sometimes implicitly does via
   * the technique's own worked examples. Any numeric or algebraic claim written into `answer` is still
   * hand-verified before shipping, per the same guardrail as everything else in this file.
   */
  selfExplain?: { prompt: string; answer: string };
}

/** The verdict a graded attempt produces. */
export type Verdict =
  | { status: "correct" }
  | { status: "incorrect"; reason?: string }
  | { status: "unparseable"; reason: string }
  /** Right shape, wrong constant — the classic dropped 1/2. Worth its own message. */
  | { status: "off-by-constant-factor"; factor: number };
