/**
 * G-Research.
 *
 * The reported Quant Quiz spans probability, statistics (including OLS), linear algebra and
 * calculus over roughly 90 minutes; this module covers the probability and expected-value portion
 * only. Ten questions in 90 minutes means items are long and multi-step, so — like DRW — the easy
 * single-formula templates are switched off here too.
 */
import type { FirmSpec } from "../types";
import { probabilityModule, GRESEARCH_PROFILE } from "../modules/probability";

export const gResearch: FirmSpec = {
  id: "g-research",
  name: "G-Research",
  blurb: "Ten genuinely long probability and expected-value questions in 90 minutes, five options each.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026. G-Research's Quant Quiz is reported to cover probability, statistics (including OLS), linear algebra and calculus across roughly 90 minutes; this module implements the probability and expected-value portion only. Ninety minutes for ten questions implies long, multi-step items, so easy single-formula templates are disabled. G-Research is also reported to track browser tab-switching during the assessment — the engine already counts this independently of any module (RunResult.tabBlurCount), so no extra plumbing is needed here.",
  specVersion: 1,
  modules: [
    probabilityModule({
      id: "quant-quiz",
      name: "Quant Quiz",
      blurb: "Ten long-form probability and expected-value questions.",
      itemCount: 10,
      durationS: 5400,
      profile: GRESEARCH_PROFILE,
      optionsCount: 5,
      negativeMarking: false,
      allowSkip: true,
      allowBack: false,
      passMark: null,
    }),
  ],
};
