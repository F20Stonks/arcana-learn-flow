/**
 * Jane Street.
 *
 * The first-round online screen opens with a timed mental-math battery before the puzzle and
 * probability rounds that follow later in the process. Only the mental-math battery is
 * implemented here.
 */
import type { FirmSpec } from "../types";
import { arithmeticModule, JANE_STREET_PROFILE } from "../modules/arithmetic";

export const janeStreet: FirmSpec = {
  id: "jane-street",
  name: "Jane Street",
  blurb:
    "Sixty mental-math questions in eight minutes, weighted toward multiplication, division, decimals and percentages — light on plain addition.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026. Jane Street's broader process also includes puzzle and " +
    "probability rounds and, later, in-person trading/interview math — none of that is part of " +
    "this speed-arithmetic module.",
  specVersion: 1,
  modules: [
    arithmeticModule({
      id: "mental-math",
      name: "Mental Math",
      blurb: "Sixty mental-arithmetic questions in eight minutes.",
      itemCount: 60,
      durationS: 480,
      profile: JANE_STREET_PROFILE,
      negativeMarking: true,
      allowSkip: false,
      // Candidate reports converge on roughly three-quarters as a competitive raw score.
      passMark: 45,
    }),
  ],
};
