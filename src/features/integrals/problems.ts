/**
 * The problem bank.
 *
 * The problems themselves live under bank/, one file per technique, so adding to the game means
 * opening the one file for the technique you're adding to rather than scrolling a thousand-line
 * array. This module is the aggregator and the lookups.
 *
 * Every entry carries a machine-readable integrand alongside its LaTeX, so problems.test.ts can
 * differentiate the stored answer and check it against the integrand across the whole domain. The
 * bank verifies itself; a bad answer is a red test, never a student being told they're wrong.
 *
 * `domain` is where the grader samples, so it must exclude every pole and branch point of both the
 * integrand and the answer. That is why the log problems live on the positive reals and the tan/sec
 * problems stop short of pi/2.
 */
import type { Difficulty, Problem, ProblemSource, TechniqueId } from "./types";
import { StandardForms } from "./bank/standardForms";
import { Substitution } from "./bank/substitution";
import { Parts } from "./bank/parts";
import { TrigIdentities } from "./bank/trigIdentities";
import { TrigSubstitution } from "./bank/trigSubstitution";
import { PartialFractions } from "./bank/partialFractions";
import { CompletingTheSquare } from "./bank/completingTheSquare";
import { Definite } from "./bank/definite";
import { Feynman } from "./bank/feynman";
import { TSub } from "./bank/tSub";
import { Recurrence } from "./bank/recurrence";
import { InverseIntegral } from "./bank/inverseIntegral";
import { FloorFunction } from "./bank/floorFunction";
import { BetaIntegrals } from "./bank/betaIntegrals";
import { IntroducingConstants } from "./bank/introducingConstants";

export const PROBLEMS: Problem[] = [
  ...StandardForms,
  ...Substitution,
  ...Parts,
  ...TrigIdentities,
  ...TrigSubstitution,
  ...PartialFractions,
  ...CompletingTheSquare,
  ...Definite,
  ...Feynman,
  ...TSub,
  ...Recurrence,
  ...InverseIntegral,
  ...FloorFunction,
  ...BetaIntegrals,
  ...IntroducingConstants,
];

export const PROBLEM_BY_ID: Record<string, Problem> = Object.fromEntries(
  PROBLEMS.map((p) => [p.id, p]),
);

/** Primary technique — the one training mode files a problem under. */
export function primaryTechnique(p: Problem): TechniqueId {
  return p.techniques[0];
}

export function problemsForTechnique(id: TechniqueId): Problem[] {
  return PROBLEMS.filter((p) => p.techniques.includes(id)).sort((a, b) => a.difficulty - b.difficulty);
}

export function problemsByDifficulty(d: Difficulty): Problem[] {
  return PROBLEMS.filter((p) => p.difficulty === d);
}

/** Every distinct source name in the bank, "original" last, otherwise alphabetical. */
export const SOURCE_NAMES: string[] = Array.from(new Set(PROBLEMS.map((p) => p.source.name))).sort(
  (a, b) => (a === "original" ? 1 : b === "original" ? -1 : a.localeCompare(b)),
);

/** How many problems each source contributes — drives the "practice by source" cards. */
export const SOURCE_COUNTS: Record<string, number> = SOURCE_NAMES.reduce(
  (acc, name) => ({ ...acc, [name]: PROBLEMS.filter((p) => p.source.name === name).length }),
  {} as Record<string, number>,
);

export function problemsForSource(name: string): Problem[] {
  return PROBLEMS.filter((p) => p.source.name === name).sort((a, b) => a.difficulty - b.difficulty);
}

export interface ProblemFilter {
  /** Empty/omitted means "every technique". */
  techniques?: TechniqueId[];
  /** Omitted means "every source". */
  source?: string;
}

/**
 * The two independent practice filters combined: technique (multi-select) and source
 * (single competition set, worked as-is). Either can be applied alone or together.
 */
export function filterProblems(filter: ProblemFilter): Problem[] {
  const { techniques, source } = filter;
  return PROBLEMS.filter(
    (p) =>
      (!techniques || techniques.length === 0 || p.techniques.some((t) => techniques.includes(t))) &&
      (!source || p.source.name === source),
  ).sort((a, b) => a.difficulty - b.difficulty);
}

export function formatSource(source: ProblemSource): string {
  if (source.name === "original") return "Original";
  const parts = [source.name, source.round, source.year ? String(source.year) : undefined].filter(Boolean);
  return parts.join(" · ");
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: "Warm-up",
  2: "Routine",
  3: "Solid",
  4: "Tricky",
  5: "Brutal",
};
