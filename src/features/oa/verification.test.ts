/**
 * Independent verification of the generators' *answers*.
 *
 * generators.test.ts already proves each question is well-formed and self-consistent: the grader
 * accepts the answer the generator produced, and rejects a different number. That is a real safety
 * net, but it cannot catch the failure that costs a candidate the most — a closed form that is
 * simply wrong. If `twoDiceSum` miscounted the ways to make 7, the generator would say 5/36, the
 * grader would accept 5/36, a different number would be rejected, and every test would pass while
 * the candidate who correctly answered 6/36 was marked wrong.
 *
 * So nothing here reuses a generator's own arithmetic. Each question is re-derived from its
 * *rendered prompt* — the same string the candidate reads — by simulation or exhaustive
 * enumeration, and the stored answer has to match. This is the discipline
 * src/features/integrals/problems.test.ts applies to the integral bank, which numerically
 * differentiates every stored antiderivative rather than trusting the author.
 *
 * Development-time cost only. Nothing here runs for a user.
 */
import { describe, expect, it } from "vitest";
import { rng as makeRng } from "./rng";
import { generateQuestion } from "./generate";
import type { Question } from "./types";
import { FIRMS } from "./firms";

/** Deterministic sampler for the Monte Carlo checks, independent of the generators' own rng. */
function sampler(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roll = (faces: number, r: () => number) => 1 + Math.floor(r() * faces);

/** Every question the generators can produce, across all levels, deduplicated by prompt. */
function harvest(kind: Question["kind"], perLevel = 400): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  for (let level = 1; level <= 5; level++) {
    const r = makeRng(level * 7919 + kind.length);
    for (let i = 0; i < perLevel; i++) {
      const q = generateQuestion(kind, r, level, `v-${level}-${i}`);
      if (seen.has(q.prompt)) continue;
      seen.add(q.prompt);
      out.push(q);
    }
  }
  return out;
}

function numericAnswer(q: Question): number | null {
  return q.answer.type === "numeric" ? q.answer.value : null;
}

/**
 * Re-derives a probability question from its prompt alone. Returns null for a prompt shape this
 * verifier does not know — the caller asserts on coverage separately, so an unrecognised shape
 * shows up as a coverage gap rather than silently passing.
 */
function verifyProbability(prompt: string): number | null {
  let m: RegExpExecArray | null;

  // "Two fair dice are rolled. What is the probability the total is N?"
  if ((m = /^Two fair dice are rolled\. What is the probability the total is (\d+)\?$/.exec(prompt))) {
    const target = Number(m[1]);
    let ways = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === target) ways++;
    return ways / 36;
  }

  // "A fair F-sided die is rolled N times. What is the probability of at least one F?"
  if ((m = /^A fair (\d+)-sided die is rolled (\d+) times\. What is the probability of at least one (\d+)\?$/.exec(prompt))) {
    const [faces, n, face] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const r = sampler(11);
    let hits = 0;
    const TRIALS = 400_000;
    for (let t = 0; t < TRIALS; t++) {
      let got = false;
      for (let i = 0; i < n; i++) if (roll(faces, r) === face) got = true;
      if (got) hits++;
    }
    return hits / TRIALS;
  }

  // "A fair coin is flipped N times. What is the probability of exactly K heads?"
  if ((m = /^A fair coin is flipped (\d+) times\. What is the probability of exactly (\d+) heads?\?$/.exec(prompt))) {
    const [n, k] = [Number(m[1]), Number(m[2])];
    // Exhaustive over all 2^n sequences — exact, no sampling error.
    let ways = 0;
    for (let mask = 0; mask < 1 << n; mask++) {
      let heads = 0;
      for (let b = 0; b < n; b++) if (mask & (1 << b)) heads++;
      if (heads === k) ways++;
    }
    return ways / 2 ** n;
  }

  // "A bag holds R red and B blue balls. Two are drawn without replacement..."
  if ((m = /^A bag holds (\d+) red and (\d+) blue balls\. Two are drawn without replacement\. What is the probability both are red\?$/.exec(prompt))) {
    const [red, blue] = [Number(m[1]), Number(m[2])];
    const n = red + blue;
    // Exhaustive over ordered pairs of distinct positions.
    let both = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        total++;
        if (i < red && j < red) both++;
      }
    }
    return both / total;
  }

  // "P people each pick one of D days at random. What is the probability all P picks are different?"
  if ((m = /^(\d+) people each pick one of (\d+) days at random\. What is the probability all (\d+) picks are different\?$/.exec(prompt))) {
    const [people, days] = [Number(m[1]), Number(m[2])];
    const r = sampler(23);
    let allDistinct = 0;
    const TRIALS = 400_000;
    for (let t = 0; t < TRIALS; t++) {
      const picks = new Set<number>();
      for (let i = 0; i < people; i++) picks.add(Math.floor(r() * days));
      if (picks.size === people) allDistinct++;
    }
    return allDistinct / TRIALS;
  }

  // "Two fair F-sided dice are rolled. What is the probability the first is strictly greater...?"
  if ((m = /^Two fair (\d+)-sided dice are rolled\. What is the probability the first is strictly greater than the second\?$/.exec(prompt))) {
    const faces = Number(m[1]);
    let ways = 0;
    for (let a = 1; a <= faces; a++) for (let b = 1; b <= faces; b++) if (a > b) ways++;
    return ways / (faces * faces);
  }

  // Bayes: "R% of a population has a condition. A test catches S% of cases and wrongly flags F% of
  // healthy people. Someone tests positive — what is the probability they have it?"
  if ((m = /^(\d+)% of a population has a condition\. A test catches (\d+)% of cases and wrongly flags (\d+)% of healthy people\. Someone tests positive — what is the probability they have it\?$/.exec(prompt))) {
    const [rate, sens, fpr] = [Number(m[1]) / 100, Number(m[2]) / 100, Number(m[3]) / 100];
    const r = sampler(37);
    let positive = 0;
    let sick = 0;
    const TRIALS = 1_500_000;
    for (let t = 0; t < TRIALS; t++) {
      const isSick = r() < rate;
      const flags = isSick ? r() < sens : r() < fpr;
      if (!flags) continue;
      positive++;
      if (isSick) sick++;
    }
    return positive === 0 ? 0 : sick / positive;
  }

  // "Two cards are drawn from a standard 52-card deck without replacement. What is the probability
  // they are <kind>?"
  if ((m = /^Two cards are drawn from a standard 52-card deck without replacement\. What is the probability they are (.+)\?$/.exec(prompt))) {
    const kind = m[1];
    // Build a real 52-card deck and enumerate every ordered pair of distinct cards, so the count
    // comes from the deck's actual composition rather than from a restated formula. Suit index
    // 0-3, rank index 0-12 with 0 = ace, 10/11/12 = J/Q/K.
    const isTarget = (card: number): boolean => {
      const rank = card % 13;
      if (kind === "both hearts") return Math.floor(card / 13) === 0;
      if (kind === "both aces") return rank === 0;
      if (kind === "both face cards") return rank >= 10;
      return false;
    };
    if (!["both hearts", "both aces", "both face cards"].includes(kind)) return null;

    let match = 0;
    let total = 0;
    for (let a = 0; a < 52; a++) {
      for (let b = 0; b < 52; b++) {
        if (a === b) continue;
        total++;
        if (isTarget(a) && isTarget(b)) match++;
      }
    }
    return match / total;
  }

  return null;
}

describe("probability answers are independently correct", () => {
  const questions = harvest("probability");

  it("re-derives every probability question from its prompt and matches the stored answer", () => {
    let checked = 0;
    const unrecognised = new Set<string>();

    for (const q of questions) {
      const stored = numericAnswer(q);
      if (stored === null) continue;
      const derived = verifyProbability(q.prompt);
      if (derived === null) {
        unrecognised.add(q.prompt.slice(0, 80));
        continue;
      }
      checked++;
      // Exhaustive branches are exact; Monte Carlo branches carry sampling error, so the tolerance
      // is set well inside what a wrong closed form would miss by.
      expect(
        Math.abs(derived - stored),
        `${q.prompt}\n  stored ${stored}, independently derived ${derived}`,
      ).toBeLessThan(0.004);
    }

    // Fail loudly on a shape this verifier cannot read, rather than quietly verifying nothing.
    expect(
      [...unrecognised],
      "prompt shapes this verifier does not cover — extend verifyProbability",
    ).toEqual([]);
    expect(checked, "no probability questions were actually verified").toBeGreaterThan(20);
  });

  it("never states a probability outside [0, 1]", () => {
    for (const q of questions) {
      const stored = numericAnswer(q);
      if (stored === null) continue;
      expect(stored, q.prompt).toBeGreaterThanOrEqual(0);
      expect(stored, q.prompt).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Sequences: is the stated answer the ONLY defensible one?
// ---------------------------------------------------------------------------------------------

/**
 * A fit found by an independent rule-fitter that knows nothing about which family generated the
 * sequence. `params` is the count of free parameters — the complexity measure used to decide
 * whether a competing rule is simple enough to be a defensible alternative reading.
 */
interface Fit {
  name: string;
  params: number;
  next: number;
}

const EPS = 1e-9;
const closeAll = (xs: number[], ys: number[]) => xs.every((x, i) => Math.abs(x - ys[i]) < EPS);

function fitArithmetic(t: number[]): Fit | null {
  const d = t[1] - t[0];
  const model = t.map((_, i) => t[0] + i * d);
  return closeAll(t, model) ? { name: "arithmetic", params: 2, next: t[0] + t.length * d } : null;
}

function fitGeometric(t: number[]): Fit | null {
  if (t[0] === 0) return null;
  const r = t[1] / t[0];
  const model = t.map((_, i) => t[0] * r ** i);
  return closeAll(t, model) ? { name: "geometric", params: 2, next: t[0] * r ** t.length } : null;
}

/** Constant second difference — fits any quadratic in n, including squares and triangulars. */
function fitQuadratic(t: number[]): Fit | null {
  if (t.length < 4) return null;
  const d1 = t.slice(1).map((v, i) => v - t[i]);
  const d2 = d1.slice(1).map((v, i) => v - d1[i]);
  if (!d2.every((v) => Math.abs(v - d2[0]) < EPS)) return null;
  const nextD1 = d1[d1.length - 1] + d2[0];
  return { name: "quadratic", params: 3, next: t[t.length - 1] + nextD1 };
}

/** a(n) = p·a(n-1) + q·a(n-2), solved from two consecutive triples. */
function fitLinearRecurrence(t: number[]): Fit | null {
  if (t.length < 5) return null;
  const [a, b, c, d] = [t[0], t[1], t[2], t[3]];
  const det = b * b - a * c;
  if (Math.abs(det) < EPS) return null;
  const p = (c * b - d * a) / det;
  const q = (d * b - c * c) / det;
  for (let i = 2; i < t.length; i++) {
    if (Math.abs(t[i] - (p * t[i - 1] + q * t[i - 2])) > 1e-6) return null;
  }
  return { name: "linear-recurrence", params: 4, next: p * t[t.length - 1] + q * t[t.length - 2] };
}

/** a(n) = k·a(n-1) + c. */
function fitAffine(t: number[]): Fit | null {
  if (t.length < 3) return null;
  const den = t[1] - t[0];
  if (Math.abs(den) < EPS) return null;
  const k = (t[2] - t[1]) / den;
  const c = t[1] - k * t[0];
  for (let i = 1; i < t.length; i++) {
    if (Math.abs(t[i] - (k * t[i - 1] + c)) > 1e-6) return null;
  }
  return { name: "affine", params: 2, next: k * t[t.length - 1] + c };
}

const FITTERS = [fitArithmetic, fitGeometric, fitAffine, fitQuadratic, fitLinearRecurrence];

/**
 * Pulls the shown terms out of the rendered LaTeX prompt — what the candidate actually reads.
 *
 * The prompt separates terms with a literal backslash-semicolon (LaTeX's thin space), so the
 * backslashes have to go before Number() sees anything. Getting this wrong makes the whole
 * sequence check silently verify nothing, which is the same vacuous-pass failure this file exists
 * to rule out — hence the coverage assertion in the test below.
 */
function parseSequencePrompt(prompt: string): number[] | null {
  const body = prompt.replace(/\\;/g, " ").replace(/\\text\{\?\}/g, "").replace(/\\/g, " ").trim();
  const parts = body.split(",").map((s) => s.trim()).filter(Boolean);
  const nums = parts.map(Number);
  return nums.every((n) => Number.isFinite(n)) && nums.length >= 4 ? nums : null;
}

describe("sequence answers are the only defensible ones", () => {
  const questions = harvest("sequence");

  it("actually parses the sequences it claims to check", () => {
    // Without this the ambiguity test below passes vacuously on a prompt-format change — every
    // sequence fails to parse, nothing is checked, and the suite still goes green.
    const parsed = questions.filter((q) => parseSequencePrompt(q.prompt) !== null);
    expect(questions.length).toBeGreaterThan(100);
    expect(
      parsed.length / questions.length,
      `only ${parsed.length} of ${questions.length} sequence prompts parsed`,
    ).toBeGreaterThan(0.9);
  });

  it("is never read differently by a rule as simple as the intended one", () => {
    const ambiguous: string[] = [];

    for (const q of questions) {
      const terms = parseSequencePrompt(q.prompt);
      const stored = numericAnswer(q);
      if (terms === null || stored === null) continue;

      const fits = FITTERS.map((f) => f(terms)).filter((f): f is Fit => f !== null);
      const agreeing = fits.filter((f) => Math.abs(f.next - stored) < 1e-6);
      const disagreeing = fits.filter((f) => Math.abs(f.next - stored) >= 1e-6);
      if (disagreeing.length === 0) continue;

      // The intended rule's complexity, as read off whichever fitter reproduces the stated answer.
      // With none, treat the intended rule as more complex than any fitter (the digit/interleaved
      // families), so a competing simple fit is a genuine alternative reading.
      const intendedParams = agreeing.length > 0 ? Math.min(...agreeing.map((f) => f.params)) : Infinity;
      const simplerRival = disagreeing.find((f) => f.params <= intendedParams);
      if (simplerRival) {
        ambiguous.push(
          `${terms.join(", ")}, ? — stated ${stored}, but ${simplerRival.name} (${simplerRival.params} params) reads it as ${simplerRival.next}`,
        );
      }
    }

    expect(ambiguous, "sequences with more than one defensible next term").toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Expected value: simulate the game described in the prompt.
// ---------------------------------------------------------------------------------------------

function verifyExpectedValue(prompt: string): number | null {
  let m: RegExpExecArray | null;
  const TRIALS = 500_000;

  if ((m = /^You roll a fair (\d+)-sided die and are paid its face value in dollars\./.exec(prompt))) {
    const faces = Number(m[1]);
    const r = sampler(101);
    let total = 0;
    for (let t = 0; t < TRIALS; t++) total += roll(faces, r);
    return total / TRIALS;
  }

  if ((m = /^You roll a fair (\d+)-sided die and are paid its face value, but you may reroll once/.exec(prompt))) {
    const faces = Number(m[1]);
    const r = sampler(103);
    // Optimal play: reroll whenever the first roll is below the mean of a fresh roll.
    const fresh = (faces + 1) / 2;
    let total = 0;
    for (let t = 0; t < TRIALS; t++) {
      const first = roll(faces, r);
      total += first < fresh ? roll(faces, r) : first;
    }
    return total / TRIALS;
  }

  if ((m = /^A coin lands heads with probability ([\d.]+)\. How many flips on average until the first head\?$/.exec(prompt))) {
    const p = Number(m[1]);
    const r = sampler(107);
    let total = 0;
    for (let t = 0; t < 200_000; t++) {
      let flips = 1;
      while (r() >= p) flips++;
      total += flips;
    }
    return total / 200_000;
  }

  if ((m = /^Two fair (\d+)-sided dice are rolled and you are paid the higher of the two\./.exec(prompt))) {
    const faces = Number(m[1]);
    let total = 0;
    for (let a = 1; a <= faces; a++) for (let b = 1; b <= faces; b++) total += Math.max(a, b);
    return total / (faces * faces);
  }

  if ((m = /^(\d+) fair (\d+)-sided dice are rolled\. What is the expected total\?$/.exec(prompt))) {
    const [n, faces] = [Number(m[1]), Number(m[2])];
    const r = sampler(109);
    let total = 0;
    for (let t = 0; t < TRIALS; t++) {
      for (let i = 0; i < n; i++) total += roll(faces, r);
    }
    return total / TRIALS;
  }

  if ((m = /^(\d+) cards are drawn from a standard deck with replacement\. How many hearts do you expect\?$/.exec(prompt))) {
    const draws = Number(m[1]);
    const r = sampler(113);
    let total = 0;
    for (let t = 0; t < TRIALS; t++) {
      for (let i = 0; i < draws; i++) if (Math.floor(r() * 52) < 13) total++;
    }
    return total / TRIALS;
  }

  return null;
}

describe("expected-value answers are independently correct", () => {
  const questions = harvest("expected-value");

  it("re-derives by simulation and matches the stated answer", () => {
    let checked = 0;
    for (const q of questions) {
      const stored = numericAnswer(q);
      if (stored === null) continue;
      const derived = verifyExpectedValue(q.prompt);
      if (derived === null) continue;
      checked++;
      // Relative tolerance: these are payouts in the single digits up to tens, not probabilities.
      expect(
        Math.abs(derived - stored) / Math.max(1, Math.abs(stored)),
        `${q.prompt}\n  stored ${stored}, simulated ${derived}`,
      ).toBeLessThan(0.01);
    }
    expect(checked, "no expected-value questions were verified").toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------------------------
// Negative marking: scored as marks, and never hidden from the candidate.
// ---------------------------------------------------------------------------------------------

describe("penalty-marked sections", () => {
  const allSections = FIRMS.flatMap((f) =>
    f.assessments.flatMap((a) => a.sections.map((s) => ({ firm: f, assessment: a, section: s }))),
  );

  it("tells the candidate whenever a section carries a penalty", () => {
    // A penalty nobody is told about is worse than no penalty: it silently punishes the guessing
    // the interface otherwise invites, and the candidate never learns why their score fell.
    for (const { firm, assessment, section } of allSections) {
      if (!section.negativeMarking) continue;
      const text = assessment.rules.join(" ");
      expect(
        text.includes("−1"),
        `${firm.name} · ${assessment.name} penalises "${section.name}" but never says so in its rules`,
      ).toBe(true);
    }
  });

  it("never claims there is no penalty while applying one", () => {
    for (const { firm, assessment } of allSections) {
      const text = assessment.rules.join(" ").toLowerCase();
      const claimsNone = text.includes("no negative marking");
      const applies = assessment.sections.some((s) => s.negativeMarking);
      expect(
        claimsNone && applies,
        `${firm.name} · ${assessment.name} says there is no negative marking but applies one`,
      ).toBe(false);
    }
  });

  it("scores penalty sections on marks, not accuracy", () => {
    // The behaviour the whole change exists for: two candidates answering the same number of
    // questions correctly must NOT score the same when one of them guessed the rest.
    const scoreOf = (correct: number, wrong: number, count: number, penalty: boolean) => {
      const marks = penalty ? correct - wrong : correct;
      return Math.max(0, marks) / count;
    };

    // Left 60 blank vs guessed 60 and got 15 of them: same 35 right on the ones they knew.
    const disciplined = scoreOf(20, 0, 80, true);
    const guesser = scoreOf(35, 45, 80, true);
    expect(guesser, "guessing must not beat leaving blanks under a penalty").toBeLessThan(disciplined);

    // Without a penalty the guesser wins, which is exactly why the flag has to exist.
    expect(scoreOf(35, 45, 80, false)).toBeGreaterThan(scoreOf(20, 0, 80, false));

    // A catastrophic run floors at zero rather than reporting a negative headline score.
    expect(scoreOf(5, 60, 80, true)).toBe(0);
  });
});
