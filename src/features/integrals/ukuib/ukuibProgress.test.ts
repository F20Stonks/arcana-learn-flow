/**
 * The course progress store.
 *
 * Same shape of coverage as attempts.test.ts: what the store records, what it refuses to record,
 * that it is scoped per account, and that it degrades rather than throwing when localStorage is
 * unavailable.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setProgressScope } from "../progress";
import {
  CHECKPOINT_PASS_RATIO,
  checkpointPassed,
  crownOf,
  crownState,
  emptyUkuibProgress,
  getUkuibProgress,
  metSkillIds,
  recordCheckpoint,
  recordLesson,
  resetUkuibProgress,
  subscribeUkuib,
} from "./ukuibProgress";
import { MAX_CROWN } from "./curriculum";

beforeEach(() => {
  setProgressScope(null);
  globalThis.localStorage?.clear();
  resetUkuibProgress();
});

const lesson = (skillId: string, completed = true, accuracy = 1, xp = 20) =>
  recordLesson({ skillId, accuracy, xp, completed });

describe("empty state", () => {
  it("starts with nothing", () => {
    const p = getUkuibProgress();
    expect(p).toEqual(emptyUkuibProgress());
    expect(crownOf("power")).toBe(0);
    expect(checkpointPassed("foundations")).toBe(false);
    expect(metSkillIds()).toEqual([]);
  });
});

describe("recording lessons", () => {
  it("awards a crown for a completed lesson", () => {
    lesson("power");
    expect(crownOf("power")).toBe(1);
    expect(getUkuibProgress().skills.power.lessonsDone).toBe(1);
  });

  it("awards no crown when the student ran out of hearts", () => {
    lesson("power", false);
    expect(crownOf("power")).toBe(0);
    // The attempt still counts — a failed lesson is not a lesson that never happened.
    expect(getUkuibProgress().skills.power.lessonsDone).toBe(1);
  });

  it("banks XP whether or not the lesson was completed", () => {
    lesson("power", false, 0.4, 7);
    expect(getUkuibProgress().xp).toBe(7);
    lesson("power", true, 1, 20);
    expect(getUkuibProgress().xp).toBe(27);
  });

  it("stops at the maximum crown but keeps counting the practice", () => {
    for (let i = 0; i < MAX_CROWN + 3; i++) lesson("power");
    expect(crownOf("power")).toBe(MAX_CROWN);
    expect(getUkuibProgress().skills.power.lessonsDone).toBe(MAX_CROWN + 3);
  });

  it("keeps the best accuracy, not the latest", () => {
    lesson("power", true, 0.9);
    lesson("power", true, 0.4);
    expect(getUkuibProgress().skills.power.bestAccuracy).toBeCloseTo(0.9, 10);
  });

  it("counts a completed lesson against today, and a failed one against nothing", () => {
    lesson("power", true);
    const days = Object.values(getUkuibProgress().lessonDays);
    expect(days).toEqual([1]);
    lesson("u-sub", false);
    expect(Object.values(getUkuibProgress().lessonDays)).toEqual([1]);
  });

  it("lists met skills oldest first", async () => {
    lesson("power");
    // lastAt is an ISO timestamp; two writes inside the same millisecond would tie. Force an
    // ordering rather than depending on how fast the machine is.
    await new Promise((r) => setTimeout(r, 2));
    lesson("u-sub");
    expect(metSkillIds()).toEqual(["power", "u-sub"]);
  });

  it("leaves a skill out of metSkillIds until it has a crown", () => {
    lesson("power", false);
    expect(metSkillIds()).toEqual([]);
  });
});

describe("checkpoints", () => {
  it("passes at the stated ratio and not below it", () => {
    recordCheckpoint({ unitId: "foundations", score: 6, total: 10 });
    expect(checkpointPassed("foundations")).toBe(false);
    recordCheckpoint({ unitId: "foundations", score: 7, total: 10 });
    expect(checkpointPassed("foundations")).toBe(true);
    expect(CHECKPOINT_PASS_RATIO).toBe(0.7);
  });

  it("keeps a pass even if a later attempt goes badly", () => {
    recordCheckpoint({ unitId: "foundations", score: 10, total: 10 });
    recordCheckpoint({ unitId: "foundations", score: 1, total: 10 });
    expect(checkpointPassed("foundations")).toBe(true);
    expect(getUkuibProgress().checkpoints.foundations?.best).toBe(10);
  });

  it("never passes an empty checkpoint", () => {
    recordCheckpoint({ unitId: "foundations", score: 0, total: 0 });
    expect(checkpointPassed("foundations")).toBe(false);
  });
});

describe("crownState", () => {
  it("hands the pure curriculum rules a live view of the store", () => {
    lesson("power");
    recordCheckpoint({ unitId: "foundations", score: 9, total: 10 });
    const s = crownState();
    expect(s.crownOf("power")).toBe(1);
    expect(s.crownOf("u-sub")).toBe(0);
    expect(s.checkpointPassed("foundations")).toBe(true);
    expect(s.checkpointPassed("series")).toBe(false);
  });
});

describe("scoping and durability", () => {
  it("keeps two accounts' crowns apart on one browser", () => {
    setProgressScope("alice");
    lesson("power");
    expect(crownOf("power")).toBe(1);

    setProgressScope("bob");
    expect(crownOf("power")).toBe(0);

    setProgressScope("alice");
    expect(crownOf("power")).toBe(1);
  });

  it("survives a round trip through storage", () => {
    lesson("power");
    lesson("power");
    // Force a re-read from localStorage rather than the in-memory cache by moving the scope away
    // and back — the same path a page reload takes.
    setProgressScope("someone");
    setProgressScope(null);
    expect(crownOf("power")).toBe(2);
  });

  it("keeps working in memory when storage is unavailable", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    try {
      expect(() => lesson("power")).not.toThrow();
      expect(crownOf("power")).toBe(1);
    } finally {
      setItem.mockRestore();
    }
  });

  it("notifies subscribers on every write", () => {
    const fn = vi.fn();
    const unsub = subscribeUkuib(fn);
    lesson("power");
    recordCheckpoint({ unitId: "foundations", score: 8, total: 10 });
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
    lesson("u-sub");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
