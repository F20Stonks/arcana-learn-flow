/**
 * The number-sequences module, as a ModuleSpec factory.
 *
 * Three firms run this test — Optiver's NumberLogic, Flow Traders' Sequences, Akuna's Sequences —
 * and they differ only in item count and clock, so a firm file is one call to this, not a new
 * module. Input is always `typed-text`: Akuna's occasionally uses letters (see families.ts's
 * `draftLetters`), so the answer isn't always a number.
 *
 * The hard part isn't the generators, it's making sure a generated item has exactly one defensible
 * next term — see fitters.ts and verifier.ts for the ambiguity verifier every drafted item has to
 * clear before it's shown to a candidate.
 */
import type { ModuleSpec } from "../../types";
import { generateSequenceItem } from "./generate";

export interface SequencesModuleArgs {
  id: string;
  name: string;
  blurb: string;
  itemCount: number;
  durationS: number;
  negativeMarking: boolean;
  allowSkip: boolean;
  /**
   * Must be honest about what the engine does. The instruction screen is a promise: saying a
   * candidate may "come back to it" while allowBack is false teaches them to bank questions they
   * can never return to, which is worse than not offering the skip at all.
   */
  allowBack: boolean;
  passMark: number | null;
  /** Extra lines appended to the standard rule set — anything specific to this firm. */
  extraRules?: string[];
}

export function sequencesModule(args: SequencesModuleArgs): ModuleSpec {
  const seconds = (args.durationS / args.itemCount).toFixed(1);

  return {
    id: args.id,
    name: args.name,
    kind: "sequences",
    blurb: args.blurb,
    rules: [
      `${args.itemCount} questions in ${Math.round(args.durationS / 60)} minutes — about ${seconds} seconds each.`,
      args.negativeMarking
        ? "A correct answer scores +1. A wrong answer scores −1. An unanswered question scores 0."
        : "A correct answer scores +1. Wrong and unanswered questions score 0.",
      args.allowSkip && args.allowBack
        ? "You may skip a question and come back to it later."
        : args.allowSkip
          ? "You may skip a question, but you cannot go back to it."
          : "You cannot skip a question, and you cannot go back to one you have answered.",
      "You'll see a sequence with a missing final term — type what comes next.",
      "No calculator. Pen and paper are fine.",
      "The clock does not stop once you begin.",
      ...(args.extraRules ?? []),
    ],
    itemCount: args.itemCount,
    durationS: args.durationS,
    perItemMs: null,
    input: "typed-text",
    negativeMarking: args.negativeMarking,
    allowSkip: args.allowSkip,
    allowBack: args.allowBack,
    calculator: false,
    passMark: args.passMark,
    generate: ({ rng, index, count }) => generateSequenceItem(rng, index, count),
  };
}

export { draftForTier, tierForIndex, type Draft, type FamilyId } from "./families";
export { checkAmbiguityLetters, checkAmbiguityNumeric, type AmbiguityResult } from "./verifier";
export { runFitters, complexityScore, type Fit } from "./fitters";
