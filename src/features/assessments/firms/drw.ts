/**
 * DRW.
 *
 * Six questions in 45 minutes — about 7.5 minutes each — is not a speed round, so the profile
 * switches off the module's quick single-formula templates entirely and weights the multi-step
 * derivations (Bayes, gambler's ruin, Markov chains, waiting times) above the rest.
 */
import type { FirmSpec } from "../types";
import { probabilityModule, DRW_PROFILE } from "../modules/probability";

export const drw: FirmSpec = {
  id: "drw",
  name: "DRW",
  blurb: "Six deliberately hard, multi-step probability questions in 45 minutes — no filler, no quick warm-ups.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026. DRW's online assessment is reported as six questions in 45 minutes. That pace implies real multi-step problems rather than one-line formulas, so this module's easy templates are disabled and the hardest (Bayes, gambler's ruin, Markov absorption, waiting-time recursions) are weighted highest.",
  specVersion: 1,
  modules: [
    probabilityModule({
      id: "online-assessment",
      name: "Online Assessment",
      blurb: "Six long-form, multi-step probability questions.",
      itemCount: 6,
      durationS: 2700,
      profile: DRW_PROFILE,
      optionsCount: 4,
      negativeMarking: false,
      allowSkip: true,
      allowBack: false,
      passMark: null,
    }),
  ],
};
