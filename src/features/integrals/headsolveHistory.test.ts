import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getHeadsolveAttempts,
  getLadderState,
  MAX_HEADSOLVE_ATTEMPTS,
  recordHeadsolveAttempt,
  resetHeadsolveHistory,
} from "./headsolveHistory";
import { getAttempts, resetAttempts } from "./attempts";
import { SUCCESS_STREAK_TO_LEVEL_UP } from "./headsolve";
import { setProgressScope } from "./progress";

beforeEach(() => {
  setProgressScope(null);
  resetHeadsolveHistory();
  resetAttempts();
});

function grade(
  g: "got-it" | "close" | "no",
  over: Partial<Parameters<typeof recordHeadsolveAttempt>[0]> = {},
) {
  return recordHeadsolveAttempt({
    problemId: "p1",
    technique: "power",
    band: "accessible",
    grade: g,
    thinkMs: 5000,
    ...over,
  });
}

describe("recording", () => {
  it("starts empty, ladder at level 0 streak 0", () => {
    expect(getHeadsolveAttempts()).toEqual([]);
    expect(getLadderState()).toEqual({ level: 0, streak: 0 });
  });

  it("appends a row for every grade, and computes beatTarget from band + thinkMs", () => {
    grade("got-it", { thinkMs: 10_000, band: "accessible" }); // 10s <= 30s target: beats it
    grade("no", { thinkMs: 200_000, band: "mid" }); // 200s > 90s target: misses it
    grade("close", { thinkMs: 1, band: "tail" }); // tail has no target at all
    const rows = getHeadsolveAttempts();
    expect(rows).toHaveLength(3);
    expect(rows[0].beatTarget).toBe(true);
    expect(rows[1].beatTarget).toBe(false);
    expect(rows[2].beatTarget).toBeNull();
  });

  it("gives every attempt a unique id", () => {
    for (let i = 0; i < 15; i++) grade("got-it");
    const ids = new Set(getHeadsolveAttempts().map((a) => a.id));
    expect(ids.size).toBe(15);
  });
});

describe("ladder advancement", () => {
  it("advances the ladder exactly as headsolve.ts's applyGrade would, and persists it", () => {
    for (let i = 0; i < SUCCESS_STREAK_TO_LEVEL_UP - 1; i++) {
      const { ladder } = grade("got-it");
      expect(ladder.level).toBe(0);
    }
    const { ladder } = grade("got-it");
    expect(ladder).toEqual({ level: 1, streak: 0 });
    expect(getLadderState()).toEqual({ level: 1, streak: 0 });
  });

  it("a miss drops the level and the drop survives a fresh read", () => {
    for (let i = 0; i < SUCCESS_STREAK_TO_LEVEL_UP; i++) grade("got-it");
    expect(getLadderState().level).toBe(1);
    grade("no");
    expect(getLadderState()).toEqual({ level: 0, streak: 0 });
  });
});

describe("mirrors into the shared WS-1 attempt log", () => {
  it("writes one AttemptRecord per graded headsolve attempt, under mode 'headsolve'", () => {
    grade("got-it");
    grade("no");
    const shared = getAttempts();
    expect(shared).toHaveLength(2);
    expect(shared.every((a) => a.mode === "headsolve")).toBe(true);
  });

  it("maps 'got it' to correct and both 'close' and 'no' to incorrect — never off-by-constant-factor", () => {
    grade("got-it");
    grade("close");
    grade("no");
    const [g, c, n] = getAttempts();
    expect(g.verdictClass).toBe("correct");
    expect(c.verdictClass).toBe("incorrect");
    expect(n.verdictClass).toBe("incorrect");
  });

  it("never sets a keystroke-split timing field, so it can never pollute a typed-mode median", () => {
    grade("got-it", { thinkMs: 12_345 });
    const [record] = getAttempts();
    expect(record.msToFirstKeystroke).toBeNull();
    expect(record.msFirstKeystrokeToSubmit).toBeNull();
    // thinkMs itself is not on the shared record at all — it lives only in the headsolve log.
    expect((record as unknown as { thinkMs?: number }).thinkMs).toBeUndefined();
  });

  it("carries the problemId through and marks the submitted string as synthetic, not typed", () => {
    grade("got-it", { problemId: "some-problem" });
    const [record] = getAttempts();
    expect(record.problemId).toBe("some-problem");
    expect(record.submitted).toBe("[headsolve: got-it]");
  });
});

describe("ring buffer", () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");

  function fastStorage(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => void map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    } as Storage;
  }

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, value: fastStorage() });
    resetHeadsolveHistory();
    resetAttempts();
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
  });

  it(
    "caps stored attempts and drops the oldest first",
    () => {
      for (let i = 0; i < MAX_HEADSOLVE_ATTEMPTS + 10; i++) {
        grade(i % 2 === 0 ? "got-it" : "no", { thinkMs: i });
      }
      const rows = getHeadsolveAttempts();
      expect(rows.length).toBe(MAX_HEADSOLVE_ATTEMPTS);
      expect(rows[0].thinkMs).toBe(10);
      expect(rows[rows.length - 1].thinkMs).toBe(MAX_HEADSOLVE_ATTEMPTS + 9);
    },
    20000,
  );
});

describe("scoping", () => {
  it("keeps two accounts' headsolve histories (and ladders) separate", () => {
    setProgressScope("alice");
    grade("got-it");
    expect(getHeadsolveAttempts()).toHaveLength(1);

    setProgressScope("bob");
    expect(getHeadsolveAttempts()).toHaveLength(0);
    expect(getLadderState()).toEqual({ level: 0, streak: 0 });
    grade("no");
    expect(getHeadsolveAttempts()).toHaveLength(1);

    setProgressScope("alice");
    expect(getHeadsolveAttempts()).toHaveLength(1);
    expect(getHeadsolveAttempts()[0].grade).toBe("got-it");

    setProgressScope(null);
  });

  it("survives storage being unavailable without throwing", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      },
    });
    try {
      expect(() => grade("got-it")).not.toThrow();
      expect(getHeadsolveAttempts()).toHaveLength(1);
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("reset", () => {
  it("clears every stored attempt and the ladder", () => {
    for (let i = 0; i < SUCCESS_STREAK_TO_LEVEL_UP; i++) grade("got-it");
    expect(getLadderState().level).toBe(1);
    resetHeadsolveHistory();
    expect(getHeadsolveAttempts()).toHaveLength(0);
    expect(getLadderState()).toEqual({ level: 0, streak: 0 });
  });
});
