import { beforeEach, describe, expect, it } from "vitest";
import {
  getCampaignState,
  liveCampaignStreak,
  MAX_SESSION_DAYS,
  resetCampaign,
  sessionsCompletedCount,
  setTargetDate,
  stepIsComplete,
  toggleStep,
} from "./campaignStore";
import { DEFAULT_TARGET_DATE } from "./campaign";
import { setProgressScope } from "../progress";
import { dayKey } from "../daily";

beforeEach(() => {
  setProgressScope(null);
  resetCampaign();
});

describe("target date", () => {
  it("defaults to DEFAULT_TARGET_DATE until the competitor sets one", () => {
    expect(getCampaignState().targetDate).toBe(DEFAULT_TARGET_DATE);
  });

  it("persists a chosen target date", () => {
    setTargetDate("2026-11-14");
    expect(getCampaignState().targetDate).toBe("2026-11-14");
  });
});

describe("ticking steps", () => {
  it("marks a step complete, and reflects it via stepIsComplete", () => {
    expect(stepIsComplete(getCampaignState().sessions, "2026-09-01", "recognition")).toBe(false);
    toggleStep("2026-09-01", "recognition");
    expect(stepIsComplete(getCampaignState().sessions, "2026-09-01", "recognition")).toBe(true);
  });

  it("toggles back off on a second call — ticking twice is an undo, not a double-tick", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-01", "recognition");
    expect(stepIsComplete(getCampaignState().sessions, "2026-09-01", "recognition")).toBe(false);
  });

  it("tracks multiple steps within the same day independently", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-01", "problems");
    const sessions = getCampaignState().sessions;
    expect(stepIsComplete(sessions, "2026-09-01", "recognition")).toBe(true);
    expect(stepIsComplete(sessions, "2026-09-01", "problems")).toBe(true);
    expect(stepIsComplete(sessions, "2026-09-01", "paper")).toBe(false);
  });

  it("keeps different days' ticks separate", () => {
    toggleStep("2026-09-01", "recognition");
    const sessions = getCampaignState().sessions;
    expect(stepIsComplete(sessions, "2026-09-01", "recognition")).toBe(true);
    expect(stepIsComplete(sessions, "2026-09-02", "recognition")).toBe(false);
  });
});

describe("sessionsCompletedCount", () => {
  it("counts a day only once it has at least one ticked step", () => {
    expect(sessionsCompletedCount(getCampaignState().sessions)).toBe(0);
    toggleStep("2026-09-01", "recognition");
    expect(sessionsCompletedCount(getCampaignState().sessions)).toBe(1);
    toggleStep("2026-09-01", "problems"); // second step, same day — still one session
    expect(sessionsCompletedCount(getCampaignState().sessions)).toBe(1);
    toggleStep("2026-09-02", "values");
    expect(sessionsCompletedCount(getCampaignState().sessions)).toBe(2);
  });

  it("does not count a day whose only ticked step was undone", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-01", "recognition"); // undo
    expect(sessionsCompletedCount(getCampaignState().sessions)).toBe(0);
  });
});

describe("streak", () => {
  it("starts at 1 on the first day shown up", () => {
    toggleStep("2026-09-01", "recognition");
    expect(getCampaignState().streak.current).toBe(1);
  });

  it("does not double-count a second tick on the same day", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-01", "problems");
    expect(getCampaignState().streak.current).toBe(1);
  });

  it("extends on a consecutive calendar day", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-02", "recognition");
    toggleStep("2026-09-03", "recognition");
    expect(getCampaignState().streak.current).toBe(3);
    expect(getCampaignState().streak.longest).toBe(3);
  });

  it("resets to 1 after a gap, but remembers the longest run", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-02", "recognition");
    toggleStep("2026-09-05", "recognition"); // skipped 3rd and 4th
    const streak = getCampaignState().streak;
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(2);
  });

  it("does not roll back when the day's only tick is undone", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-01", "recognition"); // undo
    expect(getCampaignState().streak.current).toBe(1);
  });
});

describe("liveCampaignStreak", () => {
  it("is 0 with no history at all", () => {
    expect(liveCampaignStreak(getCampaignState().streak, new Date(2026, 8, 3))).toBe(0);
  });

  it("holds while the streak's last day is today", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-02", "recognition");
    expect(liveCampaignStreak(getCampaignState().streak, new Date(2026, 8, 2))).toBe(2);
  });

  it("still holds the morning after, before today's session is ticked", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-02", "recognition");
    expect(liveCampaignStreak(getCampaignState().streak, new Date(2026, 8, 3))).toBe(2);
  });

  it("has lapsed once a full day has passed with nothing ticked", () => {
    toggleStep("2026-09-01", "recognition");
    toggleStep("2026-09-02", "recognition");
    expect(liveCampaignStreak(getCampaignState().streak, new Date(2026, 8, 4))).toBe(0);
  });
});

describe("ring buffer", () => {
  /** `i` consecutive real calendar days from 1 Jan 2020 — one tick each, so every iteration opens
   *  a genuinely new session and the buffer has to evict rather than merge. */
  const dayFor = (i: number) => dayKey(new Date(2020, 0, 1 + i));

  it("caps stored session days and drops the oldest first", () => {
    for (let i = 0; i < MAX_SESSION_DAYS + 10; i++) toggleStep(dayFor(i), "recognition");
    const sessions = getCampaignState().sessions;
    expect(sessions.length).toBe(MAX_SESSION_DAYS);
    expect(sessions[0].dayKey).toBe(dayFor(10));
    expect(sessions[sessions.length - 1].dayKey).toBe(dayFor(MAX_SESSION_DAYS + 9));
  });
});

describe("scoping", () => {
  it("keeps two accounts' campaigns completely separate", () => {
    setProgressScope("alice");
    setTargetDate("2026-11-14");
    toggleStep("2026-09-01", "recognition");
    expect(getCampaignState().targetDate).toBe("2026-11-14");
    expect(sessionsCompletedCount(getCampaignState().sessions)).toBe(1);

    setProgressScope("bob");
    expect(getCampaignState().targetDate).toBe(DEFAULT_TARGET_DATE);
    expect(sessionsCompletedCount(getCampaignState().sessions)).toBe(0);

    setProgressScope("alice");
    expect(getCampaignState().targetDate).toBe("2026-11-14");
    expect(sessionsCompletedCount(getCampaignState().sessions)).toBe(1);

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
      expect(() => toggleStep("2026-09-01", "recognition")).not.toThrow();
      expect(stepIsComplete(getCampaignState().sessions, "2026-09-01", "recognition")).toBe(true);
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("reset", () => {
  it("clears the target date and every ticked session", () => {
    setTargetDate("2026-11-14");
    toggleStep("2026-09-01", "recognition");
    resetCampaign();
    expect(getCampaignState().targetDate).toBe(DEFAULT_TARGET_DATE);
    expect(getCampaignState().sessions).toHaveLength(0);
    expect(getCampaignState().streak.current).toBe(0);
  });
});
