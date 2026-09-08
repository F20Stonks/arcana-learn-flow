/**
 * Drills — one question kind, on repeat, without a whole paper around it.
 *
 * A candidate who loses the arithmetic section of an eighty-question paper should not have to sit
 * eighty questions again to work on it. A drill is the same generators and the same grader with
 * the paper stripped away: pick a kind, pick how hard, pick whether the clock is on, and go.
 *
 * The clock is optional here and only here. In a real sitting it is the point; while you are still
 * learning what a question type even asks, it is just noise.
 */
import type { QuestionKind } from "./types";

export interface DrillConfig {
  kind: QuestionKind;
  level: number;
  count: number;
  /** Seconds for the whole set, or null to work untimed. */
  seconds: number | null;
}

export const DRILL_LENGTHS = [10, 20, 40] as const;

export interface KindInfo {
  kind: QuestionKind;
  name: string;
  /** What this kind is, and which firms lean on it. */
  blurb: string;
  /** Seconds a real screen tends to allow per question of this kind. */
  pace: number;
}

export const KINDS: KindInfo[] = [
  {
    kind: "arithmetic",
    name: "Mental arithmetic",
    blurb: "The 80-in-8 blend: tables, decimals, percentages, and the ÷0.25 tricks underneath them. Optiver, IMC, Flow.",
    pace: 6,
  },
  {
    kind: "sequence",
    name: "Sequences",
    blurb: "One rule fits the terms shown; find it. SIG and Jump lean hardest on these.",
    pace: 30,
  },
  {
    kind: "probability",
    name: "Probability",
    blurb: "Dice, coins, cards, urns — exact discrete probability. Turns up almost everywhere.",
    pace: 55,
  },
  {
    kind: "expected-value",
    name: "Expected value",
    blurb: "What is this game worth, and would you play it? The question trading firms actually care about.",
    pace: 65,
  },
  {
    kind: "market-making",
    name: "Market making",
    blurb: "Quotes, fills and what you own afterwards, posed in desk language.",
    pace: 50,
  },
  {
    kind: "options",
    name: "Options",
    blurb: "Payoffs, put-call parity, spreads, breakevens. Akuna, Wolverine, Group One, CTC.",
    pace: 60,
  },
  {
    kind: "estimation",
    name: "Estimation",
    blurb: "Close beats exact — anything within 10% counts. Jane Street's house skill.",
    pace: 45,
  },
  {
    kind: "logic",
    name: "Deduction",
    blurb: "Short puzzles with one forced answer. Counting, ordering, rates.",
    pace: 50,
  },
  {
    kind: "zap",
    name: "Grid scanning",
    blurb: "Find it in the grid before you have finished thinking about it. Optiver's zap round.",
    pace: 13,
  },
];

export const KIND_BY_ID: Record<QuestionKind, KindInfo> = Object.fromEntries(
  KINDS.map((k) => [k.kind, k]),
) as Record<QuestionKind, KindInfo>;

/** A drill's clock, when it has one: the kind's real pace, times the number of questions. */
export function drillSeconds(config: Omit<DrillConfig, "seconds">): number {
  return KIND_BY_ID[config.kind].pace * config.count;
}

const DEFAULTS: DrillConfig = { kind: "arithmetic", level: 3, count: 20, seconds: null };

export function parseDrill(params: URLSearchParams): DrillConfig {
  const kind = KINDS.find((k) => k.kind === params.get("kind"))?.kind ?? DEFAULTS.kind;
  const level = Number(params.get("level"));
  const count = Number(params.get("count"));
  return {
    kind,
    level: level >= 1 && level <= 5 ? level : DEFAULTS.level,
    count: (DRILL_LENGTHS as readonly number[]).includes(count) ? count : DEFAULTS.count,
    seconds: params.get("timed") === "1" ? drillSeconds({ kind, level: 3, count: count || 20 }) : null,
  };
}

export function drillToQuery(config: DrillConfig): string {
  const params = new URLSearchParams({
    kind: config.kind,
    level: String(config.level),
    count: String(config.count),
  });
  if (config.seconds !== null) params.set("timed", "1");
  return `?${params.toString()}`;
}
