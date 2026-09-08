import { describe, expect, it } from "vitest";
import {
  BLOCKS,
  DEFAULT_TARGET_DATE,
  blockFor,
  campaignDay,
  daysUntil,
  isPaperDay,
  isRestDay,
  planSession,
  parseDate,
} from "./campaign";

/** A fixed target so nothing here depends on when the suite runs. Saturday 7 Nov 2026. */
const TARGET = "2026-11-07";

/** `n` days before the target, as a local Date. */
function daysOut(n: number): Date {
  const t = parseDate(TARGET);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() - n);
}

describe("campaign — dates", () => {
  it("parses an ISO date as local, not UTC", () => {
    // new Date("2026-11-07") is UTC midnight and lands on the 6th west of Greenwich.
    const d = parseDate(TARGET);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(7);
  });

  it("counts whole days to the target, with 0 on the day itself", () => {
    expect(daysUntil(TARGET, daysOut(0))).toBe(0);
    expect(daysUntil(TARGET, daysOut(1))).toBe(1);
    expect(daysUntil(TARGET, daysOut(70))).toBe(70);
  });

  it("goes negative once the date has passed", () => {
    expect(daysUntil(TARGET, daysOut(-3))).toBe(-3);
  });

  it("is unaffected by the time of day", () => {
    const morning = daysOut(10);
    morning.setHours(6, 0, 0, 0);
    const night = daysOut(10);
    night.setHours(23, 59, 0, 0);
    expect(daysUntil(TARGET, morning)).toBe(daysUntil(TARGET, night));
  });
});

describe("campaign — blocks", () => {
  it("covers every distance out, with no gap between blocks", () => {
    for (let d = 0; d <= 120; d++) expect(blockFor(d)).toBeDefined();
    // Ordered furthest-out first, and each floor strictly below the previous.
    const floors = BLOCKS.map((b) => b.fromDaysOut);
    expect(floors).toEqual([...floors].sort((a, b) => b - a));
    expect(new Set(floors).size).toBe(floors.length);
  });

  it("counts backwards from the date: taper last, then depth, then breadth", () => {
    expect(blockFor(0).id).toBe("taper");
    expect(blockFor(13).id).toBe("taper");
    expect(blockFor(14).id).toBe("depth");
    expect(blockFor(41).id).toBe("depth");
    expect(blockFor(42).id).toBe("breadth");
    expect(blockFor(200).id).toBe("breadth");
  });

  it("phases correctly for a target date other than the default", () => {
    // The whole point of deriving backwards: a competitor sitting a week earlier is a week further
    // through the plan on the same calendar day, with no code change.
    const earlier = "2026-11-01";
    const day = new Date(2026, 9, 20); // 20 Oct — 18 days from the default, 12 from the earlier one
    expect(campaignDay(TARGET, day).block.id).toBe("depth");
    expect(campaignDay(earlier, day).block.id).toBe("taper");
  });

  it("reports finished, not tapering, once the date has passed", () => {
    const after = campaignDay(TARGET, daysOut(-1));
    expect(after.finished).toBe(true);
    expect(planSession(after)).toEqual([]);
  });
});

describe("campaign — session shape", () => {
  it("schedules a paper weekly in depth and twice weekly in taper, never in breadth", () => {
    const saturday = 6;
    const wednesday = 3;
    expect(isPaperDay("depth", nextWeekday(saturday))).toBe(true);
    expect(isPaperDay("depth", nextWeekday(wednesday))).toBe(false);
    expect(isPaperDay("taper", nextWeekday(saturday))).toBe(true);
    expect(isPaperDay("taper", nextWeekday(wednesday))).toBe(true);
    expect(isPaperDay("breadth", nextWeekday(saturday))).toBe(false);
  });

  it("rests the final 48 hours", () => {
    expect(isRestDay(0)).toBe(true);
    expect(isRestDay(2)).toBe(true);
    expect(isRestDay(3)).toBe(false);
    const plan = planSession(campaignDay(TARGET, daysOut(1)));
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe("values");
  });

  it("leads with a paper on a paper day, and follows it with review", () => {
    // 21 days out is in depth; step back to the nearest Saturday from there.
    const day = campaignDay(TARGET, daysOut(21));
    expect(day.block.id).toBe("depth");
    expect(day.isPaperDay).toBe(true); // the target is a Saturday, so 21 days out is too
    const plan = planSession(day);
    expect(plan.map((s) => s.kind)).toEqual(["paper", "review"]);
  });

  it("weights breadth to mid difficulty and depth to the hard pool", () => {
    const breadth = planSession(campaignDay(TARGET, daysOut(60)));
    const depth = planSession(campaignDay(TARGET, daysOut(25)));
    const problems = (plan: ReturnType<typeof planSession>) =>
      plan.find((s) => s.kind === "problems");

    expect(problems(breadth)?.difficulties).toEqual([2, 3, 4]);
    expect(problems(depth)?.difficulties).toEqual([4, 5]);
    // Both open on recognition — the 90-second requirement is trained every working day.
    expect(breadth[0].kind).toBe("recognition");
    expect(depth[0].kind).toBe("recognition");
  });

  it("drops volume and introduces nothing new in the taper", () => {
    // 9 days out is a Thursday here — deliberately not one of the taper's two paper days, which
    // would return the paper plan instead and have no problems step at all.
    const day = campaignDay(TARGET, daysOut(9));
    expect(day.block.id).toBe("taper");
    expect(day.isPaperDay).toBe(false);
    const taper = planSession(day);
    const problems = taper.find((s) => s.kind === "problems");
    expect(problems?.count).toBe(10);
    expect(taper.some((s) => s.kind === "review")).toBe(true);
  });

  it("gives every step a route that exists and a reason", () => {
    const routes = new Set([
      "/integrals/values",
      "/integrals/train",
      "/integrals/recognition",
      "/integrals/progress",
      "/integrals/uk/round1",
    ]);
    for (const out of [60, 40, 25, 21, 10, 1]) {
      for (const step of planSession(campaignDay(TARGET, daysOut(out)))) {
        expect(routes.has(step.route)).toBe(true);
        expect(step.label.length).toBeGreaterThan(0);
        expect(step.why.length).toBeGreaterThan(0);
      }
    }
  });

  it("defaults to the assumed Round 1 date until the competitor confirms one", () => {
    expect(DEFAULT_TARGET_DATE).toBe("2026-11-07");
    expect(parseDate(DEFAULT_TARGET_DATE).getDay()).toBe(6); // a Saturday
  });
});

/** The next date falling on `weekday`, from a fixed reference so the test never depends on today. */
function nextWeekday(weekday: number): Date {
  const d = new Date(2026, 9, 1); // 1 Oct 2026
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d;
}
