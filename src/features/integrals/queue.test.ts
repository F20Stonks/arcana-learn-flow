import { describe, expect, it } from "vitest";
import { scheduledQueue, TARGET_SUCCESS_DEFAULT } from "./queue";
import { emptyProgress, type Progress, type SolveRecord } from "./progress";
import type { AttemptRecord } from "./attempts";
import type { Problem, TechniqueId } from "./types";

// ── fixtures ───────────────────────────────────────────────────────────────────────────────────
//
// Minimal, deliberately fake Problem/AttemptRecord objects — scheduledQueue only ever reads
// id/difficulty/techniques off a Problem and problemId/verdictClass/wrongAttemptsSoFar off an
// AttemptRecord, so the rest of each shape is filled with inert placeholders.

let idSeq = 0;
const NOW = Date.parse("2026-09-15T12:00:00.000Z");

function problem(id: string, techniques: TechniqueId[], difficulty: Problem["difficulty"] = 3): Problem {
  return {
    id,
    kind: "indefinite",
    integrand: "x",
    integrandExpr: "x",
    answer: "x^2/2",
    answerLatex: "x^2/2",
    domain: [1, 2],
    difficulty,
    techniques,
    source: { name: "original" },
    hints: [],
    steps: [],
  };
}

function attempt(problemId: string, over: Partial<AttemptRecord> = {}): AttemptRecord {
  idSeq += 1;
  return {
    id: `attempt-${idSeq}`,
    problemId,
    mode: "training",
    at: new Date(NOW).toISOString(),
    verdictClass: "incorrect",
    submitted: "x",
    hintsOpen: 0,
    wrongAttemptsSoFar: 0,
    msToFirstKeystroke: null,
    msFirstKeystrokeToSubmit: null,
    ...over,
  };
}

function solvedAgo(progress: Progress, problemId: string, daysAgo: number, over: Partial<SolveRecord> = {}): Progress {
  const solvedAt = new Date(NOW - daysAgo * 86_400_000).toISOString();
  return {
    ...progress,
    solves: {
      ...progress.solves,
      [problemId]: { solvedAt, solves: 1, bestSeconds: 60, everSolvedWithoutHints: true, ...over },
    },
  };
}

function idsOf(queue: readonly Problem[]): string[] {
  return queue.map((p) => p.id);
}

// ── invariants that must hold no matter how the weighting evolves ────────────────────────────────

describe("scheduledQueue — structural invariants", () => {
  it("returns an empty queue for an empty pool", () => {
    expect(scheduledQueue([], emptyProgress(), [], NOW)).toEqual([]);
  });

  it("is always a permutation of the pool — same ids, same count, nothing dropped or duplicated", () => {
    const pool = [
      problem("p1", ["power"], 1),
      problem("p2", ["u-sub"], 2),
      problem("p3", ["parts"], 3),
      problem("p4", ["trig-identity"], 4),
      problem("p5", ["power"], 5),
    ];
    const progress = solvedAgo(solvedAgo(emptyProgress(), "p1", 10), "p3", 40);
    const attempts = [attempt("p2", { verdictClass: "off-by-constant-factor" })];
    const out = scheduledQueue(pool, progress, attempts, NOW);
    expect(idsOf(out).sort()).toEqual(pool.map((p) => p.id).sort());
    expect(out).toHaveLength(pool.length);
  });

  it("is deterministic for the same inputs", () => {
    const pool = [
      problem("p1", ["power"], 2),
      problem("p2", ["u-sub"], 3),
      problem("p3", ["parts"], 4),
      problem("p4", ["trig-identity"], 1),
    ];
    const progress = solvedAgo(emptyProgress(), "p1", 5);
    const attempts = [attempt("p2", { verdictClass: "correct" })];
    const a = scheduledQueue(pool, progress, attempts, NOW);
    const b = scheduledQueue(pool, progress, attempts, NOW);
    expect(idsOf(a)).toEqual(idsOf(b));
  });
});

// ── factor 1: retention decay ─────────────────────────────────────────────────────────────────

describe("scheduledQueue — unsolved vs. solved, and retention decay", () => {
  it("always serves a never-solved problem ahead of any solved one, however stale", () => {
    const pool = [problem("solved-recent", ["power"], 3), problem("never-solved", ["u-sub"], 3)];
    const progress = solvedAgo(emptyProgress(), "solved-recent", 1);
    const out = scheduledQueue(pool, progress, [], NOW);
    expect(out[0].id).toBe("never-solved");
  });

  it("resurfaces a problem solved long ago before one solved recently, all else equal", () => {
    const pool = [problem("solved-recent", ["power"], 3), problem("solved-stale", ["u-sub"], 3)];
    let progress = solvedAgo(emptyProgress(), "solved-recent", 1);
    progress = solvedAgo(progress, "solved-stale", 30);
    const out = scheduledQueue(pool, progress, [], NOW);
    expect(out[0].id).toBe("solved-stale");
  });

  it("decays faster for a solve that took several wrong attempts than a clean one", () => {
    const pool = [problem("clean-solve", ["power"], 3), problem("hard-solve", ["u-sub"], 3)];
    let progress = solvedAgo(emptyProgress(), "clean-solve", 10);
    progress = solvedAgo(progress, "hard-solve", 10); // same elapsed time
    const attempts = [attempt("hard-solve", { verdictClass: "correct", wrongAttemptsSoFar: 4 })];
    const out = scheduledQueue(pool, progress, attempts, NOW);
    // Same time since solving, but hard-solve was harder to hold onto — more urgent to revisit.
    expect(out[0].id).toBe("hard-solve");
  });
});

// ── factor 2: per-technique weakness ──────────────────────────────────────────────────────────

describe("scheduledQueue — per-technique weakness", () => {
  it("prioritises a solved problem from a technique he's failing over one from a technique he isn't", () => {
    const weakSubject = problem("weak-subject", ["parts"], 3);
    const strongSubject = problem("strong-subject", ["trig-sub"], 3);
    // Establish "parts" as a weak technique and "trig-sub" as a strong one via other attempts —
    // scheduledQueue scopes technique stats to the whole pool, not just the two subjects.
    const filler = [problem("parts-filler-a", ["parts"], 2), problem("parts-filler-b", ["parts"], 2)];
    const pool = [weakSubject, strongSubject, ...filler];

    let progress = solvedAgo(emptyProgress(), "weak-subject", 10);
    progress = solvedAgo(progress, "strong-subject", 10); // identical elapsed time, identical hardness
    // Also mark the fillers solved (today) — otherwise, as unsolved problems, they'd sit in the
    // always-more-urgent "unsolved" tier and swamp the comparison this test actually cares about.
    progress = solvedAgo(progress, "parts-filler-a", 0);
    progress = solvedAgo(progress, "parts-filler-b", 0);

    const attempts = [
      attempt("parts-filler-a", { verdictClass: "incorrect" }),
      attempt("parts-filler-a", { verdictClass: "incorrect" }),
      attempt("parts-filler-b", { verdictClass: "incorrect" }),
      attempt("strong-subject", { verdictClass: "correct" }),
    ];

    const out = idsOf(scheduledQueue(pool, progress, attempts, NOW));
    expect(out.indexOf("weak-subject")).toBeLessThan(out.indexOf("strong-subject"));
  });
});

// ── factor 3: near-miss priority ──────────────────────────────────────────────────────────────

describe("scheduledQueue — near-miss priority", () => {
  it("serves an unsolved near-miss (off-by-constant-factor) ahead of one never attempted", () => {
    const pool = [problem("no-idea", ["power"], 3), problem("near-miss", ["u-sub"], 3)];
    const attempts = [attempt("near-miss", { verdictClass: "off-by-constant-factor" })];
    const out = scheduledQueue(pool, emptyProgress(), attempts, NOW);
    expect(out[0].id).toBe("near-miss");
  });

  it("serves an unsolved near-miss ahead of one whose last attempt was flatly wrong", () => {
    const pool = [problem("flat-wrong", ["power"], 3), problem("near-miss", ["u-sub"], 3)];
    const attempts = [
      attempt("flat-wrong", { verdictClass: "incorrect" }),
      attempt("near-miss", { verdictClass: "off-by-constant-factor" }),
    ];
    const out = scheduledQueue(pool, emptyProgress(), attempts, NOW);
    expect(out[0].id).toBe("near-miss");
  });
});

// ── factor 4: target success band ─────────────────────────────────────────────────────────────

describe("scheduledQueue — target success band", () => {
  it("blends in easier material rather than front-loading every hard, weak-technique problem first", () => {
    // 8 "easy" problems (low difficulty, a technique with a strong track record) and 8 "hard"
    // problems (high difficulty, a technique he's failing) — all unsolved, so raw urgency alone
    // (which factors in technique weakness) would otherwise serve all 8 hard ones before any easy
    // one. The target-success band should break that clump up.
    const easy = Array.from({ length: 8 }, (_, i) => problem(`easy-${i}`, ["power"], 1));
    const hard = Array.from({ length: 8 }, (_, i) => problem(`hard-${i}`, ["parts"], 5));
    const pool = [...easy, ...hard];

    const attempts = [
      attempt("easy-0", { verdictClass: "correct" }),
      attempt("easy-1", { verdictClass: "correct" }),
      attempt("hard-0", { verdictClass: "incorrect" }),
      attempt("hard-1", { verdictClass: "incorrect" }),
      attempt("hard-2", { verdictClass: "incorrect" }),
    ];

    const out = idsOf(scheduledQueue(pool, emptyProgress(), attempts, NOW, TARGET_SUCCESS_DEFAULT));

    const easyInFirstHalf = out.slice(0, 8).filter((id) => id.startsWith("easy-")).length;
    expect(easyInFirstHalf).toBeGreaterThanOrEqual(4); // a real mix, not "all hard first"

    const firstEasyServedAt = out.findIndex((id) => id.startsWith("easy-"));
    expect(firstEasyServedAt).toBeLessThan(4); // an easy problem shows up early, not buried at position 8+
  });
});

// ── factor 5: interleaving ─────────────────────────────────────────────────────────────────────

describe("scheduledQueue — technique interleaving", () => {
  it("never serves two consecutive problems from the same primary technique when avoidable", () => {
    // Three techniques, none dominating — plenty of room to avoid every clash.
    const pool = [
      problem("a1", ["power"], 2),
      problem("a2", ["power"], 2),
      problem("a3", ["power"], 2),
      problem("b1", ["u-sub"], 2),
      problem("b2", ["u-sub"], 2),
      problem("b3", ["u-sub"], 2),
      problem("c1", ["parts"], 2),
      problem("c2", ["parts"], 2),
      problem("c3", ["parts"], 2),
    ];
    const out = scheduledQueue(pool, emptyProgress(), [], NOW);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].techniques[0], `positions ${i - 1},${i}`).not.toBe(out[i - 1].techniques[0]);
    }
  });

  it("degrades gracefully — still a full, valid permutation — when one technique dominates", () => {
    const pool = [
      problem("a1", ["power"], 2),
      problem("a2", ["power"], 2),
      problem("a3", ["power"], 2),
      problem("a4", ["power"], 2),
      problem("a5", ["power"], 2),
      problem("b1", ["u-sub"], 2),
    ];
    const out = scheduledQueue(pool, emptyProgress(), [], NOW);
    expect(idsOf(out).sort()).toEqual(pool.map((p) => p.id).sort());
    expect(out).toHaveLength(6);
  });
});
