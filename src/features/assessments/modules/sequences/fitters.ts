/**
 * Independent rule-fitters for the sequences ambiguity verifier.
 *
 * Each fitter below looks at a numeric prefix cold — it has no idea which family (if any)
 * generated it — and answers two questions: "does this rule explain every term I was shown?"
 * and, if so, "what complexity does that explanation cost, and what does it predict next?"
 * `runFitters` runs the whole battery and returns every rule that fits.
 *
 * Complexity metric (documented once, here, since every fitter uses it):
 *
 *   complexity = paramCount * PARAM_WEIGHT + Σ log2(1 + |structural coefficient|)
 *
 * `paramCount` is the total degrees of freedom needed to pin down the *entire* infinite sequence
 * under that rule: seed terms the rule needs to get started, plus the free coefficients in the
 * recurrence itself (arithmetic needs a seed + a common difference = 2; a order-2 recurrence needs
 * two seeds + two recurrence coefficients = 4; and so on — see the comment on each fitter). Param
 * count dominates the score (weight 10) because a rule with more independent knobs is a
 * categorically weaker explanation of a short prefix, no matter how "clean" its numbers are — with
 * enough free parameters you can fit almost anything. The coefficient-magnitude term is a
 * log-scaled tie-breaker *within* the same param count: a ratio of 2 is judged a simpler geometric
 * rule than a ratio of 47, the way a human grader would read it. It is intentionally small (a
 * handful of points at most for realistic term sizes) so it can only ever break ties between
 * same-arity rules, never let an uglier-but-lower-arity rule leapfrog a cleaner higher-arity one.
 *
 * This is what makes the classic ambiguity catchable: 2, 4, 8 fits geometric (ratio 2, paramCount
 * 2) predicting 16, *and* fits "constant second difference" (paramCount 3) predicting 14. Since
 * geometric's complexity (paramCount 2) is strictly lower, an item generated as the *quadratic*
 * one gets rejected — a strictly simpler, equally-valid rule contradicts it. An item generated as
 * the *geometric* one ships, because nothing at paramCount <= 2 disagrees (only arithmetic is that
 * cheap, and arithmetic does not fit 2, 4, 8 at all). See verifier.ts for how a family's own
 * intended complexity is compared against this battery.
 */

export interface Fit {
  /** Which fitter matched — also doubles as a human-readable label for test failure messages. */
  name: string;
  complexity: number;
  nextTerm: number;
}

/** Free parameters * this weight so param count dominates the coefficient-magnitude tie-breaker. */
const PARAM_WEIGHT = 10;

/** Loose enough for exact integers, tight enough that no real rule "accidentally" matches. */
const EPS = 1e-6;

function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
}

export function complexityScore(paramCount: number, structuralCoeffs: number[]): number {
  const coeffPenalty = structuralCoeffs.reduce((sum, c) => sum + Math.log2(1 + Math.abs(c)), 0);
  return paramCount * PARAM_WEIGHT + coeffPenalty;
}

/** a(n) = a(n-1) + d. paramCount 2: one seed (a0) + one structural coefficient (d). */
export function fitArithmetic(seq: number[]): Fit | null {
  if (seq.length < 2) return null;
  const d = seq[1] - seq[0];
  for (let i = 2; i < seq.length; i++) {
    if (!closeEnough(seq[i] - seq[i - 1], d)) return null;
  }
  return { name: "arithmetic", complexity: complexityScore(2, [d]), nextTerm: seq[seq.length - 1] + d };
}

/** a(n) = a(n-1) * r. paramCount 2: one seed (a0) + one structural coefficient (r). */
export function fitGeometric(seq: number[]): Fit | null {
  if (seq.length < 2 || seq.some((v) => v === 0)) return null;
  const r = seq[1] / seq[0];
  if (!Number.isFinite(r)) return null;
  for (let i = 2; i < seq.length; i++) {
    if (!closeEnough(seq[i], seq[i - 1] * r)) return null;
  }
  return { name: "geometric", complexity: complexityScore(2, [r]), nextTerm: seq[seq.length - 1] * r };
}

/**
 * Constant second difference (any degree-2 polynomial in the index). paramCount 3: two seeds
 * (a0, a1, equivalently a0 and the first difference) + one structural coefficient (the constant
 * second difference itself). Predicts the next term by extrapolating the running first difference.
 */
export function fitQuadratic(seq: number[]): Fit | null {
  if (seq.length < 3) return null;
  const d1: number[] = [];
  for (let i = 1; i < seq.length; i++) d1.push(seq[i] - seq[i - 1]);
  const d2: number[] = [];
  for (let i = 1; i < d1.length; i++) d2.push(d1[i] - d1[i - 1]);
  if (d2.length === 0) return null;
  const s = d2[0];
  for (const x of d2) if (!closeEnough(x, s)) return null;
  const nextDiff = d1[d1.length - 1] + s;
  return { name: "quadratic", complexity: complexityScore(3, [s]), nextTerm: seq[seq.length - 1] + nextDiff };
}

/**
 * a(n) = k * a(n-1) + c (multiply-then-add). paramCount 3: one seed (a0) + two structural
 * coefficients (k, c). Solved from the first three terms, confirmed against any further terms.
 */
export function fitAffine1(seq: number[]): Fit | null {
  if (seq.length < 3) return null;
  const [a0, a1, a2] = seq;
  if (closeEnough(a1, a0)) return null; // degenerate: can't separate k from c
  const k = (a2 - a1) / (a1 - a0);
  const c = a1 - k * a0;
  for (let i = 3; i < seq.length; i++) {
    if (!closeEnough(seq[i], k * seq[i - 1] + c)) return null;
  }
  return {
    name: "multiply-then-add",
    complexity: complexityScore(3, [k, c]),
    nextTerm: k * seq[seq.length - 1] + c,
  };
}

/**
 * a(n) = p * a(n-1) + q * a(n-2) (Fibonacci-like, including weighted variants). paramCount 4: two
 * seeds (a0, a1) + two structural coefficients (p, q). Solved from the first four terms via
 * Cramer's rule, confirmed against any further terms.
 */
export function fitLinearRecurrence2(seq: number[]): Fit | null {
  if (seq.length < 4) return null;
  const [a0, a1, a2, a3] = seq;
  const det = a1 * a1 - a0 * a2;
  if (closeEnough(det, 0)) return null;
  const p = (a1 * a2 - a0 * a3) / det;
  const q = (a1 * a3 - a2 * a2) / det;
  for (let i = 4; i < seq.length; i++) {
    if (!closeEnough(seq[i], p * seq[i - 1] + q * seq[i - 2])) return null;
  }
  const last = seq[seq.length - 1];
  const prev = seq[seq.length - 2];
  return {
    name: "linear-recurrence-2",
    complexity: complexityScore(4, [p, q]),
    nextTerm: p * last + q * prev,
  };
}

/**
 * Alternating sign around an arithmetic or geometric magnitude: a(n) = (-1)^n * m(n), where m is
 * arithmetic or geometric. paramCount = the base rule's 2 seeds/coefficients + 1 structural flag
 * for "signs alternate" (itself an assumption beyond the base rule, so it costs a parameter).
 */
export function fitAlternating(seq: number[]): Fit | null {
  if (seq.length < 4) return null;
  for (let i = 1; i < seq.length; i++) {
    const s0 = Math.sign(seq[i - 1]);
    const s1 = Math.sign(seq[i]);
    if (s0 === 0 || s1 === 0 || s0 === s1) return null;
  }
  const mags = seq.map(Math.abs);
  const base = fitArithmetic(mags) ?? fitGeometric(mags);
  if (!base) return null;
  const nextSign = Math.sign(seq[seq.length - 1]) * -1;
  return {
    name: "alternating",
    complexity: base.complexity + complexityScore(1, []),
    nextTerm: nextSign * base.nextTerm,
  };
}

/**
 * Two independent sequences interleaved (odd/even positions), each arithmetic or geometric.
 * paramCount is the sum of both branches' own paramCount (2 + 2 = 4) — interleaving costs nothing
 * extra by itself; it is exactly as complex as positing two simple rules at once, which is the
 * point: it should only out-rank a genuinely-simpler single rule when no such single rule exists.
 */
export function fitInterleaved(seq: number[]): Fit | null {
  if (seq.length < 6) return null;
  const branchA = seq.filter((_, i) => i % 2 === 0);
  const branchB = seq.filter((_, i) => i % 2 === 1);
  if (branchA.length < 3 || branchB.length < 3) return null;
  const fitBranch = (b: number[]): Fit | null => fitArithmetic(b) ?? fitGeometric(b);
  const fa = fitBranch(branchA);
  const fb = fitBranch(branchB);
  if (!fa || !fb) return null;
  // seq.length is even => the next index (seq.length) is even => continues branch A.
  const nextTerm = seq.length % 2 === 0 ? fa.nextTerm : fb.nextTerm;
  return { name: "interleaved", complexity: fa.complexity + fb.complexity, nextTerm };
}

/** The full battery, in no particular order — each fitter is independent of the others. */
export function runFitters(seq: number[]): Fit[] {
  const candidates = [
    fitArithmetic(seq),
    fitGeometric(seq),
    fitQuadratic(seq),
    fitAffine1(seq),
    fitLinearRecurrence2(seq),
    fitAlternating(seq),
    fitInterleaved(seq),
  ];
  return candidates.filter((f): f is Fit => f !== null);
}
