/**
 * The UKUIB course — units, skills, and the rules that decide what is open.
 *
 * This is the spine of the Duolingo-style path (see UKUIB_PATH.md). It is deliberately pure data
 * plus lookups: no storage, no clock, no React. Everything that decides what a student sees next
 * is a function of (curriculum, progress), so all of it is testable without a browser.
 *
 * The ordering is a LEARNING progression, not the syllabus's own order. The syllabus is a
 * checklist — it lists the Gamma function next to the floor function because both are "specific
 * results", not because anyone should meet them on the same afternoon. Every syllabus item is
 * accounted for exactly once; each unit records which, in `syllabus`, so the coverage claim can be
 * checked mechanically rather than trusted (see curriculum.test.ts).
 */
import type { TechniqueId } from "../types";

export type UnitId =
  | "foundations"
  | "step"
  | "symmetry"
  | "universal-sub"
  | "under-the-sign"
  | "series"
  | "gamma-beta"
  | "discontinuous"
  | "products"
  | "the-bee";

/**
 * A skill is one node on the path. Almost all of them teach one technique and drill its pool; the
 * finale unit's skills have no technique of their own and draw from the whole bank at competition
 * pace, which is what `technique: undefined` means.
 */
export interface Skill {
  id: string;
  name: string;
  /** One line on the node's detail panel — what this skill buys you, not what it is. */
  blurb: string;
  technique?: TechniqueId;
}

export interface Unit {
  id: UnitId;
  name: string;
  /** What a student can do once this unit is behind them. Shown on the unit header. */
  aim: string;
  /** Syllabus items this unit discharges, as printed in the UKUIB syllabus (§1.1, §2.6, …). */
  syllabus: string[];
  skills: Skill[];
}

/** Crowns run 0–5; 5 is "legendary" and strips every scaffold. */
export const MAX_CROWN = 5;

/** One lesson per crown level, so a skill is five lessons deep from first sight to legendary. */
export const LESSONS_PER_SKILL = MAX_CROWN;

export const UNITS: Unit[] = [
  {
    id: "foundations",
    name: "Foundations",
    aim: "Every A-level and STEP integral, fast enough that the competition ones are about the idea and never about the algebra.",
    syllabus: ["§1.1"],
    skills: [
      {
        id: "power",
        name: "Standard forms",
        blurb: "The dozen derivatives you read backwards without thinking.",
        technique: "power",
      },
      {
        id: "u-sub",
        name: "Substitution",
        blurb: "The chain rule in reverse — spot the inner function and its derivative.",
        technique: "u-sub",
      },
      {
        id: "parts",
        name: "By parts",
        blurb: "The product rule in reverse, and the loop trick that closes it.",
        technique: "parts",
      },
      {
        id: "trig-identity",
        name: "Trig identities",
        blurb: "Reshape a trig integrand until a substitution appears.",
        technique: "trig-identity",
      },
      {
        id: "trig-sub",
        name: "Trig substitution",
        blurb: "Kill a square root by making the Pythagorean identity do the work.",
        technique: "trig-sub",
      },
      {
        id: "partial-fractions",
        name: "Partial fractions",
        blurb: "Split a rational function into pieces you already know.",
        technique: "partial-fractions",
      },
      {
        id: "complete-square",
        name: "Completing the square",
        blurb: "Turn any quadratic denominator into an arctan or an arcsin.",
        technique: "complete-square",
      },
    ],
  },
  {
    id: "step",
    name: "STEP manoeuvres",
    aim: "The two moves that separate a STEP candidate from an A-level one.",
    syllabus: ["§1.1"],
    skills: [
      {
        id: "recurrence",
        name: "Reduction formulae",
        blurb: "Peel one power off at a time and let the recursion finish the job.",
        technique: "recurrence",
      },
      {
        id: "inverse-integral",
        name: "Integrals of inverses",
        blurb: "Integrate a function you can't, by integrating the one you can.",
        technique: "inverse-integral",
      },
    ],
  },
  {
    id: "symmetry",
    name: "Symmetry",
    aim: "Evaluate definite integrals that have no antiderivative at all, by relabelling them.",
    syllabus: ["§1.6", "§1.7"],
    skills: [
      {
        id: "symmetry",
        name: "Odd, even and reflection",
        blurb: "The answer is 0, or twice the half — and King's rule when it's neither.",
        technique: "symmetry",
      },
      {
        id: "reciprocal-substitution",
        name: "Reciprocal substitution",
        blurb: "Reflect through x → 1/x and add the two copies together.",
        technique: "reciprocal-substitution",
      },
    ],
  },
  {
    id: "universal-sub",
    name: "The universal substitution",
    aim: "Never be stuck on a rational function of sin and cos again.",
    syllabus: ["§1.4"],
    skills: [
      {
        id: "t-sub",
        name: "The t-substitution",
        blurb: "t = tan(x/2) makes every trig rational function a rational function.",
        technique: "t-sub",
      },
    ],
  },
  {
    id: "under-the-sign",
    name: "Under the integral sign",
    aim: "Introduce a parameter that isn't there, differentiate, and watch the hard part vanish.",
    syllabus: ["§1.2", "§1.3"],
    skills: [
      {
        id: "feynman",
        name: "Differentiating under the sign",
        blurb: "Feynman's trick with fixed limits — the workhorse.",
        technique: "feynman",
      },
      {
        id: "leibniz-rule",
        name: "The general Leibniz rule",
        blurb: "What changes when the limits move too.",
        technique: "leibniz-rule",
      },
      {
        id: "introducing-constants",
        name: "Introducing constants",
        blurb: "Manufacture the parameter the trick needs.",
        technique: "introducing-constants",
      },
    ],
  },
  {
    id: "series",
    name: "Series and integrals",
    aim: "Trade an impossible integrand for an infinite sum you can actually name.",
    syllabus: ["§1.5", "§2.4", "§2.6"],
    skills: [
      {
        id: "series-swap",
        name: "Swapping sum and integral",
        blurb: "Expand, integrate termwise, then recognise what you're left with.",
        technique: "series-swap",
      },
      {
        id: "zeta-series",
        name: "The zeta function",
        blurb: "Geometric series in e^-x, handed off to Gamma one term at a time.",
        technique: "zeta-series",
      },
      {
        id: "log-power-integrals",
        name: "Log-power integrals",
        blurb: "The generating-function family that produces factorials on demand.",
        technique: "log-power-integrals",
      },
      {
        id: "named-series",
        name: "The named series",
        blurb: "Catalan, pi^3/32, pi coth pi — knowing the sum on sight is the whole skill.",
        technique: "named-series",
      },
    ],
  },
  {
    id: "gamma-beta",
    name: "Gamma and Beta",
    aim: "The two special functions the syllabus names, and the identity that links them.",
    syllabus: ["§2.1", "§2.2", "§2.3"],
    skills: [
      {
        id: "gamma-function",
        name: "The Gamma function",
        blurb: "The factorial, extended — and the shape every exponential integral collapses to.",
        technique: "gamma-function",
      },
      {
        id: "beta-integrals",
        name: "The Beta function",
        blurb: "Every integral of x^a(1-x)^b on the unit interval, in one formula.",
        technique: "beta-integrals",
      },
      {
        id: "euler-reflection",
        name: "Euler's reflection formula",
        blurb: "Gamma(s)Gamma(1-s) = pi/sin(pi s) — where the pi in the answer comes from.",
        technique: "euler-reflection",
      },
      {
        id: "gaussian-hypersphere",
        name: "Gaussian integrals",
        blurb: "Square it, go polar, and the impossible one falls out.",
        technique: "gaussian-hypersphere",
      },
    ],
  },
  {
    id: "discontinuous",
    name: "Discontinuous integrands",
    aim: "Integrate things with no derivative anywhere useful, by counting instead.",
    syllabus: ["§2.5"],
    skills: [
      {
        id: "floor-function",
        name: "Floor, ceiling, fractional part",
        blurb: "Split at the integers and add up rectangles.",
        technique: "floor-function",
      },
    ],
  },
  {
    id: "products",
    name: "Infinite products and constants",
    aim: "The three named results the syllabus lists last, and why they are all the same picture.",
    syllabus: ["§2.7", "§2.8", "§2.9"],
    skills: [
      {
        id: "wallis-product",
        name: "Wallis' product",
        blurb: "Squeeze sin^n x between its neighbours and pi falls out of a ratio.",
        technique: "wallis-product",
      },
      {
        id: "sine-product",
        name: "The sine product",
        blurb: "sin(pi x) written as its roots — the factorisation behind pi^2/6.",
        technique: "sine-product",
      },
      {
        id: "euler-mascheroni",
        name: "Euler-Mascheroni",
        blurb: "The constant left over when two divergences cancel.",
        technique: "euler-mascheroni",
      },
    ],
  },
  {
    id: "the-bee",
    name: "The Bee",
    aim: "No new technique. Real papers, real pace, and the judgement to pick a route in ten seconds.",
    syllabus: [],
    skills: [
      {
        id: "bee-recognition",
        name: "Name the weapon",
        blurb: "Route-choice under a three-second clock, nothing solved.",
      },
      {
        id: "bee-mixed",
        name: "Mixed paper",
        blurb: "The whole bank, unsorted, exactly like the real thing.",
      },
    ],
  },
];

export const UNIT_BY_ID: Record<string, Unit> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

/** Every skill in path order — the spine the path page renders and the unlock rules walk. */
export const SKILLS: Skill[] = UNITS.flatMap((u) => u.skills);

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function unitOf(skillId: string): Unit | undefined {
  return UNITS.find((u) => u.skills.some((s) => s.id === skillId));
}

/** Index of a skill along the whole path, or -1. Used for ordering and for "what's next". */
export function skillIndex(skillId: string): number {
  return SKILLS.findIndex((s) => s.id === skillId);
}

// ── unlock rules ───────────────────────────────────────────────────────────────────────────────

/** What the unlock rules need to know about a student. Kept structural so the pure functions here
 *  never import the storage layer. */
export interface CrownState {
  crownOf(skillId: string): number;
  checkpointPassed(unitId: UnitId): boolean;
}

/**
 * A unit opens when the one before it has been *met* — every skill in it carried to at least one
 * crown — or when its checkpoint has been passed outright.
 *
 * Deliberately "met", not "mastered": requiring five crowns on all seven Foundations skills before
 * anyone may see Symmetry would be a wall, not a path. Mastery is what the crowns are for; the
 * gate only asks that you have actually been there.
 */
export function unitUnlocked(unitId: UnitId, state: CrownState): boolean {
  const i = UNITS.findIndex((u) => u.id === unitId);
  if (i <= 0) return true;
  const prev = UNITS[i - 1];
  if (state.checkpointPassed(prev.id)) return true;
  return prev.skills.every((s) => state.crownOf(s.id) >= 1);
}

/**
 * A skill opens when its unit is open and the skill before it in that unit has a crown. The first
 * skill of an open unit is always available, so a newly-opened unit is never a dead end.
 */
export function skillUnlocked(skillId: string, state: CrownState): boolean {
  const unit = unitOf(skillId);
  if (!unit) return false;
  if (!unitUnlocked(unit.id, state)) return false;
  const i = unit.skills.findIndex((s) => s.id === skillId);
  if (i === 0) return true;
  return state.crownOf(unit.skills[i - 1].id) >= 1;
}

/** The node the path should point at: the first unlocked skill that isn't finished. */
export function nextSkill(state: CrownState): Skill | undefined {
  return SKILLS.find((s) => skillUnlocked(s.id, state) && state.crownOf(s.id) < MAX_CROWN);
}

/** Course completion as a fraction — every skill counts equally, crowns count fractionally. */
export function courseProgress(state: CrownState): number {
  if (SKILLS.length === 0) return 0;
  const total = SKILLS.reduce((sum, s) => sum + Math.min(state.crownOf(s.id), MAX_CROWN), 0);
  return total / (SKILLS.length * MAX_CROWN);
}
