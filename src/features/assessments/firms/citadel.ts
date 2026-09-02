/**
 * Citadel Securities.
 *
 * The reported first-round online assessment is a probability / quantitative-reasoning screen
 * that, unusually among these four, can be answered and revisited in any order within its window.
 */
import type { FirmSpec } from "../types";
import { probabilityModule, CITADEL_PROFILE } from "../modules/probability";

export const citadel: FirmSpec = {
  id: "citadel",
  name: "Citadel Securities",
  blurb: "A 15-question probability and expected-value screen, answerable in any order with no penalty for a wrong guess.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026. Citadel Securities' first-round online assessment is reported as a 30-minute, 15-question probability and quantitative-reasoning battery that can be skipped and revisited in any order within the section.",
  specVersion: 1,
  modules: [
    probabilityModule({
      id: "online-assessment",
      name: "Online Assessment",
      blurb: "Fifteen probability and expected-value questions, answerable in any order.",
      itemCount: 15,
      durationS: 1800,
      profile: CITADEL_PROFILE,
      optionsCount: 4,
      negativeMarking: false,
      allowSkip: true,
      allowBack: true,
      passMark: null,
    }),
  ],
};
