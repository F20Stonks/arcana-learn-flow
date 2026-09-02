/**
 * The market-making module, as a ModuleSpec factory — mirrors modules/sequences/index.ts's
 * pattern, with one structural difference forced by the game itself: this factory always produces
 * exactly ONE item (`itemCount: 1`). A market-making session is a single multi-round quoting
 * conversation with the bot, not a sequence of independent questions, so the round-by-round loop
 * lives entirely inside useMarketMakingGame.ts / MarketMakingGame.tsx — the shared battery engine
 * (useAssessmentRun.ts) only ever sees this one item generated, and one string submitted, at the
 * very end. That is exactly what types.ts's own doc comment describes `input: "custom"` for:
 * "the escape hatch for modules that own their whole interaction surface ... and report a score
 * rather than a per-item string."
 *
 * See MarketMakingGame.tsx's top comment and this repo's PR description for the ItemRenderer.tsx
 * wiring this needs on the consuming side — that file is out of this module's edit scope, so the
 * one small branch it needs is a snippet for whoever wires a firm to this module, not code here.
 */
import type { AssessmentItem, GenerateArgs, ModuleSpec } from "../../types";
import type { BotConfig, ContractConfig, MarketMakingScorecard } from "./types";

export interface MarketMakingModuleArgs {
  id: string;
  name: string;
  blurb: string;
  contract: ContractConfig;
  bot: BotConfig;
  /** Whole-session clock in seconds. Covers every round of the one game this module runs — there
   * is no per-item clock, because there is only ever one item. */
  durationS: number;
  /** No firm has published a raw competitive bar for a market-making round the way they do for
   * the speed batteries, so this is null unless the caller has real data. */
  passMark?: number | null;
  extraRules?: string[];
}

/** What `generate()` stores on `item.meta` — everything MarketMakingGame.tsx needs to rebuild the
 * exact same game via engine.ts's `buildGame`, and nothing that can't survive JSON. */
export interface MarketMakingItemMeta {
  seed: number;
  contract: ContractConfig;
  bot: BotConfig;
}

/** The payload MarketMakingGame.tsx submits once, when the candidate clicks through its own
 * end-of-game summary screen. Kept intentionally small — the rich scorecard lives in the UI the
 * candidate actually saw; this is only what the shared engine needs to grade the item. */
export interface MarketMakingSubmission {
  skillPnl: number;
  candidatePnl: number;
  benchmarkPnl: number;
}

export function parseSubmission(raw: string): MarketMakingSubmission | null {
  try {
    const parsed = JSON.parse(raw) as Partial<MarketMakingSubmission>;
    if (typeof parsed.skillPnl !== "number" || !Number.isFinite(parsed.skillPnl)) return null;
    return {
      skillPnl: parsed.skillPnl,
      candidatePnl: typeof parsed.candidatePnl === "number" ? parsed.candidatePnl : 0,
      benchmarkPnl: typeof parsed.benchmarkPnl === "number" ? parsed.benchmarkPnl : 0,
    };
  } catch {
    return null;
  }
}

export function submissionOf(scorecard: MarketMakingScorecard): string {
  const payload: MarketMakingSubmission = {
    skillPnl: scorecard.skillPnl,
    candidatePnl: scorecard.candidatePnl,
    benchmarkPnl: scorecard.benchmarkPnl,
  };
  return JSON.stringify(payload);
}

/** The canonical "answer" for this item: a submission that exactly replicates the benchmark
 * (skillPnl 0). Exists so `check(item, item.answer)` is meaningfully true, matching the invariant
 * every other module's generator satisfies (see firms.test.ts's "marks its own correct answer as
 * correct") even though this module isn't wired into a firm and that test doesn't run against it
 * yet. */
const CANONICAL_ANSWER: MarketMakingSubmission = { skillPnl: 0, candidatePnl: 0, benchmarkPnl: 0 };

export function marketMakingModule(args: MarketMakingModuleArgs): ModuleSpec {
  return {
    id: args.id,
    name: args.name,
    kind: "market-making",
    blurb: args.blurb,
    rules: [
      "One live market-making session: no separate questions, nothing to skip, and nothing to come back to.",
      "Each round you quote a two-sided market — a bid and an ask — for the contract described on screen.",
      "A simulated counterparty trades against you when your quote is priced away from fair value, in a fixed size.",
      "New information about the contract is revealed between rounds. Requote after each reveal.",
      "You will not see your running P&L during the session — only at the end, once the contract has settled.",
      "No calculator restriction — work the conditional expectation out however you like.",
      "The clock does not stop once you begin.",
      ...(args.extraRules ?? []),
    ],
    itemCount: 1,
    durationS: args.durationS,
    perItemMs: null,
    input: "custom",
    negativeMarking: false,
    allowSkip: false,
    allowBack: false,
    calculator: true,
    interviewRound: true,
    passMark: args.passMark ?? null,
    generate: ({ rng }: GenerateArgs): AssessmentItem => {
      // A single stored seed, not a live rng closure, so the item survives serialization and a
      // remount reconstructs byte-identical game state — the same reason useAssessmentRun.ts's
      // buildSection generates a whole section's items from one seed up front.
      const seed = Math.floor(rng() * 2 ** 31);
      const meta: MarketMakingItemMeta = { seed, contract: args.contract, bot: args.bot };
      return {
        id: `mm-${args.id}-${seed}`,
        tag: `mm_${args.contract.kind}`,
        prompt: "Quote a two-sided market for the contract described below.",
        answer: JSON.stringify(CANONICAL_ANSWER),
        meta: meta as unknown as Record<string, unknown>,
      };
    },
    check: (_item, raw) => {
      const submission = parseSubmission(raw);
      // "Correct" here means the candidate's OWN P&L beat the benchmark's — i.e. they added skill
      // on top of the settlement draw's own luck, not merely that they avoided a loss. This is a
      // single bit squeezed out of a genuinely multi-dimensional scorecard (see scoring.ts) purely
      // so SectionResult.rawScore has something coherent to report; the real result is whatever
      // MarketMakingGame.tsx showed the candidate directly.
      return submission !== null && submission.skillPnl >= 0;
    },
  };
}

export type { MarketMakingModuleArgs as MarketMakingArgs };
