/**
 * Quant OA Arena — domain types.
 *
 * Self-contained feature (see docs/quant-assessment-arena-scope.md): everything the assessments
 * need lives under src/features/assessments and touches nothing else in the app except AppShell
 * and the router.
 *
 * The organising idea: a firm is a *configuration*, not a feature. Optiver's 80-in-8 and Akuna's
 * 80-in-8 are the same ModuleSpec with different generator configs; the Flow Traders math test is
 * that module again with `input: "choice"`. Adding a firm should mean adding a data file, not a
 * code path.
 *
 * THIS FILE IS THE FROZEN CONTRACT. Module authors read it; they do not edit it. A change here
 * invalidates every module at once, so changes go through one owner.
 */

/**
 * How the candidate answers. `custom` is the escape hatch for modules that own their whole
 * interaction surface (market making, the cognitive games) and report a score rather than a
 * per-item string.
 */
export type ItemInputKind = "typed-number" | "typed-text" | "choice" | "interval" | "custom";

export interface ItemChoice {
  /** Stable within the item. `AssessmentItem.answer` holds the id of the correct one. */
  id: string;
  label: string;
}

export interface AssessmentItem {
  /** Unique per generated instance, not per item type. */
  id: string;
  /**
   * Stable tag for the debrief breakdown and weak-spot targeting, e.g. 'mul_2x2', 'seq_interleave',
   * 'prob_bayes'. Deliberately the same semantics as drill_attempts.problem_tag so the existing
   * weak-spot aggregation transfers unchanged.
   */
  tag: string;
  /** Rendered as-is; wrap in $...$ for anything that needs KaTeX. */
  prompt: string;
  /** The canonical correct answer. For `choice` items this is the id of the correct choice. */
  answer: string;
  /** `choice` items only. Order is already randomised by the generator. */
  choices?: ItemChoice[];
  /**
   * Shown in the debrief after the whole battery, never during the run — real assessments give no
   * feedback mid-test, and neither does this.
   */
  explanation?: string;
  /** Anything a module wants to carry through to its own renderer. */
  meta?: Record<string, unknown>;
}

export interface GenerateArgs {
  /** 0-based position in the section. Modules that ramp difficulty (sequences) key off this. */
  index: number;
  /** Total items in the section, so a ramp can be expressed as a fraction of the way through. */
  count: number;
  /** Seeded — the same seed reproduces the same paper. Never call Math.random in a generator. */
  rng: () => number;
  config?: Record<string, unknown>;
}

export type ModuleKind =
  | "arithmetic"
  | "sequences"
  | "probability"
  | "data-sufficiency"
  | "pattern-logic"
  | "options"
  | "market-making"
  | "cognitive"
  | "estimation"
  | "long-form"
  | "personality";

export interface ModuleSpec {
  /** Unique within the firm, e.g. '80-in-8'. Used in the route and in oa_section_results. */
  id: string;
  name: string;
  kind: ModuleKind;
  /** One line for the catalog card. */
  blurb: string;
  /**
   * Shown verbatim on the instruction screen, in the real test's register. These are the rules the
   * candidate is held to, so they must match what the engine actually enforces.
   */
  rules: string[];
  itemCount: number;
  /** Whole-section clock in seconds. null when the module runs on per-item clocks only. */
  durationS: number | null;
  /** Per-item clock in ms (Optiver's ~90s probability items). null when the section clock governs. */
  perItemMs: number | null;
  input: ItemInputKind;
  /** true = a wrong answer scores −1 rather than 0. The defining rule of the speed batteries. */
  negativeMarking: boolean;
  allowSkip: boolean;
  allowBack: boolean;
  /** Whether the real test permits one. Displayed on the instruction screen; not enforceable. */
  calculator: boolean;
  /** Raw score candidate reports call competitive. null when nothing reliable is published. */
  passMark: number | null;
  generate: (args: GenerateArgs) => AssessmentItem;
  /** Default is a normalised exact-match against `answer`. See engine/check.ts. */
  check?: (item: AssessmentItem, raw: string) => boolean;
}

export interface FirmSpec {
  id: string;
  name: string;
  blurb: string;
  /** Ordered — this is the battery a candidate actually sits, front to back. */
  modules: ModuleSpec[];
  /**
   * ISO date the format was last confirmed against a candidate report. These formats demonstrably
   * drift between recruiting cycles, so a spec without a date is a spec you cannot trust.
   */
  lastVerified: string;
  sourceNote: string;
  /**
   * Bumped whenever the module shape changes. Stored on the run so a 2026 result stays comparable
   * when the firm changes its format in 2027.
   */
  specVersion: number;
}

export interface ItemResult {
  itemId: string;
  tag: string;
  prompt: string;
  given: string;
  expected: string;
  correct: boolean;
  skipped: boolean;
  latencyMs: number;
}

export interface SectionResult {
  moduleId: string;
  moduleName: string;
  items: ItemResult[];
  /** After negative marking. Floored at 0 — no firm reports a negative headline score. */
  rawScore: number;
  seen: number;
  correct: number;
  wrong: number;
  skipped: number;
  durationS: number;
  passMark: number | null;
}

export interface RunResult {
  firmId: string;
  specVersion: number;
  sections: SectionResult[];
  startedAt: number;
  finishedAt: number;
  /** G-Research literally tracks this, so replicating it is part of the point. */
  tabBlurCount: number;
}
