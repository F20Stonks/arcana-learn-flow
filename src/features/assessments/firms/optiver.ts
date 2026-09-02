/**
 * Optiver.
 *
 * The full battery is five modules — 80 in 8, NumberLogic, Beat the Odds, Zap-N and an untimed
 * personality section. Only the first is implemented here; the rest arrive with their module
 * engines and slot into `modules` in the order a candidate actually sits them.
 */
import type { FirmSpec } from "../types";
import { arithmeticModule, OPTIVER_PROFILE } from "../modules/arithmetic";
import { sequencesModule } from "../modules/sequences";

export const optiver: FirmSpec = {
  id: "optiver",
  name: "Optiver",
  blurb:
    "The tightest first screen anyone sets: eighty arithmetic questions in eight minutes, marked +1 / −1, with no skipping and no calculator.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026. Optiver's battery also includes NumberLogic (26 sequences / 25 min), Beat the Odds (~90s per probability question), the nine Zap-N mini-games and an untimed personality section.",
  specVersion: 1,
  modules: [
    arithmeticModule({
      id: "80-in-8",
      name: "80 in 8",
      blurb: "Eighty mental-arithmetic questions in eight minutes.",
      itemCount: 80,
      durationS: 480,
      profile: OPTIVER_PROFILE,
      negativeMarking: true,
      allowSkip: false,
      // ~60% is the figure candidate reports converge on for a competitive score.
      passMark: 48,
    }),
    sequencesModule({
      id: "numberlogic",
      name: "NumberLogic",
      blurb: "Twenty-six number sequences, ramping in difficulty, in twenty-five minutes.",
      itemCount: 26,
      durationS: 1500,
      negativeMarking: false,
      allowSkip: true,
      allowBack: true,
      // No reliable published bar for the sequences papers, so none is invented.
      passMark: null,
    }),
  ],
};
