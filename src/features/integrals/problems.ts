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
import type { Difficulty, Problem, TechniqueId } from "./types";
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
import { LogPowerIntegrals } from "./bank/logPowerIntegrals";
import { ReciprocalSubstitution } from "./bank/reciprocalSubstitution";
import { GammaFunction } from "./bank/gammaFunction";
import { ZetaSeries } from "./bank/zetaSeries";

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
  ...LogPowerIntegrals,
  ...ReciprocalSubstitution,
  ...GammaFunction,
  ...ZetaSeries,
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

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: "Warm-up",
  2: "Routine",
  3: "Solid",
  4: "Tricky",
  5: "Brutal",
};
