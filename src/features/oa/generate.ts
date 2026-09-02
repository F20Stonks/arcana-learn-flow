/**
 * The generator registry, and how a run is assembled from an assessment.
 *
 * A run is fully determined by (assessment, seed): the same seed reproduces the same paper, so a
 * set is a number you can hand to someone else and a bad question is reproducible rather than a
 * ghost. Nothing here calls out to anything — the whole paper is built in the browser.
 */
import { rng as makeRng, type Rng } from "./rng";
import type { Assessment, Question, QuestionKind, Section } from "./types";
import { generateArithmetic } from "./generators/arithmetic";
import { generateSequence } from "./generators/sequence";
import { generateProbability } from "./generators/probability";
import { generateExpectedValue } from "./generators/expectedValue";
import { generateMarketMaking } from "./generators/marketMaking";
import { generateOptions } from "./generators/options";
import { generateEstimation } from "./generators/estimation";
import { generateLogic } from "./generators/logic";
import { generateZap } from "./generators/zap";

type Generator = (rng: Rng, level: number, id: string) => Question;

const GENERATORS: Record<QuestionKind, Generator> = {
  arithmetic: generateArithmetic,
  sequence: generateSequence,
  probability: generateProbability,
  "expected-value": generateExpectedValue,
  "market-making": generateMarketMaking,
  options: generateOptions,
  estimation: generateEstimation,
  logic: generateLogic,
  zap: generateZap,
};

export function generateQuestion(kind: QuestionKind, rng: Rng, level: number, id: string): Question {
  return GENERATORS[kind](rng, level, id);
}

/**
 * One section's questions.
 *
 * Duplicates are rejected by prompt rather than tolerated: eighty arithmetic questions drawn from
 * one generator will collide, and seeing the same question twice in a timed set is the fastest way
 * to lose a candidate's trust in the whole thing. After enough tries we accept the collision
 * rather than loop forever — a generator with a small range should widen, not hang the page.
 */
export function buildSection(section: Section, rng: Rng): Question[] {
  const questions: Question[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < section.count; i++) {
    let question = generateQuestion(section.kind, rng, section.level, `${section.id}-${i}`);
    for (let tries = 0; tries < 12 && seen.has(question.prompt); tries++) {
      question = generateQuestion(section.kind, rng, section.level, `${section.id}-${i}`);
    }
    seen.add(question.prompt);
    questions.push(question);
  }
  return questions;
}

export function buildRun(assessment: Assessment, seed: number): Question[][] {
  const rng = makeRng(seed);
  return assessment.sections.map((section) => buildSection(section, rng));
}

/** Total questions and total seconds, for the "before you start" card. */
export function assessmentShape(assessment: Assessment): { questions: number; seconds: number } {
  return assessment.sections.reduce(
    (acc, s) => ({ questions: acc.questions + s.count, seconds: acc.seconds + s.seconds }),
    { questions: 0, seconds: 0 },
  );
}
