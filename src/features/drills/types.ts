export type DrillMode = "classic" | "custom" | "adaptive" | "weak-spot";

/** A read-only reference table shown above the input — Cayley Fill's "complete the table"
 *  framing without needing a bespoke multi-cell editable grid. */
export interface CayleyVisual {
  kind: "cayley-table";
  opLabel: string;
  elements: string[];
  /** Row-major, length elements.length ** 2. null = the blanked cell being asked about. */
  cells: (string | null)[];
}

export interface DrillProblem {
  /** Unique per generated instance, not per problem type. */
  id: string;
  /** Stable tag for telemetry + weak-spot targeting, e.g. 'mul_2digit', 'mod', 'gcd'. */
  tag: string;
  /** Rendered as-is; wrap in $...$ for anything that needs KaTeX. */
  prompt: string;
  answer: string;
  visual?: CayleyVisual;
}

export interface DrillModeSpec {
  id: DrillMode;
  label: string;
  description: string;
}

export interface GenerateArgs {
  /** 0-based difficulty rung. Adaptive mode moves this on streak/miss; other modes hold it fixed. */
  level: number;
  rng: () => number;
  /** Problem tags to over-sample — populated from drill_weak_spots in weak-spot mode. */
  biasTags?: string[];
  config?: Record<string, unknown>;
}

export interface DrillDefinition {
  /** Matches drill_sessions.drill_key / drill_attempts.drill_key. */
  key: string;
  name: string;
  tagline: string;
  domain: "arithmetic" | "number-theory" | "algebra" | "logic";
  defaultDurationS: number;
  modes: DrillModeSpec[];
  generate: (args: GenerateArgs) => DrillProblem;
  /** Default checker is case/whitespace-insensitive exact match against `answer`. */
  check?: (problem: DrillProblem, raw: string) => boolean;
  inputKind: "numeric" | "venn";
}

export interface DrillAttemptLog {
  tag: string;
  correct: boolean;
  latencyMs: number;
}

export interface WeakSpot {
  problem_tag: string;
  accuracy: number;
  attempts: number;
}
