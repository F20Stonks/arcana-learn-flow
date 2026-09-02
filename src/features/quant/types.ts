/**
 * UK Quant — a dedicated, lesson-first curriculum for quant-interview prep (A-level Maths /
 * Further Maths / STEP up through quant-specific technique). Deliberately separate from the
 * general-audience Drills catalog (src/features/drills) and from Integral Arena
 * (src/features/integrals): this is a personal, curated ladder, not another entry in either of
 * those product surfaces. It reuses the Drills practice engine read-only (DRILL_REGISTRY,
 * DrillRunner) rather than duplicating it — the new content here is the lesson layer plus a
 * focus-tag hook into the existing generators, nothing else.
 */

export type QuantRung = "a-level" | "further-maths" | "step" | "quant";

export interface QuantPractice {
  /** Key into src/features/drills/registry.ts's DRILL_REGISTRY. */
  drillKey: string;
  /** Pins the drill's generator to one sub-skill tag instead of its normal mixed rotation. */
  focusTag?: string;
  /** Button label, e.g. "Practice: dice sums". */
  label: string;
}

/**
 * A single trackable line in an external resource's checklist — e.g. one chapter of a book, or
 * one named puzzle on a third-party site. Deliberately just a label + an optional deep link:
 * this app never reproduces the resource's actual problem/solution content, only tracks whether
 * you've worked through it at the source.
 */
export interface ExternalResourceItem {
  id: string;
  label: string;
  /** Falls back to the parent group's sourceUrl when the item has no deep link of its own. */
  url?: string;
}

export interface ExternalResourceGroup {
  id: string;
  title: string;
  sourceUrl: string;
  sourceNote: string;
  items: ExternalResourceItem[];
}

export interface QuantTopic {
  id: string;
  title: string;
  rung: QuantRung;
  /** One line, shown on the topic card. */
  tagline: string;
  /** The recognition cue — when to reach for this, which is the part that's actually hard. */
  whenToUse: string;
  /** The recipe, as numbered beats. */
  recipe: string[];
  /** A fully worked example: the prompt, the beats of the work, the result. */
  example: { prompt: string; work: string[]; result: string };
  /** Gotchas worth naming out loud. */
  pitfalls: string[];
  /** One or more focused practice links — most topics have exactly one. */
  practice: QuantPractice[];
}
