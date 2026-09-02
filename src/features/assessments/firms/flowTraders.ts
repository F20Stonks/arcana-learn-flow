/**
 * Flow Traders.
 *
 * The distinguishing feature of this one: it's multiple choice, not typed — see
 * modules/arithmetic/distractors.ts for how the three wrong options are built.
 */
import type { FirmSpec } from "../types";
import { arithmeticModule, FLOW_TRADERS_PROFILE } from "../modules/arithmetic";

export const flowTraders: FirmSpec = {
  id: "flow-traders",
  name: "Flow Traders",
  blurb:
    "Sixty multiple-choice arithmetic questions in six minutes — integers, decimals and fractions, four options per question.",
  lastVerified: "2026-09-02",
  sourceNote:
    "Candidate reports, September 2026. Flow Traders' widely-quoted '72' passing figure is on the " +
    "firm's own internal/composite scale, not on this module's correct-minus-wrong-out-of-60 raw " +
    "score, so it is not portable as-is — see the passMark comment below for the judgement call " +
    "made instead. Flow Traders' full screen also runs a separate timed number-sequences test; " +
    "that module is not built here.",
  specVersion: 1,
  modules: [
    arithmeticModule({
      id: "math-test",
      name: "Math Test",
      blurb: "Sixty multiple-choice arithmetic questions in six minutes.",
      itemCount: 60,
      durationS: 360,
      profile: FLOW_TRADERS_PROFILE,
      negativeMarking: true,
      allowSkip: false,
      input: "choice",
      // JUDGEMENT CALL, flag for owner review: the "72" candidates report is not on our scale —
      // it reads like a percentile or composite figure from Flow Traders' own scoring, not a raw
      // correct-minus-wrong count out of 60 under +1/−1 marking. Rather than copy "72" across
      // scales silently (impossible anyway — it would exceed a perfect score of 60), this uses
      // the same ~60% net-of-negative-marking bar that candidate reports converge on for the
      // other four-option-free batteries here (Optiver's 48/80, All Options' 48/80), scaled to
      // this module's 60-item length: 60 * 0.6 = 36. Revisit if a raw Flow Traders score on this
      // exact 60-item/+1-−1/four-option shape ever surfaces.
      passMark: 36,
    }),
  ],
};
