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

/** One surface icon: a genus-g blob (g cut-out holes) for closed/bounded orientable surfaces,
 *  or one of three fixed hand-drawn glyphs for the cases that need edge-identification /
 *  self-intersection to depict honestly. See SurfaceGlyph.tsx for what each kind draws. */
export interface SurfaceGlyphSpec {
  kind: "holes" | "mobius" | "klein" | "rp2";
  /** 'holes' only — number of cut-out holes, i.e. the genus. */
  holes?: number;
  /** 'holes' only — dashed outline marks "has a boundary" (disk/annulus) vs closed (sphere/torus). */
  dashed?: boolean;
}
export interface InvariantPairVisual {
  kind: "invariant-pair";
  left: SurfaceGlyphSpec;
  right: SurfaceGlyphSpec;
}

export interface GraphVisual {
  kind: "graph";
  vertexCount: number;
  edges: [number, number][];
}

/** Both sides are (2,n)-torus-knot diagrams — n=1 is the unknot, n=3 the trefoil, n=5 the
 *  cinquefoil, a real and correctly-labeled family, not an improvised drawing. `seed` only
 *  varies the render's curviness so two diagrams of the same knot don't look pixel-identical. */
export interface KnotPairVisual {
  kind: "knot-pair";
  left: { crossings: number; seed: number };
  right: { crossings: number; seed: number };
}

export type DrillVisual = CayleyVisual | InvariantPairVisual | GraphVisual | KnotPairVisual;

export interface DrillProblem {
  /** Unique per generated instance, not per problem type. */
  id: string;
  /** Stable tag for telemetry + weak-spot targeting, e.g. 'mul_2digit', 'mod', 'gcd'. */
  tag: string;
  /** Rendered as-is; wrap in $...$ for anything that needs KaTeX. */
  prompt: string;
  answer: string;
  visual?: DrillVisual;
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

export interface BinaryOption {
  value: string;
  label: string;
}

export interface DrillDefinition {
  /** Matches drill_sessions.drill_key / drill_attempts.drill_key. */
  key: string;
  name: string;
  tagline: string;
  domain: "arithmetic" | "number-theory" | "algebra" | "logic" | "topology";
  defaultDurationS: number;
  modes: DrillModeSpec[];
  generate: (args: GenerateArgs) => DrillProblem;
  /** Default checker is case/whitespace-insensitive exact match against `answer`. */
  check?: (problem: DrillProblem, raw: string) => boolean;
  inputKind: "numeric" | "venn" | "binary";
  /** 'binary' only — the two choices rendered as buttons; problem.answer must equal one of these values. */
  binaryOptions?: [BinaryOption, BinaryOption];
  /** Concise "how this drill works" text shown in the info tab — not a tutorial, just the rules. */
  rules: string;
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
