/**
 * Jane Street.
 *
 * The first-round online screen opens with a timed mental-math battery before the puzzle and
 * probability rounds that follow later in the process. Only the mental-math battery is
 * implemented here.
 */
import type { FirmSpec } from "../types";
import { arithmeticModule, JANE_STREET_PROFILE } from "../modules/arithmetic";
import { marketMakingModule } from "../modules/marketMaking";
import { COIN_FAIR } from "../modules/marketMaking/contracts";
import { DEFAULT_BOT_CONFIG } from "../modules/marketMaking/bot";

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
    marketMakingModule({
      id: "market-making",
      name: "Market Making",
      blurb: "Quote a two-sided market on the coin-settled contract, against a live counterparty.",
      contract: COIN_FAIR,
      bot: DEFAULT_BOT_CONFIG,
      durationS: 600,
      // An interview round, not part of the online screen — said out loud so the battery does not
      // misrepresent what a candidate actually sits at the OA stage.
      extraRules: [
        "This is an interview round rather than part of the online assessment.",
        "Jane Street's published version of this game: the contract settles at 100 on heads and 0 on tails, so fair value starts at 50.",
      ],
    }),
  ],
};
