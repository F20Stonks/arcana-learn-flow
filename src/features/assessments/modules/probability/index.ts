/**
 * The probability & expected-value module, as a ModuleSpec factory — mirrors
 * modules/arithmetic/index.ts's arithmeticModule: one engine, and a firm is a profile (which
 * templates are enabled, and at what relative weight) plus a clock and marking config over it.
 *
 * Supports both clock modes a ModuleSpec allows: pass `durationS` for a whole-section clock (every
 * firm wired so far uses this) or `perItemMs` for a per-item clock (e.g. Optiver's probability
 * round runs ~90s/question — this factory is ready for that even though optiver.ts, owned by
 * another agent, doesn't use it yet).
 */
import type { GenerateArgs, ItemInputKind, ModuleSpec } from "../../types";
import { generateProbabilityItem } from "./generate";
import type { ProbabilityProfile } from "./profiles";

export {
  CITADEL_PROFILE,
  DRW_PROFILE,
  SIG_PROFILE,
  GRESEARCH_PROFILE,
  PROBABILITY_PROFILES,
} from "./profiles";
export type { ProbabilityProfile } from "./profiles";
export { generateProbabilityItem } from "./generate";
export { PROB_TEMPLATES, PROB_TEMPLATE_LIST } from "./templates";
export type { ProbTemplateId, ProbTemplate } from "./templates";

export interface ProbabilityModuleArgs {
  id: string;
  name: string;
  blurb: string;
  itemCount: number;
  profile: ProbabilityProfile;
  /** 4 for most firms, 5 for G-Research. */
  optionsCount: number;
  negativeMarking: boolean;
  allowSkip: boolean;
  allowBack: boolean;
  passMark: number | null;
  /** Whole-section clock in seconds. Exactly one of durationS / perItemMs should be set. */
  durationS?: number | null;
  /** Per-item clock in ms. Exactly one of durationS / perItemMs should be set. */
  perItemMs?: number | null;
  calculator?: boolean;
  /** Extra lines appended to the standard rule set — anything specific to this firm. */
  extraRules?: string[];
}

const CHOICE_INPUT: ItemInputKind = "choice";

export function probabilityModule(args: ProbabilityModuleArgs): ModuleSpec {
  const durationS = args.durationS ?? null;
  const perItemMs = args.perItemMs ?? null;
  if (durationS === null && perItemMs === null) {
    throw new Error(`probability module "${args.id}" needs a durationS or a perItemMs clock`);
  }

  const timingRule =
    durationS !== null
      ? `${args.itemCount} questions in ${Math.round(durationS / 60)} minutes.`
      : `${args.itemCount} questions, ${Math.round((perItemMs as number) / 1000)} seconds each.`;

  // The instruction screen is a promise the engine has to keep. Getting these two the wrong way
  // round told a DRW/SIG/G-Research candidate they could come back to a skipped question when
  // allowBack was false — which teaches them to bank questions they can never return to, and costs
  // more marks than not offering the skip at all.
  const skipRule = args.allowSkip
    ? args.allowBack
      ? "You may skip a question and come back to it later — the section can be answered in any order."
      : "You may skip a question, but you cannot go back to it."
    : "You cannot skip a question, and you cannot go back to one you have already answered.";

  return {
    id: args.id,
    name: args.name,
    kind: "probability",
    blurb: args.blurb,
    rules: [
      timingRule,
      args.negativeMarking
        ? "A correct answer scores +1. A wrong answer scores −1. An unanswered question scores 0."
        : "A correct answer scores +1. Wrong and unanswered questions score 0.",
      skipRule,
      `Each question offers ${args.optionsCount} choices; exactly one is correct.`,
      args.calculator ? "A calculator is permitted." : "No calculator. Pen and paper are fine.",
      "The clock does not stop once you begin.",
      ...(args.extraRules ?? []),
    ],
    itemCount: args.itemCount,
    durationS,
    perItemMs,
    input: CHOICE_INPUT,
    negativeMarking: args.negativeMarking,
    allowSkip: args.allowSkip,
    allowBack: args.allowBack,
    calculator: args.calculator ?? false,
    passMark: args.passMark,
    generate: ({ rng, index }: GenerateArgs) =>
      generateProbabilityItem(rng, index, { profile: args.profile, optionsCount: args.optionsCount }),
  };
}
