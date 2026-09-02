/**
 * All Options.
 *
 * A market maker whose reported first screen is an 80-question, 8-minute math test — the same
 * shape as Optiver's 80-in-8, and candidate reports don't describe a distinct operation mix, so
 * this reuses that mix under its own profile id (see modules/arithmetic/profiles.ts).
 */
import type { FirmSpec } from "../types";
import { arithmeticModule, ALL_OPTIONS_PROFILE } from "../modules/arithmetic";

export const allOptions: FirmSpec = {
  id: "all-options",
  name: "All Options",
  blurb: "Eighty arithmetic questions in eight minutes, in the same mold as Optiver's 80-in-8.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026, describe the same format as Optiver's 80-in-8 without a " +
    "reported difference in operation mix — this module reuses that mix under its own id so it " +
    "can still be filtered as its own source set.",
  specVersion: 1,
  modules: [
    arithmeticModule({
      id: "math-test",
      name: "Math Test",
      blurb: "Eighty arithmetic questions in eight minutes.",
      itemCount: 80,
      durationS: 480,
      profile: ALL_OPTIONS_PROFILE,
      negativeMarking: true,
      allowSkip: false,
      // Mirrors Optiver's ~60% competitive bar on the same 80-question, +1/−1 shape.
      passMark: 48,
    }),
  ],
};
