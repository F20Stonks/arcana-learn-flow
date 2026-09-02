import { describe, expect, it } from "vitest";
import { seededRng } from "../../engine/rng";
import { generateSequenceItem } from "./generate";
import { draftForTier, MAX_ABS_TERM, withinMagnitudeGuard, type FamilyId } from "./families";
import {
  checkAmbiguityLetters,
  checkAmbiguityNumeric,
  letterToOffset,
  offsetToLetter,
} from "./verifier";
import {
  fitAffine1,
  fitAlternating,
  fitArithmetic,
  fitGeometric,
  fitInterleaved,
  fitLinearRecurrence2,
  fitQuadratic,
  type Fit,
} from "./fitters";

/**
 * The bank grades itself.
 *
 * Same discipline as src/features/integrals/problems.test.ts and
 * modules/arithmetic/generate.test.ts: nothing here trusts the generator's own arithmetic. Every
 * item's prompt is re-parsed independently, and the stored answer is checked against a fitter
 * chosen purely by the item's tag — fitters.ts is generic (it does not know about families or
 * tags), so this is a genuinely independent recomputation, not a restatement of families.ts's own
 * loop.
 */

/** Re-derives the digit-sum recurrence from scratch — deliberately not imported from families.ts. */
function digitSumIndependent(n: number): number {
  return String(Math.abs(n))
    .split("")
    .reduce((sum, ch) => sum + Number(ch), 0);
}

function parsePrompt(prompt: string, isLetters: boolean): number[] | string[] {
  const parts = prompt.replace(/, \?$/, "").split(", ");
  return isLetters ? parts : parts.map(Number);
}

/** The fitter that *should* explain each tag, purely for independent re-verification. */
const TAG_FITTER: Partial<Record<string, (seq: number[]) => Fit | null>> = {
  seq_arithmetic: fitArithmetic,
  seq_geometric: fitGeometric,
  seq_polynomial: fitQuadratic,
  seq_index_formula: fitQuadratic,
  seq_multiply_add: fitAffine1,
  seq_fibonacci: fitLinearRecurrence2,
  seq_alternating: fitAlternating,
  seq_interleaved: fitInterleaved,
};

/** Recomputes the expected next term purely from the tag + prefix, never trusting the generator. */
function recomputeExpected(tag: string, prompt: string, answer: string): number | string {
  const isLetters = tag === "seq_letters";
  const prefix = parsePrompt(prompt, isLetters);

  if (tag === "seq_digit_sum") {
    const nums = prefix as number[];
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i], `digit-sum step broke at ${prompt}`).toBe(nums[i - 1] + digitSumIndependent(nums[i - 1]));
    }
    const last = nums[nums.length - 1];
    return last + digitSumIndependent(last);
  }

  if (isLetters) {
    const offsets = (prefix as string[]).map(letterToOffset);
    const fit = fitArithmetic(offsets);
    expect(fit, `no independent arithmetic-on-offsets fit for ${prompt} (answer ${answer})`).not.toBeNull();
    return offsetToLetter(Math.round(fit!.nextTerm));
  }

  const fitter = TAG_FITTER[tag];
  expect(fitter, `no independent fitter registered for tag ${tag}`).toBeDefined();
  const fit = fitter!(prefix as number[]);
  expect(fit, `no independent fit reproduced ${prompt} -> ${answer} (tag ${tag})`).not.toBeNull();
  return fit!.nextTerm;
}

const FIRM_SHAPES: Array<{ itemCount: number }> = [{ itemCount: 26 }, { itemCount: 25 }, { itemCount: 30 }];
const SEEDS_PER_SHAPE = 25;

function papers(): ReturnType<typeof generateSequenceItem>[][] {
  const out: ReturnType<typeof generateSequenceItem>[][] = [];
  for (const { itemCount } of FIRM_SHAPES) {
    for (let seed = 1; seed <= SEEDS_PER_SHAPE; seed++) {
      const rng = seededRng(seed * 7919 + itemCount);
      out.push(Array.from({ length: itemCount }, (_, index) => generateSequenceItem(rng, index, itemCount)));
    }
  }
  return out;
}

describe("sequences generator", () => {
  const allPapers = papers();
  const allItems = allPapers.flat();

  it("generates a stored answer that an independent fitter — chosen only by the item's tag — also predicts", () => {
    for (const item of allItems) {
      const expected = recomputeExpected(item.tag, item.prompt, item.answer);
      if (typeof expected === "string") {
        expect(item.answer).toBe(expected);
      } else {
        expect(Number(item.answer), `${item.prompt} -> stored ${item.answer}, expected ${expected}`).toBe(
          Math.round(expected),
        );
      }
    }
  });

  it("every generated item independently re-clears the ambiguity verifier from its public prompt/answer alone", () => {
    // End-to-end re-check using only what a candidate (or a bug report) would see: the rendered
    // prompt and the stored answer. This does not reuse any generator-internal complexity value —
    // it recomputes the intended complexity from the matching fit's own coefficients, exactly the
    // way the verifier itself would score that rule.
    for (const item of allItems) {
      const isLetters = item.tag === "seq_letters";
      const prefix = parsePrompt(item.prompt, isLetters);

      if (item.tag === "seq_digit_sum") continue; // exotic sentinel — covered by the "rejects any
      // competing fit at all" behaviour already exercised in verifier.test.ts; there is no
      // reduced-complexity value to recompute here by design.

      if (isLetters) {
        const offsets = (prefix as string[]).map(letterToOffset);
        const fit = fitArithmetic(offsets)!;
        const result = checkAmbiguityLetters(prefix as string[], item.answer, fit.complexity);
        expect(result.ambiguous, `${item.prompt} -> ${item.answer} should have cleared the verifier`).toBe(false);
        continue;
      }

      const fitter = TAG_FITTER[item.tag]!;
      const fit = fitter(prefix as number[])!;
      const result = checkAmbiguityNumeric(prefix as number[], Number(item.answer), fit.complexity);
      expect(result.ambiguous, `${item.prompt} -> ${item.answer} should have cleared the verifier`).toBe(false);
    }
  });

  it("never stores an absurd term magnitude", () => {
    for (const item of allItems) {
      if (item.tag === "seq_letters") continue;
      const values = parsePrompt(item.prompt, false).map(Number).concat(Number(item.answer));
      for (const v of values) {
        expect(Math.abs(v), `${item.prompt} -> ${item.answer}`).toBeLessThanOrEqual(MAX_ABS_TERM);
      }
    }
  });

  it("never repeats a sequence within one paper", () => {
    for (const paper of allPapers) {
      const signatures = paper.map((item) => `${item.tag}:${item.prompt}:${item.answer}`);
      expect(new Set(signatures).size, "duplicate sequence within a paper").toBe(signatures.length);
    }
  });

  it("is deterministic — the same seed produces the same paper", () => {
    const paper = (seed: number) => {
      const rng = seededRng(seed);
      return Array.from({ length: 26 }, (_, i) => generateSequenceItem(rng, i, 26));
    };
    const a = paper(20260902);
    const b = paper(20260902);
    expect(a.map((i) => i.prompt)).toEqual(b.map((i) => i.prompt));
    expect(a.map((i) => i.answer)).toEqual(b.map((i) => i.answer));
    expect(a.map((i) => i.tag)).toEqual(b.map((i) => i.tag));
  });

  it("produces every tag/family across a large enough sample", () => {
    const seen = new Set(allItems.map((i) => i.tag));
    const expectedTags: FamilyId[] = [
      "arithmetic",
      "geometric",
      "quadratic",
      "index_formula",
      "multiply_add",
      "fibonacci",
      "alternating",
      "interleaved",
      "digit_sum",
      "letters",
    ];
    // Tags are prefixed "seq_", except the two constant-second-difference families which share
    // fitter shape but keep distinct tags (seq_polynomial, seq_index_formula).
    const tagFor: Record<FamilyId, string> = {
      arithmetic: "seq_arithmetic",
      geometric: "seq_geometric",
      quadratic: "seq_polynomial",
      index_formula: "seq_index_formula",
      multiply_add: "seq_multiply_add",
      fibonacci: "seq_fibonacci",
      alternating: "seq_alternating",
      interleaved: "seq_interleaved",
      digit_sum: "seq_digit_sum",
      letters: "seq_letters",
    };
    for (const family of expectedTags) {
      expect(seen.has(tagFor[family]), `family "${family}" (tag ${tagFor[family]}) never appeared`).toBe(true);
    }
  });

  it("ramps difficulty: later items draw from a strictly wider family pool than early items", () => {
    // Not a statement about any one paper (a single early item can still land on a hard family by
    // chance) but about the pool itself: tier 4 offers every family tier 0 does, plus more.
    const rng = seededRng(9001);
    const earlyTags = new Set<string>();
    const lateTags = new Set<string>();
    for (let i = 0; i < 400; i++) earlyTags.add(draftForTier(rng, 0).tag);
    for (let i = 0; i < 400; i++) lateTags.add(draftForTier(rng, 4).tag);
    expect(lateTags.size).toBeGreaterThan(earlyTags.size);
    for (const tag of earlyTags) expect(lateTags.has(tag)).toBe(true);
  });
});

describe("ambiguity verifier rejection rate", () => {
  it("measures and bounds how often a raw draft gets thrown away", () => {
    const rng = seededRng(555);
    let attempts = 0;
    let rejectedAmbiguous = 0;
    let rejectedMagnitude = 0;
    for (let i = 0; i < 6000; i++) {
      const tier = i % 5;
      const draft = draftForTier(rng, tier);
      attempts++;
      if (!withinMagnitudeGuard(draft)) {
        rejectedMagnitude++;
        continue;
      }
      const prefix = draft.terms.slice(0, -1);
      const next = draft.terms[draft.terms.length - 1];
      const ambiguous =
        draft.kind === "letters"
          ? checkAmbiguityLetters(prefix as string[], next as string, draft.intendedComplexity).ambiguous
          : checkAmbiguityNumeric(prefix as number[], next as number, draft.intendedComplexity).ambiguous;
      if (ambiguous) rejectedAmbiguous++;
    }
    const rejectionRate = (rejectedAmbiguous + rejectedMagnitude) / attempts;
    console.log(
      `sequences verifier: ${rejectedAmbiguous}/${attempts} ambiguous, ${rejectedMagnitude}/${attempts} oversized ` +
        `(${(rejectionRate * 100).toFixed(1)}% total rejection rate)`,
    );
    // Sanity ceiling, not a target: guards against a future change making the ramp so aggressive
    // that most drafts get thrown away (which would blow the retry budget on real papers).
    expect(rejectionRate).toBeLessThan(0.5);
  });
});
