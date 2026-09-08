import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  attemptsForProblem,
  getAttempts,
  MAX_ATTEMPTS,
  recordAttempt,
  resetAttempts,
  type RecordAttemptInput,
} from "./attempts";
import { setProgressScope } from "./progress";

/** jsdom's real localStorage is slow enough per call that filling MAX_ATTEMPTS (each write
 *  re-serialises the whole log) takes tens of seconds — a testing artifact of the polyfill, not a
 *  real-world cost (a human never submits 5000 answers in one synchronous burst). Swap in a plain
 *  in-memory Storage for just the ring-buffer tests so they exercise the same
 *  globalThis.localStorage.getItem/setItem code path attempts.ts actually uses, at a sane speed. */
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

const base = (over: Partial<RecordAttemptInput> = {}): RecordAttemptInput => ({
  problemId: "power-monomial",
  mode: "training",
  verdictClass: "incorrect",
  submitted: "x^2/2",
  hintsOpen: 0,
  wrongAttemptsSoFar: 0,
  msToFirstKeystroke: 1200,
  msFirstKeystrokeToSubmit: 3400,
  ...over,
});

beforeEach(() => {
  setProgressScope(null);
  resetAttempts();
});

describe("recording", () => {
  it("appends a full row for every submission, not just solves", () => {
    recordAttempt(base({ verdictClass: "incorrect" }));
    recordAttempt(base({ verdictClass: "correct", submitted: "x^3/3 + C" }));
    const rows = getAttempts();
    expect(rows).toHaveLength(2);
    expect(rows[0].verdictClass).toBe("incorrect");
    expect(rows[1].verdictClass).toBe("correct");
    expect(rows[1].submitted).toBe("x^3/3 + C");
  });

  it("keeps both timing clocks separate and never invents one from the other", () => {
    const r = recordAttempt(base({ msToFirstKeystroke: 800, msFirstKeystrokeToSubmit: 5000 }));
    expect(r.msToFirstKeystroke).toBe(800);
    expect(r.msFirstKeystrokeToSubmit).toBe(5000);
  });

  it("tolerates a null timing (defensive — should not occur in practice, but must not crash)", () => {
    const r = recordAttempt(base({ msToFirstKeystroke: null, msFirstKeystrokeToSubmit: null }));
    expect(r.msToFirstKeystroke).toBeNull();
    expect(r.msFirstKeystrokeToSubmit).toBeNull();
  });

  it("stamps mode, hints-open and wrong-attempts-so-far exactly as given", () => {
    const r = recordAttempt(base({ mode: "sprint", hintsOpen: 2, wrongAttemptsSoFar: 3 }));
    expect(r.mode).toBe("sprint");
    expect(r.hintsOpen).toBe(2);
    expect(r.wrongAttemptsSoFar).toBe(3);
  });

  it("gives every attempt a unique id", () => {
    for (let i = 0; i < 20; i++) recordAttempt(base());
    const ids = new Set(getAttempts().map((a) => a.id));
    expect(ids.size).toBe(20);
  });

  it("filters by problem", () => {
    recordAttempt(base({ problemId: "power-monomial" }));
    recordAttempt(base({ problemId: "power-polynomial" }));
    recordAttempt(base({ problemId: "power-monomial" }));
    expect(attemptsForProblem("power-monomial")).toHaveLength(2);
    expect(attemptsForProblem("power-polynomial")).toHaveLength(1);
    expect(attemptsForProblem("nonexistent")).toHaveLength(0);
  });
});

describe("ring buffer", () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, value: fastStorage() });
    resetAttempts();
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
  });

  // A single test pushing MAX_ATTEMPTS+10 real records through the real recordAttempt() — every
  // call re-serialises the whole growing log (the same cost the real write path pays), so this is
  // an inherently O(n²) stress test even against fast in-memory storage; one combined assertion
  // instead of two keeps that cost paid once rather than twice.
  it(
    "caps stored attempts and drops the oldest first, instead of growing without bound",
    () => {
      for (let i = 0; i < MAX_ATTEMPTS + 10; i++) recordAttempt(base({ submitted: `attempt-${i}` }));
      const rows = getAttempts();
      expect(rows.length).toBe(MAX_ATTEMPTS);
      expect(rows[0].submitted).toBe("attempt-10");
      expect(rows[rows.length - 1].submitted).toBe(`attempt-${MAX_ATTEMPTS + 9}`);
    },
    20000,
  );
});

describe("scoping", () => {
  it("keeps two accounts' attempt logs completely separate", () => {
    setProgressScope("alice");
    recordAttempt(base({ submitted: "alice-answer" }));
    expect(getAttempts()).toHaveLength(1);

    setProgressScope("bob");
    expect(getAttempts()).toHaveLength(0);
    recordAttempt(base({ submitted: "bob-answer" }));
    expect(getAttempts()).toHaveLength(1);
    expect(getAttempts()[0].submitted).toBe("bob-answer");

    setProgressScope("alice");
    expect(getAttempts()).toHaveLength(1);
    expect(getAttempts()[0].submitted).toBe("alice-answer");

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
      expect(() => recordAttempt(base())).not.toThrow();
      expect(getAttempts()).toHaveLength(1);
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("reset", () => {
  it("clears every stored attempt", () => {
    recordAttempt(base());
    recordAttempt(base());
    expect(getAttempts()).toHaveLength(2);
    resetAttempts();
    expect(getAttempts()).toHaveLength(0);
  });
});
