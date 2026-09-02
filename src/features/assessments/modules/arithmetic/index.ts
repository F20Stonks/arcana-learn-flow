/**
 * The speed-arithmetic module, as a ModuleSpec factory.
 *
 * Six firms run this test — Optiver, Akuna, Jane Street, Flow Traders, All Options and IMC — and
 * they differ only in item count, clock, operation mix and whether the answer is typed or picked
 * from four options. So a firm file is one call to this, not a new module.
 */
import type { ModuleSpec } from "../../types";
import { generateArithmeticItem } from "./generate";
import type { ArithmeticProfile } from "./profiles";

export { ARITHMETIC_PROFILES, OPTIVER_PROFILE } from "./profiles";
export type { ArithmeticOp, ArithmeticProfile } from "./profiles";
export { generateArithmeticItem } from "./generate";

export interface ArithmeticModuleArgs {
  id: string;
  name: string;
  blurb: string;
  itemCount: number;
  durationS: number;
  profile: ArithmeticProfile;
  negativeMarking: boolean;
  allowSkip: boolean;
  passMark: number | null;
  /** Extra lines appended to the standard rule set — anything specific to this firm. */
  extraRules?: string[];
}

export function arithmeticModule(args: ArithmeticModuleArgs): ModuleSpec {
  const seconds = (args.durationS / args.itemCount).toFixed(1);

  return {
    id: args.id,
    name: args.name,
    kind: "arithmetic",
    blurb: args.blurb,
    rules: [
      `${args.itemCount} questions in ${Math.round(args.durationS / 60)} minutes — about ${seconds} seconds each.`,
      args.negativeMarking
        ? "A correct answer scores +1. A wrong answer scores −1. An unanswered question scores 0."
        : "A correct answer scores +1. Wrong and unanswered questions score 0.",
      args.allowSkip
        ? "You may skip a question and come back to it."
        : "You cannot skip a question, and you cannot go back to one you have answered.",
      "No calculator. Pen and paper are fine.",
      "The clock does not stop once you begin.",
      ...(args.extraRules ?? []),
    ],
    itemCount: args.itemCount,
    durationS: args.durationS,
    perItemMs: null,
    input: "typed-number",
    negativeMarking: args.negativeMarking,
    allowSkip: args.allowSkip,
    allowBack: false,
    calculator: false,
    passMark: args.passMark,
    generate: ({ rng, index }) => generateArithmeticItem(rng, index, { profile: args.profile }),
  };
}
