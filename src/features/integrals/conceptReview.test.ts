import { beforeEach, describe, expect, it } from "vitest";
import {
  conceptReviewStep,
  daysOverdue,
  dueForReview,
  getConceptReviewRecords,
  recordConceptRead,
  resetConceptReview,
  REVIEW_INTERVALS_DAYS,
} from "./conceptReview";
import { dayKey } from "./daily";
import { setProgressScope } from "./progress";

// Fixed dates throughout, exactly as uk/campaign.test.ts's own progress-log entry recommends —
// nothing here should depend on when the suite happens to run.
const DAY0 = new Date(2026, 8, 1); // Tuesday 1 Sep 2026
const days = (base: Date, n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);

beforeEach(() => {
  setProgressScope(null);
  resetConceptReview();
});

describe("empty state", () => {
  it("has no records, nothing due, and no step before anything is read", () => {
    expect(getConceptReviewRecords()).toEqual({});
    expect(dueForReview(DAY0)).toEqual([]);
    expect(conceptReviewStep(DAY0)).toBeNull();
  });

  it("a technique that has never been read is not 'due' — it's new, not faded", () => {
    // power is read; u-sub never is. Advance far past every interval and confirm u-sub still never
    // shows up — breadth coverage owns "never attempted", not this module.
    recordConceptRead("power", DAY0);
    expect(dueForReview(days(DAY0, 400))).toEqual(["power"]);
  });
});

describe("first read", () => {
  it("schedules the first due day REVIEW_INTERVALS_DAYS[0] out, at stage 0", () => {
    recordConceptRead("power", DAY0);
    const record = getConceptReviewRecords().power!;
    expect(record.stage).toBe(0);
    expect(record.lastReadDayKey).toBe(dayKey(DAY0));
    expect(dueForReview(days(DAY0, REVIEW_INTERVALS_DAYS[0] - 1))).toEqual([]);
    expect(dueForReview(days(DAY0, REVIEW_INTERVALS_DAYS[0]))).toEqual(["power"]);
  });

  it("a second read on the SAME calendar day is a complete no-op", () => {
    recordConceptRead("power", DAY0);
    const before = getConceptReviewRecords().power;
    recordConceptRead("power", new Date(DAY0.getFullYear(), DAY0.getMonth(), DAY0.getDate(), 18, 30));
    expect(getConceptReviewRecords().power).toEqual(before);
  });
});

describe("reading again", () => {
  it("reading again on a later calendar day, but before it's due, updates when it was last seen without advancing the schedule", () => {
    recordConceptRead("power", DAY0);
    const firstDueDay = days(DAY0, REVIEW_INTERVALS_DAYS[0]);
    recordConceptRead("power", firstDueDay); // exactly on time -> advances to stage 1
    const afterAdvance = getConceptReviewRecords().power!;
    expect(afterAdvance.stage).toBe(1);

    const earlyRead = days(firstDueDay, 1); // a new day, but short of REVIEW_INTERVALS_DAYS[1] (3)
    recordConceptRead("power", earlyRead);
    const stillEarly = getConceptReviewRecords().power!;
    expect(stillEarly.stage).toBe(1); // unchanged — did not advance
    expect(stillEarly.dueDayIndex).toBe(afterAdvance.dueDayIndex); // schedule untouched
    expect(stillEarly.lastReadDayKey).toBe(dayKey(earlyRead)); // but "last seen" moved forward
  });

  it("reading exactly ON the due day advances the stage and widens the interval", () => {
    recordConceptRead("power", DAY0);
    const dueDay = days(DAY0, REVIEW_INTERVALS_DAYS[0]);
    recordConceptRead("power", dueDay);
    const record = getConceptReviewRecords().power!;
    expect(record.stage).toBe(1);
    // Next due day counts from the day it was actually reviewed, using the new (wider) interval.
    expect(dueForReview(days(dueDay, REVIEW_INTERVALS_DAYS[1] - 1))).toEqual([]);
    expect(dueForReview(days(dueDay, REVIEW_INTERVALS_DAYS[1]))).toEqual(["power"]);
  });

  it("reading well AFTER the due day still advances, counting the new interval from today rather than from the original due day (forgiveness, not punishment)", () => {
    recordConceptRead("power", DAY0);
    const lateRead = days(DAY0, REVIEW_INTERVALS_DAYS[0] + 10); // 10 days overdue at the moment of reading
    recordConceptRead("power", lateRead);
    expect(getConceptReviewRecords().power!.stage).toBe(1);
    expect(dueForReview(days(lateRead, REVIEW_INTERVALS_DAYS[1] - 1))).toEqual([]);
    expect(dueForReview(days(lateRead, REVIEW_INTERVALS_DAYS[1]))).toEqual(["power"]);
  });

  it("the stage caps at the last interval rather than growing without bound", () => {
    recordConceptRead("power", DAY0);
    let cumulativeDays = 0;
    let stage = 0;
    for (let i = 0; i < REVIEW_INTERVALS_DAYS.length + 3; i++) {
      cumulativeDays += REVIEW_INTERVALS_DAYS[Math.min(stage, REVIEW_INTERVALS_DAYS.length - 1)];
      recordConceptRead("power", days(DAY0, cumulativeDays));
      stage = Math.min(stage + 1, REVIEW_INTERVALS_DAYS.length - 1);
    }
    expect(getConceptReviewRecords().power!.stage).toBe(REVIEW_INTERVALS_DAYS.length - 1);
  });
});

describe("dueForReview ordering", () => {
  it("sorts most-overdue first", () => {
    recordConceptRead("power", DAY0);
    recordConceptRead("u-sub", days(DAY0, 1));

    // power becomes due at DAY0+1, u-sub at DAY0+2 — check a day where power is 2 days overdue and
    // u-sub is 1 day overdue.
    const checkAt = days(DAY0, 3);
    expect(dueForReview(checkAt)).toEqual(["power", "u-sub"]);
  });

  it("excludes a technique that has been read but is not yet due", () => {
    recordConceptRead("power", DAY0);
    expect(dueForReview(DAY0)).toEqual([]);
  });
});

describe("conceptReviewStep", () => {
  it("returns the most-overdue technique with its Technique object and days-overdue count", () => {
    recordConceptRead("power", DAY0);
    const checkAt = days(DAY0, REVIEW_INTERVALS_DAYS[0] + 4);
    const step = conceptReviewStep(checkAt);
    expect(step).not.toBeNull();
    expect(step!.techniqueId).toBe("power");
    expect(step!.technique.id).toBe("power");
    expect(step!.daysOverdue).toBe(4);
  });

  it("returns null once nothing is due", () => {
    recordConceptRead("power", DAY0);
    expect(conceptReviewStep(DAY0)).toBeNull();
  });
});

describe("daysOverdue", () => {
  it("is 0 exactly on the due day and negative before it", () => {
    recordConceptRead("power", DAY0);
    const record = getConceptReviewRecords().power!;
    const dueDay = days(DAY0, REVIEW_INTERVALS_DAYS[0]);
    expect(daysOverdue(record, dueDay)).toBe(0);
    expect(daysOverdue(record, days(dueDay, -1))).toBe(-1);
  });
});

describe("scoping", () => {
  it("keeps two accounts' concept-review logs completely separate", () => {
    setProgressScope("alice");
    recordConceptRead("power", DAY0);
    expect(getConceptReviewRecords().power).toBeDefined();

    setProgressScope("bob");
    expect(getConceptReviewRecords().power).toBeUndefined();

    setProgressScope("alice");
    expect(getConceptReviewRecords().power).toBeDefined();

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
      expect(() => recordConceptRead("power", DAY0)).not.toThrow();
      expect(getConceptReviewRecords().power).toBeDefined();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("reset", () => {
  it("clears every stored record", () => {
    recordConceptRead("power", DAY0);
    recordConceptRead("u-sub", DAY0);
    resetConceptReview();
    expect(getConceptReviewRecords()).toEqual({});
  });
});
