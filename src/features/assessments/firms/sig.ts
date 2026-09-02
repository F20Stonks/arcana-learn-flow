/**
 * SIG.
 *
 * The reported Quantitative Evaluation leans on classic "trader interview" brainteasers —
 * combinatorics, waiting times, gambler's ruin, Markov chains, the birthday problem, and the Bayes
 * base-rate trap — so those templates carry the most weight here. SIG's real assessment is also
 * reported to test options basics (call/put payoffs, put-call parity) and simplified game theory;
 * those are intentionally NOT included — see sourceNote.
 */
import type { FirmSpec } from "../types";
import { probabilityModule, SIG_PROFILE } from "../modules/probability";

export const sig: FirmSpec = {
  id: "sig",
  name: "SIG",
  blurb: "Sixteen logic-and-brainteaser-flavoured probability questions in 20 minutes.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026. SIG's Quantitative Evaluation is reported as roughly 16 questions in 20 minutes, weighted toward classic brainteasers (combinatorics, waiting times, gambler's ruin, Markov chains, the birthday problem, Bayesian base rates). SIG's real assessment also reportedly covers options basics (call/put payoffs, put-call parity) and simplified game theory — those are deliberately omitted here because they could not be verified to the same machine-checked standard as the probability content, rather than shipped unverified.",
  specVersion: 1,
  modules: [
    probabilityModule({
      id: "quantitative-evaluation",
      name: "Quantitative Evaluation",
      blurb: "Sixteen logic-and-brainteaser-flavoured probability questions.",
      itemCount: 16,
      durationS: 1200,
      profile: SIG_PROFILE,
      optionsCount: 4,
      negativeMarking: false,
      allowSkip: true,
      allowBack: false,
      passMark: null,
    }),
  ],
};
