/**
 * The ten sequence rule families, and the difficulty ramp over them.
 *
 * Every family below is a pure function of `(rng, tier)` — never `Math.random`, per the feature's
 * house rule — that drafts one candidate sequence (a "Draft"): the full run of terms including the
 * one the candidate has to guess, a debrief tag, and the rule's own complexity, computed with
 * exactly the same `complexityScore` the fitter battery uses so the verifier's comparison in
 * verifier.ts is apples-to-apples. generate.ts is the only caller: it draws a draft, hands it to
 * the verifier, and retries on rejection — nothing here knows about retrying or about the verifier
 * itself, so a family can be reasoned about (and tested) purely as "what sequence does this rule
 * produce," independent of how ambiguity gets resolved.
 */
import { pick, randInt, weightedPick } from "../../engine/rng";
import { complexityScore } from "./fitters";
import { EXOTIC_COMPLEXITY, offsetToLetter } from "./verifier";

export type FamilyId =
  | "arithmetic"
  | "geometric"
  | "quadratic"
  | "index_formula"
  | "multiply_add"
  | "fibonacci"
  | "alternating"
  | "interleaved"
  | "digit_sum"
  | "letters";

export type Draft =
  | { kind: "numeric"; terms: number[]; tag: string; intendedComplexity: number }
  | { kind: "letters"; terms: string[]; tag: string; intendedComplexity: number };

/** Nobody should have to compute a 9-digit number under a speed clock — six digits, with margin. */
export const MAX_ABS_TERM = 999_999;

export function withinMagnitudeGuard(draft: Draft): boolean {
  if (draft.kind === "letters") return true; // offsets are always 0-25 by construction
  return draft.terms.every((t) => Math.abs(t) <= MAX_ABS_TERM);
}

// Coefficient ranges widen tier over tier — this is the "coefficient magnitude" half of the ramp.
const TIER_D_RANGE: [number, number][] = [
  [1, 4],
  [2, 7],
  [3, 12],
  [5, 20],
  [8, 35],
];
const TIER_S_RANGE: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 5],
  [3, 8],
  [4, 12],
];
const TIER_RATIO_POOL: number[][] = [
  [2, 3],
  [2, 3, 4, -2],
  [2, 3, 4, 5, -2, -3],
  [2, 3, 4, 5, 6, -2, -3, -4],
  [2, 3, 4, 5, 6, 7, -2, -3, -4, -5],
];

function digitSum(n: number): number {
  return String(Math.abs(n))
    .split("")
    .reduce((sum, ch) => sum + Number(ch), 0);
}

/** a(n) = a(n-1) + d. Five terms shown (indices 0-3), the 5th asked. */
function draftArithmetic(rng: () => number, tier: number): Draft {
  const [lo, hi] = TIER_D_RANGE[tier];
  const d = randInt(lo, hi, rng) * (rng() < 0.35 ? -1 : 1);
  const a0 = randInt(-40, 200, rng);
  const terms: number[] = [];
  let v = a0;
  for (let i = 0; i < 5; i++) {
    terms.push(v);
    v += d;
  }
  return { kind: "numeric", terms, tag: "seq_arithmetic", intendedComplexity: complexityScore(2, [d]) };
}

/** a(n) = a(n-1) * r, integer ratios only so every term stays exact. */
function draftGeometric(rng: () => number, tier: number): Draft {
  const r = pick(TIER_RATIO_POOL[tier], rng);
  const a0 = randInt(1, 9, rng) * (rng() < 0.5 ? 1 : -1);
  const terms: number[] = [];
  let v = a0;
  for (let i = 0; i < 5; i++) {
    terms.push(v);
    v *= r;
  }
  return { kind: "numeric", terms, tag: "seq_geometric", intendedComplexity: complexityScore(2, [r]) };
}

/** Constant second difference — any degree-2 polynomial in the index. Six terms, 6th asked. */
function draftQuadratic(rng: () => number, tier: number): Draft {
  const [slo, shi] = TIER_S_RANGE[tier];
  const s = randInt(slo, shi, rng) * (rng() < 0.3 ? -1 : 1);
  const d0 = randInt(-10, 10, rng);
  const a0 = randInt(-20, 50, rng);
  const terms: number[] = [a0];
  let diff = d0;
  for (let i = 1; i < 6; i++) {
    terms.push(terms[i - 1] + diff);
    diff += s;
  }
  return { kind: "numeric", terms, tag: "seq_polynomial", intendedComplexity: complexityScore(3, [s]) };
}

/**
 * n² + n, or the triangular numbers n(n+1)/2 — a degree-2 polynomial stated directly in the index
 * rather than built up by differences. Verifier-wise this is the same shape fitQuadratic detects
 * (both have a constant second difference — 2 and 1 respectively), so intendedComplexity is
 * computed from that same closed-form second difference. Tagged separately for the debrief: a
 * candidate who struggles with "spot the formula" isn't necessarily struggling with "spot the
 * running difference," even though the underlying algebra coincides.
 */
function draftIndexFormula(rng: () => number, tier: number): Draft {
  const variant = pick(["n2n", "triangular"] as const, rng);
  const n0 = randInt(1, 6 + tier * 3, rng);
  const f = variant === "n2n" ? (n: number) => n * n + n : (n: number) => (n * (n + 1)) / 2;
  const secondDiff = variant === "n2n" ? 2 : 1;
  const terms: number[] = [];
  for (let i = 0; i < 6; i++) terms.push(f(n0 + i));
  return {
    kind: "numeric",
    terms,
    tag: "seq_index_formula",
    intendedComplexity: complexityScore(3, [secondDiff]),
  };
}

/** a(n) = k * a(n-1) + c. Five terms shown, 5th asked. */
function draftMultiplyAdd(rng: () => number, tier: number): Draft {
  const kPool = tier < 2 ? [2, 3] : tier < 4 ? [2, 3, 4] : [2, 3, 4, 5];
  const k = pick(kPool, rng);
  // c !== 0 on purpose: c = 0 would silently collapse this into a plain geometric sequence,
  // mislabeling the item (the fit would still be correct, just under the wrong family/tag).
  let c = randInt(-9, 9, rng) || 1;
  const a0 = randInt(1, 9, rng);

  // The other degenerate draw, and a worse one: c = a0(1 - k) makes a0 the fixed point of the
  // recurrence, so every term is a0 and the item renders as "3, 3, 3, 3, ?". That is not a
  // sequence question — and it is genuinely unfittable, because every k has a c reproducing it,
  // so no independent fitter can recover the intended rule. Nudge off the fixed point.
  const fixedPoint = a0 * (1 - k);
  if (c === fixedPoint) c = c + 1 === 0 ? 1 : c + 1;
  const terms: number[] = [a0];
  for (let i = 1; i < 5; i++) terms.push(k * terms[i - 1] + c);
  return { kind: "numeric", terms, tag: "seq_multiply_add", intendedComplexity: complexityScore(3, [k, c]) };
}

/** a(n) = p*a(n-1) + q*a(n-2) — Fibonacci-like, including weighted variants. Six terms, 6th asked. */
function draftFibonacciLike(rng: () => number, tier: number): Draft {
  const maxCoeff = tier < 2 ? 2 : tier < 4 ? 3 : 4;
  let p = 1;
  let q = 1;
  for (let attempt = 0; attempt < 20; attempt++) {
    p = randInt(1, maxCoeff, rng);
    q = randInt(1, maxCoeff, rng);
    if (p + q <= 5) break; // bounds growth so six terms never approaches MAX_ABS_TERM
  }
  // The seed pair matters as much as the coefficients. When a1/a0 is a characteristic root of
  // r² = pr + q, the recurrence collapses onto a plain geometric sequence — p=2, q=3 seeded 1, 3
  // produces 1, 3, 9, 27, 81, which is just 3ⁿ. That mislabels the item under the wrong family,
  // and it is genuinely unrecoverable: a geometric run makes the 2x2 system for (p, q) singular,
  // so no independent fitter can recover the intended rule. Reseed until the run is not geometric,
  // mirroring the same guard draftMultiplyAdd applies to c.
  let terms: number[] = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    const a0 = randInt(1, 6, rng);
    const a1 = randInt(1, 6, rng);
    terms = [a0, a1];
    for (let i = 2; i < 6; i++) terms.push(p * terms[i - 1] + q * terms[i - 2]);
    const ratio = terms[1] / terms[0];
    const geometric = terms.every((t, i) => i === 0 || Math.abs(t - terms[i - 1] * ratio) < 1e-9);
    if (!geometric) break;
  }
  return { kind: "numeric", terms, tag: "seq_fibonacci", intendedComplexity: complexityScore(4, [p, q]) };
}

/** (-1)^n * m(n), m arithmetic or geometric. Six terms, 6th asked. */
function draftAlternating(rng: () => number, tier: number): Draft {
  const useGeometric = tier >= 2 && rng() < 0.4;
  let mags: number[];
  let structuralCoeff: number;
  if (useGeometric) {
    const r = pick([2, 3], rng);
    const m0 = randInt(1, 9, rng);
    mags = [];
    let v = m0;
    for (let i = 0; i < 6; i++) {
      mags.push(v);
      v *= r;
    }
    structuralCoeff = r;
  } else {
    const [lo, hi] = TIER_D_RANGE[tier];
    const d = randInt(lo, Math.min(hi, 15), rng);
    const m0 = randInt(1, 30, rng);
    mags = [];
    let v = m0;
    for (let i = 0; i < 6; i++) {
      mags.push(v);
      v += d;
    }
    structuralCoeff = d;
  }
  const startSign = rng() < 0.5 ? 1 : -1;
  const terms = mags.map((m, i) => m * (i % 2 === 0 ? startSign : -startSign));
  // paramCount 3 = the base rule's 2 (seed + coefficient) + 1 for "signs alternate" — matches
  // fitAlternating's own accounting exactly (base.complexity + complexityScore(1, [])).
  return {
    kind: "numeric",
    terms,
    tag: "seq_alternating",
    intendedComplexity: complexityScore(3, [structuralCoeff]),
  };
}

/** Two independent arithmetic/geometric branches woven together. Six terms shown, 7th asked. */
function draftInterleaved(rng: () => number, tier: number): Draft {
  const branchLen = 4; // 3 shown + the term that continues this branch when it's the one asked
  const makeBranch = (): { terms: number[]; coeff: number } => {
    if (tier >= 3 && rng() < 0.35) {
      const r = pick([2, 3, -2], rng);
      const a0 = randInt(1, 6, rng);
      const terms: number[] = [];
      let v = a0;
      for (let i = 0; i < branchLen; i++) {
        terms.push(v);
        v *= r;
      }
      return { terms, coeff: r };
    }
    const [lo, hi] = TIER_D_RANGE[tier];
    const d = randInt(lo, hi, rng) * (rng() < 0.3 ? -1 : 1);
    const a0 = randInt(-30, 60, rng);
    const terms: number[] = [];
    let v = a0;
    for (let i = 0; i < branchLen; i++) {
      terms.push(v);
      v += d;
    }
    return { terms, coeff: d };
  };
  const A = makeBranch();
  const B = makeBranch();
  const terms: number[] = [];
  for (let i = 0; i < 3; i++) {
    terms.push(A.terms[i]);
    terms.push(B.terms[i]);
  }
  terms.push(A.terms[3]); // 7th position (index 6, even) continues branch A
  const intendedComplexity = complexityScore(2, [A.coeff]) + complexityScore(2, [B.coeff]);
  return { kind: "numeric", terms, tag: "seq_interleaved", intendedComplexity };
}

/**
 * a(n+1) = a(n) + digitSum(a(n)). Not expressible by any fitter in the battery, so its intended
 * complexity is the EXOTIC sentinel: any algebraic fitter that also happens to explain this prefix
 * disqualifies the item outright, at any complexity — see verifier.ts's doc comment on
 * EXOTIC_COMPLEXITY for why that is the safe default for a rule the battery cannot itself express.
 */
function draftDigitSum(rng: () => number, tier: number): Draft {
  const startHi = 30 + tier * 200;
  const a0 = randInt(10, startHi, rng);
  const terms: number[] = [a0];
  for (let i = 0; i < 4; i++) terms.push(terms[terms.length - 1] + digitSum(terms[terms.length - 1]));
  return { kind: "numeric", terms, tag: "seq_digit_sum", intendedComplexity: EXOTIC_COMPLEXITY };
}

/** Arithmetic progression over alphabet offsets, kept within A-Z so there is never a wrap to argue about. */
function draftLetters(rng: () => number, tier: number): Draft {
  const maxD = Math.min(6, 2 + tier);
  const d = randInt(1, maxD, rng);
  const sign = rng() < 0.5 ? 1 : -1;
  const o0 = sign === 1 ? randInt(0, 25 - d * 4, rng) : randInt(d * 4, 25, rng);
  const terms: string[] = [];
  let offset = o0;
  for (let i = 0; i < 5; i++) {
    terms.push(offsetToLetter(offset));
    offset += sign * d;
  }
  return { kind: "letters", terms, tag: "seq_letters", intendedComplexity: complexityScore(2, [d]) };
}

const FAMILIES: Record<FamilyId, (rng: () => number, tier: number) => Draft> = {
  arithmetic: draftArithmetic,
  geometric: draftGeometric,
  quadratic: draftQuadratic,
  index_formula: draftIndexFormula,
  multiply_add: draftMultiplyAdd,
  fibonacci: draftFibonacciLike,
  alternating: draftAlternating,
  interleaved: draftInterleaved,
  digit_sum: draftDigitSum,
  letters: draftLetters,
};

/** Simplest, always-safe fallback family — draws an arithmetic item, tier 0 coefficients. */
export function draftFallback(rng: () => number): Draft {
  return draftArithmetic(rng, 0);
}

const FAMILY_NONE: Record<FamilyId, number> = {
  arithmetic: 0,
  geometric: 0,
  quadratic: 0,
  index_formula: 0,
  multiply_add: 0,
  fibonacci: 0,
  alternating: 0,
  interleaved: 0,
  digit_sum: 0,
  letters: 0,
};

/**
 * Difficulty ramp — by family AND by coefficient magnitude, keyed off how far through the section
 * an item sits (`index / (count - 1)`). Optiver's own candidate reports describe this paper as
 * visibly harder by the end, so the ramp is real, not cosmetic:
 *
 *   tier 0 (first ~15%):  pure arithmetic / geometric, small coefficients — the warm-up.
 *   tier 1 (~15-35%):     + constant-second-difference polynomials, index-driven formulas, letter
 *                          sequences — one more layer of indirection, still single-rule.
 *   tier 2 (~35-60%):     + multiply-then-add and alternating sign; coefficient ranges widen.
 *   tier 3 (~60-85%):     + Fibonacci-like/weighted recurrences and interleaved pairs — now the
 *                          candidate has to track two numbers (or two sequences) at once.
 *   tier 4 (final ~15%):  + digit-sum recurrences, and every family's coefficient range at its
 *                          widest.
 *
 * Each tier's pool is additive over the previous one — nothing is switched off going up, weights
 * just shift — so easy items can still land late (real papers do not front-load every easy item),
 * while the mean difficulty rises with position.
 */
const TIER_POOLS: Record<FamilyId, number>[] = [
  { ...FAMILY_NONE, arithmetic: 40, geometric: 30 },
  { ...FAMILY_NONE, arithmetic: 22, geometric: 20, quadratic: 16, index_formula: 12, letters: 14 },
  {
    ...FAMILY_NONE,
    arithmetic: 14,
    geometric: 14,
    quadratic: 14,
    index_formula: 8,
    letters: 10,
    multiply_add: 16,
    alternating: 14,
  },
  {
    ...FAMILY_NONE,
    arithmetic: 8,
    geometric: 10,
    quadratic: 10,
    index_formula: 6,
    letters: 8,
    multiply_add: 12,
    alternating: 12,
    fibonacci: 14,
    interleaved: 12,
  },
  {
    ...FAMILY_NONE,
    arithmetic: 5,
    geometric: 8,
    quadratic: 8,
    index_formula: 5,
    letters: 6,
    multiply_add: 10,
    alternating: 10,
    fibonacci: 14,
    interleaved: 14,
    digit_sum: 12,
  },
];

export function tierForIndex(index: number, count: number): number {
  const frac = count <= 1 ? 0 : index / (count - 1);
  if (frac < 0.15) return 0;
  if (frac < 0.35) return 1;
  if (frac < 0.6) return 2;
  if (frac < 0.85) return 3;
  return 4;
}

export function draftForTier(rng: () => number, tier: number): Draft {
  const id = weightedPick(TIER_POOLS[tier], rng);
  return FAMILIES[id](rng, tier);
}
