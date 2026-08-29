import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRecognitionAttempts,
  MAX_RECOGNITION_ATTEMPTS,
  recordRecognitionAttempt,
  resetRecognitionAttempts,
} from "./recognitionHistory";
import { setProgressScope } from "./progress";

beforeEach(() => {
  setProgressScope(null);
  resetRecognitionAttempts();
});

describe("recording", () => {
  it("starts empty", () => {
    expect(getRecognitionAttempts()).toEqual([]);
  });

  it("appends a row for every pick, correct or not", () => {
    recordRecognitionAttempt({ technique: "power", correct: true, responseMs: 900 });
    recordRecognitionAttempt({ technique: "u-sub", correct: false, responseMs: 2400 });
    const rows = getRecognitionAttempts();
    expect(rows).toHaveLength(2);
    expect(rows[0].correct).toBe(true);
    expect(rows[1].correct).toBe(false);
  });

  it("stores a timeout as a null response time", () => {
    const r = recordRecognitionAttempt({ technique: "power", correct: false, responseMs: null });
    expect(r.responseMs).toBeNull();
    expect(r.correct).toBe(false);
  });

  it("gives every attempt a unique id", () => {
    for (let i = 0; i < 20; i++) recordRecognitionAttempt({ technique: "power", correct: true, responseMs: 500 });
    const ids = new Set(getRecognitionAttempts().map((a) => a.id));
    expect(ids.size).toBe(20);
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
    resetRecognitionAttempts();
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
  });

  it(
    "caps stored attempts and drops the oldest first",
    () => {
      for (let i = 0; i < MAX_RECOGNITION_ATTEMPTS + 10; i++) {
        recordRecognitionAttempt({ technique: "power", correct: i % 2 === 0, responseMs: i });
      }
      const rows = getRecognitionAttempts();
      expect(rows.length).toBe(MAX_RECOGNITION_ATTEMPTS);
      expect(rows[0].responseMs).toBe(10);
      expect(rows[rows.length - 1].responseMs).toBe(MAX_RECOGNITION_ATTEMPTS + 9);
    },
    20000,
  );
});

describe("scoping", () => {
  it("keeps two accounts' recognition histories separate", () => {
    setProgressScope("alice");
    recordRecognitionAttempt({ technique: "power", correct: true, responseMs: 500 });
    expect(getRecognitionAttempts()).toHaveLength(1);

    setProgressScope("bob");
    expect(getRecognitionAttempts()).toHaveLength(0);
    recordRecognitionAttempt({ technique: "u-sub", correct: false, responseMs: 1500 });
    expect(getRecognitionAttempts()).toHaveLength(1);

    setProgressScope("alice");
    expect(getRecognitionAttempts()).toHaveLength(1);
    expect(getRecognitionAttempts()[0].technique).toBe("power");

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
      expect(() => recordRecognitionAttempt({ technique: "power", correct: true, responseMs: 500 })).not.toThrow();
      expect(getRecognitionAttempts()).toHaveLength(1);
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("reset", () => {
  it("clears every stored attempt", () => {
    recordRecognitionAttempt({ technique: "power", correct: true, responseMs: 500 });
    expect(getRecognitionAttempts()).toHaveLength(1);
    resetRecognitionAttempts();
    expect(getRecognitionAttempts()).toHaveLength(0);
  });
});
