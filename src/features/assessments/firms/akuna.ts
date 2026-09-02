/**
 * Akuna Capital.
 *
 * The first screen is an 80-question, 8-minute math test alongside a separate sequences test.
 * Only the math test is implemented here.
 */
import type { FirmSpec } from "../types";
import { arithmeticModule, AKUNA_PROFILE } from "../modules/arithmetic";

export const akuna: FirmSpec = {
  id: "akuna",
  name: "Akuna Capital",
  blurb:
    "Eighty arithmetic questions in eight minutes, noticeably heavier on division and fractions than Optiver's version of the same format.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026. Akuna's real battery also runs a separate timed number- " +
    "sequences test alongside this one; that module is not built here.",
  specVersion: 1,
  modules: [
    arithmeticModule({
      id: "math-test",
      name: "Math Test",
      blurb: "Eighty arithmetic questions in eight minutes.",
      itemCount: 80,
      durationS: 480,
      profile: AKUNA_PROFILE,
      negativeMarking: true,
      allowSkip: false,
      // ~85-90% is the figure candidate reports converge on for a competitive score.
      passMark: 70,
    }),
  ],
};
