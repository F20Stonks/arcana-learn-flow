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
import { LogPowerIntegrals } from "./bank/logPowerIntegrals";
import { ReciprocalSubstitution } from "./bank/reciprocalSubstitution";
import { GammaFunction } from "./bank/gammaFunction";
import { ZetaSeries } from "./bank/zetaSeries";
import { WallisProduct } from "./bank/wallisProduct";
import { GaussianHypersphere } from "./bank/gaussianHypersphere";
import { UkuibRound1_2021 } from "./bank/ukuib/round1_2021";
import { UkuibRound1_2022 } from "./bank/ukuib/round1_2022";
import { UkuibRound1_2023_2024 } from "./bank/ukuib/round1_2023_2024";
import { UkuibRound3 } from "./bank/ukuib/round3";
import { UkuibGroupRound } from "./bank/ukuib/groupRound";
import { UkuibGroupRound2023_2026 } from "./bank/ukuib/groupRound2023_2026";
import { UkuibQualifier } from "./bank/ukuib/qualifier";

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
  ...WallisProduct,
  ...GaussianHypersphere,
  ...UkuibRound1_2021,
  ...UkuibRound1_2022,
  ...UkuibRound1_2023_2024,
  ...UkuibRound3,
  ...UkuibGroupRound,
  ...UkuibGroupRound2023_2026,
  ...UkuibQualifier,
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

/** Union across an arbitrary subset of techniques — the multi-select "custom mix" pool. */
export function problemsForTechniques(ids: TechniqueId[]): Problem[] {
  const set = new Set(ids);
  return PROBLEMS.filter((p) => p.techniques.some((t) => set.has(t))).sort(
    (a, b) => a.difficulty - b.difficulty,
  );
}

export function problemsByDifficulty(d: Difficulty): Problem[] {
  return PROBLEMS.filter((p) => p.difficulty === d);
}

/** Stable identity for a source — two problems are "the same source" iff this string matches. */
export function sourceKey(s: ProblemSource): string {
  return `${s.name}::${s.year ?? ""}::${s.round ?? ""}`;
}

/** Every distinct source in the bank, in first-seen order — "original" included as one bucket among the rest. */
export const SOURCES: ProblemSource[] = (() => {
  const seen = new Map<string, ProblemSource>();
  for (const p of PROBLEMS) {
    const key = sourceKey(p.source);
    if (!seen.has(key)) seen.set(key, p.source);
  }
  return [...seen.values()];
})();

/** A specific competition/document's problems, worked as that source's own uncurated set. */
export function problemsForSource(s: ProblemSource): Problem[] {
  const key = sourceKey(s);
  return PROBLEMS.filter((p) => sourceKey(p.source) === key);
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: "Warm-up",
  2: "Routine",
  3: "Solid",
  4: "Tricky",
  5: "Brutal",
};
