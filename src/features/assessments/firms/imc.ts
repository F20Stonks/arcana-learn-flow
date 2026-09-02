/**
 * IMC Trading.
 *
 * Only IMC's mental-math module is implemented here — the probability screen ships separately.
 */
import type { FirmSpec } from "../types";
import { arithmeticModule, IMC_PROFILE } from "../modules/arithmetic";

export const imc: FirmSpec = {
  id: "imc",
  name: "IMC Trading",
  blurb:
    "Sixty mental-math questions in ten minutes, no penalty for a wrong or skipped answer — heaviest on two-digit multiplication and percentages.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026. IMC's full first screen also runs the BrainsFirst " +
    "NeurOlympics game battery and a separate, longer quantitative-reasoning test; neither is " +
    "built here — this module covers only the timed mental-math section.",
  specVersion: 1,
  modules: [
    arithmeticModule({
      id: "mental-math",
      name: "Mental Math",
      blurb: "Sixty mental-arithmetic questions in ten minutes.",
      itemCount: 60,
      durationS: 600,
      profile: IMC_PROFILE,
      // IMC's reported marking is +1 for correct, 0 for wrong or blank — no penalty.
      negativeMarking: false,
      allowSkip: false,
      // ~65-70% is the figure candidate reports converge on for a competitive score.
      passMark: 40,
    }),
  ],
};
