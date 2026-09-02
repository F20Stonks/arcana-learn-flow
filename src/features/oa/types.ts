/**
 * Firm OA Arena — domain types.
 *
 * A quant trading firm's first hurdle is almost never an interview; it is a timed online
 * assessment with a distinctive shape — Optiver's eighty arithmetic questions in eight minutes,
 * SIG's sequences, Akuna's options intuition. Each rewards a different reflex, and the only way to
 * train the reflex is to sit the shape.
 *
 * IMPORTANT, and surfaced in the UI rather than buried here: these are *format reconstructions*
 * built from publicly reported candidate accounts and firms' own published descriptions. They are
 * not the firms' question banks, and nothing here is claimed to be actual assessment content. The
 * question generators are ours; only the shape — count, clock, question type, scoring — is
 * modelled on the real thing.
 */

export type QuestionKind =
  | "arithmetic"
  | "sequence"
  | "probability"
  | "expected-value"
  | "market-making"
  | "estimation"
  | "options"
  | "zap"
  | "logic";

/** How an answer is checked. Every one of these is decidable in the browser, with no model call. */
export type Answer =
  | { type: "numeric"; value: number; tolerance?: number }
  | { type: "choice"; index: number }
  /** Estimation, where a band is the honest grading and a point value is not. */
  | { type: "range"; low: number; high: number };

export interface Question {
  id: string;
  kind: QuestionKind;
  /** LaTeX-in-prose, rendered the same way the integrals bank is. */
  prompt: string;
  /** Present when the real format is multiple choice. */
  choices?: string[];
  answer: Answer;
  /** Why, shown in the review afterwards — the run is practice, not an exam. */
  explanation: string;
}

export interface Section {
  id: string;
  name: string;
  kind: QuestionKind;
  count: number;
  /** The section's own clock. Sections run back to back. */
  seconds: number;
  /** Generator difficulty knob, 1–5. */
  level: number;
  /** One line on what this section is testing, shown before it starts. */
  brief: string;
}

export interface Assessment {
  id: string;
  firmId: string;
  name: string;
  /** What the real thing is, in one line. */
  format: string;
  sections: Section[];
  /**
   * The pass mark candidates widely report, as a fraction of the maximum. Absent where no
   * consistent figure is reported — an invented cutoff would be worse than none.
   */
  reportedPassMark?: number;
  /** Things worth knowing before you sit it: no calculator, no going back, negative marking. */
  rules: string[];
  /** Where the format description comes from. Shown, not hidden. */
  sourcing: string;
}

export interface Firm {
  id: string;
  name: string;
  /** One line on who they are and what desk they hire for. */
  blurb: string;
  /** The hiring stages, so the OA sits in context. */
  process: string[];
  assessments: Assessment[];
}

/** One answered question inside a run. */
export interface Attempt {
  question: Question;
  /** What the candidate typed or picked. Null when the clock ran out on it. */
  given: string | null;
  correct: boolean;
  /** Milliseconds spent on this question. */
  ms: number;
}

export interface SectionResult {
  section: Section;
  attempts: Attempt[];
  correct: number;
  /** Reached, but never answered — the clock ran out first. */
  unanswered: number;
}

export interface RunResult {
  assessment: Assessment;
  sections: SectionResult[];
  correct: number;
  total: number;
  /** Fraction of the maximum. */
  score: number;
  passed?: boolean;
  seconds: number;
}
