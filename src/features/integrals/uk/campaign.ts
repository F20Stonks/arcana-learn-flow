/**
 * The campaign — a dated training track, counted back from competition day.
 *
 * The burst that preceded this built five good components: paper mode, the adaptive scheduler, the
 * error taxonomy, the recognition drill and the values deck. What it did not build is the thing
 * that decides which of them today calls for. Without that, the training programme lives in a
 * document a solo competitor has to self-administer daily for ten weeks, and adherence — not
 * capability — becomes the thing that fails.
 *
 * This module is pure: dates in, a session plan out. Persistence lives in campaignStore.ts and the
 * UI in pages/IntegralCampaign.tsx, so every rule here is testable without a browser or a clock.
 *
 * Blocks are derived *backwards* from the target date rather than pinned to calendar dates. That
 * matters because the UK bee's Round 1 is hosted per-university on a date the competitor confirms
 * themselves — a plan hardcoded to one November Saturday would silently mis-phase for everyone
 * else, and would rot the moment the date moved.
 */
import type { Difficulty } from "../types";

/**
 * Assumed Round 1, pending confirmation from the host university. Early November, host-dependent.
 * Every consumer treats this as a default the competitor overrides, never as a fact.
 */
export const DEFAULT_TARGET_DATE = "2026-11-07";

export type BlockId = "breadth" | "depth" | "taper";

export interface Block {
  id: BlockId;
  name: string;
  /** One line, shown on the campaign card — what this block is *for*. */
  aim: string;
  /** Inclusive lower bound on days remaining. The upper bound is the next block's floor. */
  fromDaysOut: number;
}

/**
 * Counted back from competition day: the last fortnight tapers, the four weeks before that build
 * the hard tail, and everything earlier is breadth. Ordered furthest-out first.
 */
export const BLOCKS: Block[] = [
  {
    id: "breadth",
    name: "Breadth",
    aim: "Leave no technique you cannot start. Volume over difficulty.",
    fromDaysOut: 42,
  },
  {
    id: "depth",
    name: "Depth and the tail",
    aim: "Live above the qualifier, so the qualifier stops being the hard part.",
    fromDaysOut: 14,
  },
  {
    id: "taper",
    name: "Sharpen and taper",
    aim: "Consolidate, rehearse the format, arrive fresh. No new material.",
    fromDaysOut: 0,
  },
];

export const BLOCK_BY_ID: Record<BlockId, Block> = Object.fromEntries(
  BLOCKS.map((b) => [b.id, b]),
) as Record<BlockId, Block>;

/** Local midnight, so "days remaining" flips at the competitor's midnight rather than at UTC's. */
function midnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Parsed as a local date, not UTC — `new Date("2026-11-07")` would be UTC midnight and can land
 *  on the previous day for anyone west of Greenwich. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Whole days from `today` to the target. 0 is competition day; negative means it has passed. */
export function daysUntil(targetDate: string, today = new Date()): number {
  return Math.round((midnight(parseDate(targetDate)) - midnight(today)) / 86_400_000);
}

/** Which block a given distance-out falls in. Past the date, the campaign is over, not tapering. */
export function blockFor(daysRemaining: number): Block {
  for (const b of BLOCKS) if (daysRemaining >= b.fromDaysOut) return b;
  return BLOCK_BY_ID.taper;
}

/**
 * A paper is a two-hour commitment, so it is scheduled rather than offered every day: once a week
 * through the depth block, twice a week in the taper where rehearsing the format matters more than
 * accumulating volume. Saturday and Wednesday, since a full sitting needs a clear run at it.
 */
export function isPaperDay(block: BlockId, date: Date): boolean {
  const day = date.getDay();
  if (block === "depth") return day === 6;
  if (block === "taper") return day === 6 || day === 3;
  return false;
}

/** The last 48 hours add almost nothing and can subtract through fatigue. */
export function isRestDay(daysRemaining: number): boolean {
  return daysRemaining >= 0 && daysRemaining <= 2;
}

export interface CampaignDay {
  /** Days from today to competition day; 0 is the day itself. */
  daysRemaining: number;
  block: Block;
  /** 1-based week of the campaign, counting forward from the start of training. */
  weekOut: number;
  isPaperDay: boolean;
  isRestDay: boolean;
  /** True once the target date has passed — the campaign is over, not in taper. */
  finished: boolean;
}

export function campaignDay(targetDate: string, today = new Date()): CampaignDay {
  const daysRemaining = daysUntil(targetDate, today);
  const finished = daysRemaining < 0;
  const block = blockFor(daysRemaining);
  return {
    daysRemaining,
    block,
    weekOut: Math.max(1, Math.ceil((daysRemaining + 1) / 7)),
    isPaperDay: !finished && isPaperDay(block.id, today),
    isRestDay: isRestDay(daysRemaining),
    finished,
  };
}

export type StepKind = "recognition" | "problems" | "paper" | "values" | "review";

export interface SessionStep {
  kind: StepKind;
  /** Imperative, and specific enough to act on without reading the block's rationale. */
  label: string;
  /** Why this step is in today's session — shown small, so the plan never feels arbitrary. */
  why: string;
  /** Problems (or cards, or recognition questions) to work. Absent for a paper or a review. */
  count?: number;
  /** Difficulties the scheduler should draw from, for problem steps. */
  difficulties?: Difficulty[];
  /** Where the step is worked. */
  route: string;
}

/**
 * Today's session, composed from modes that already exist. Nothing here reimplements grading,
 * selection or assembly — a step is a pointer at a mode plus the shape of the work.
 *
 * Advisory, never a cage: the competitor can always ignore this and drill whatever they know is
 * weak. The plan exists so that showing up requires no decision, not to remove the choice.
 */
export function planSession(day: CampaignDay): SessionStep[] {
  if (day.finished) return [];

  if (day.isRestDay) {
    return [
      {
        kind: "values",
        label: "Read through the values deck",
        why: "Recall only. Nothing new goes in this close to the day.",
        count: 20,
        route: "/integrals/values",
      },
    ];
  }

  if (day.isPaperDay) {
    return [
      {
        kind: "paper",
        label: "Sit a full paper — 30 problems, 120 minutes",
        why: "The benchmark. Pacing under the real format is the thing you cannot practise in pieces.",
        route: "/integrals/uk/round1",
      },
      {
        kind: "review",
        label: "Review the paper, band by band",
        why: "A mark dropped in the accessible ten costs the same as one in the tail, and is cheaper to fix.",
        route: "/integrals/progress",
      },
    ];
  }

  const recognition: SessionStep = {
    kind: "recognition",
    label: "Recognition round — name the weapon",
    why: "Solo, the accessible ten need to land in about 90 seconds each. That is recognition, not algebra.",
    count: 20,
    route: "/integrals/recognition",
  };

  switch (day.block.id) {
    case "breadth":
      return [
        recognition,
        {
          kind: "problems",
          label: "25 problems, cold mix",
          why: "Breadth first: the aim this block is that no technique is one you cannot start.",
          count: 25,
          difficulties: [2, 3, 4],
          route: "/integrals/train",
        },
      ];
    case "depth":
      return [
        recognition,
        {
          kind: "problems",
          label: "25 problems from the hard pool",
          why: "Train above the qualifier. The tail is where the ranking is actually decided.",
          count: 25,
          difficulties: [4, 5],
          route: "/integrals/train",
        },
      ];
    case "taper":
      return [
        {
          kind: "values",
          label: "Values deck — 20 cards",
          why: "Recall stays sharp on light, frequent contact.",
          count: 20,
          route: "/integrals/values",
        },
        {
          kind: "problems",
          label: "10 problems, mixed",
          why: "Enough to stay warm. Volume now costs more in fatigue than it returns in skill.",
          count: 10,
          difficulties: [3, 4],
          route: "/integrals/train",
        },
        {
          kind: "review",
          label: "Read your error profile",
          why: "The cheapest marks left are the mistakes you already know you make.",
          route: "/integrals/progress",
        },
      ];
  }
}
