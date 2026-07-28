import { describe, it, expect } from "vitest";
import { planNextAction, TrackLite, SubtopicLite, ReviewLite } from "./nextAction";

// Fixed local-time "now" — all test dates are built relative to it with
// explicit local timestamps (no trailing Z) so results don't depend on the
// machine's timezone.
const NOW = new Date("2026-07-21T12:00:00");

function daysFromNow(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

let idCounter = 0;
function sub(overrides: Partial<SubtopicLite> = {}): SubtopicLite {
  idCounter += 1;
  return { id: `sub-${idCounter}`, title: `Subtopic ${idCounter}`, status: "unlocked", topicOrder: 0, order: idCounter, ...overrides };
}

function track(overrides: Partial<TrackLite> = {}): TrackLite {
  idCounter += 1;
  return {
    id: `track-${idCounter}`,
    title: `Track ${idCounter}`,
    examDate: null,
    createdAt: "2026-07-01T00:00:00",
    subtopics: [],
    ...overrides,
  };
}

function review(subtopicId: string, dueAt: string): ReviewLite {
  return { subtopicId, dueAt };
}

describe("planNextAction", () => {
  it("returns null when there are no tracks", () => {
    expect(planNextAction({ now: NOW, tracks: [], reviews: [] })).toBeNull();
    expect(planNextAction({ now: NOW, tracks: [], reviews: [review("x", daysFromNow(-3))] })).toBeNull();
  });

  it("puts the most overdue review first, ahead of everything else", () => {
    const s1 = sub({ title: "Chain Rule", status: "complete" });
    const s2 = sub({ title: "Product Rule", status: "complete" });
    const s3 = sub({ title: "Integration by Parts" });
    const t = track({ subtopics: [s1, s2, s3], examDate: "2026-08-22T12:00:00" });

    const plan = planNextAction({
      now: NOW,
      tracks: [t],
      reviews: [review(s2.id, daysFromNow(-1)), review(s1.id, daysFromNow(-3))],
    });

    expect(plan).not.toBeNull();
    expect(plan!.primary.kind).toBe("overdue_review");
    expect(plan!.primary.reason).toBe('Review "Chain Rule" — due 3 days ago');
    expect(plan!.primary.to).toBe(`/session/${s1.id}?mode=review`);
    // Next in line: the 1-day-overdue review, then the exam-driven subtopic.
    expect(plan!.secondary.map((s) => s.kind)).toEqual(["overdue_review", "next_subtopic"]);
    expect(plan!.secondary[0].reason).toBe('Review "Product Rule" — due 1 day ago');
  });

  it("recommends a due-today review when nothing is overdue", () => {
    const s1 = sub({ title: "Limits", status: "complete" });
    const t = track({ subtopics: [s1] });

    const plan = planNextAction({ now: NOW, tracks: [t], reviews: [review(s1.id, daysFromNow(0))] });

    expect(plan!.primary.kind).toBe("due_review");
    expect(plan!.primary.reason).toBe('Review "Limits" — due today');
    expect(plan!.primary.cta).toBe("Start review");
  });

  it("ignores reviews whose subtopic is not in an active track (e.g. archived)", () => {
    const s1 = sub({ title: "Vectors" });
    const t = track({ subtopics: [s1] });

    const plan = planNextAction({
      now: NOW,
      tracks: [t],
      reviews: [review("archived-track-subtopic", daysFromNow(-10))],
    });

    expect(plan!.primary.kind).toBe("next_subtopic");
    expect(plan!.primary.to).toBe(`/session/${s1.id}`);
  });

  it("with no due reviews, picks the next subtopic in the track with the nearest exam", () => {
    const near = sub({ title: "Integration by Parts" });
    const far = sub({ title: "Waves" });
    const tNear = track({ title: "Maths", examDate: daysFromNow(32), subtopics: [near] });
    const tFar = track({ title: "Physics", examDate: daysFromNow(60), subtopics: [far] });

    const plan = planNextAction({ now: NOW, tracks: [tFar, tNear], reviews: [] });

    expect(plan!.primary.kind).toBe("next_subtopic");
    expect(plan!.primary.to).toBe(`/session/${near.id}`);
    expect(plan!.primary.reason).toBe('32 days to your Maths exam and "Integration by Parts" is next');
    // The other track is offered as a secondary suggestion.
    expect(plan!.secondary[0].to).toBe(`/session/${far.id}`);
  });

  it("breaks exam-date ties by weakest spec coverage", () => {
    const examDay = daysFromNow(30);
    const weakSub = sub({ title: "Weak topic" });
    const strongSub = sub({ title: "Strong topic" });
    const weak = track({ title: "Weak", examDate: examDay, subtopics: [weakSub], specTicked: 2, specTotal: 10 });
    const strong = track({ title: "Strong", examDate: examDay, subtopics: [strongSub], specTicked: 9, specTotal: 10 });

    const plan = planNextAction({ now: NOW, tracks: [strong, weak], reviews: [] });

    expect(plan!.primary.to).toBe(`/session/${weakSub.id}`);
  });

  it("prefers tracks with exam dates over ones without, and ignores past exams", () => {
    const pastSub = sub({ title: "Old" });
    const futureSub = sub({ title: "Soon" });
    const past = track({ title: "Done exam", examDate: daysFromNow(-5), subtopics: [pastSub], createdAt: "2026-06-01T00:00:00" });
    const future = track({ title: "Live exam", examDate: daysFromNow(10), subtopics: [futureSub], createdAt: "2026-07-01T00:00:00" });

    const plan = planNextAction({ now: NOW, tracks: [past, future], reviews: [] });

    expect(plan!.primary.to).toBe(`/session/${futureSub.id}`);
  });

  it("resumes an in-progress subtopic ahead of earlier unstarted ones, skipping locked", () => {
    const a = sub({ title: "First", status: "unlocked", topicOrder: 0, order: 0 });
    const locked = sub({ title: "Locked", status: "locked", topicOrder: 0, order: 1 });
    const inProg = sub({ title: "Halfway", status: "in_progress", topicOrder: 1, order: 0 });
    const t = track({ title: "Maths", subtopics: [a, locked, inProg] });

    const plan = planNextAction({ now: NOW, tracks: [t], reviews: [] });

    expect(plan!.primary.to).toBe(`/session/${inProg.id}`);
    expect(plan!.primary.reason).toBe('Pick up "Halfway" where you left off in Maths');
    expect(plan!.primary.cta).toBe("Continue session");
  });

  it("resuming an in-progress session outranks a due review, even for a different subtopic", () => {
    // Regression test: previously all due/overdue reviews were pushed as candidates before any
    // "resume in-progress subtopic" candidate, so a completely unrelated overdue review would hide
    // the "Continue session" CTA for a subtopic the student had already started teaching on —
    // reported as "Dashboard shows 'Start review' instead of 'Continue session' after sending a
    // message mid-session."
    const reviewedSub = sub({ title: "Chain Rule", status: "complete" });
    const reviewTrack = track({ title: "Old Track", subtopics: [reviewedSub] });

    const inProgressSub = sub({ title: "Halfway", status: "in_progress" });
    const activeTrack = track({ title: "Active Track", subtopics: [inProgressSub] });

    const plan = planNextAction({
      now: NOW,
      tracks: [reviewTrack, activeTrack],
      reviews: [review(reviewedSub.id, daysFromNow(-3))], // heavily overdue
    });

    expect(plan!.primary.kind).toBe("next_subtopic");
    expect(plan!.primary.cta).toBe("Continue session");
    expect(plan!.primary.to).toBe(`/session/${inProgressSub.id}`);
    // The overdue review is still surfaced — just not ahead of the in-progress resume.
    expect(plan!.secondary.some((s) => s.kind === "overdue_review")).toBe(true);
  });

  it("resuming an in-progress session in the SAME subtopic as a due review still wins", () => {
    const s = sub({ title: "Halfway", status: "in_progress" });
    const t = track({ title: "Maths", subtopics: [s] });

    const plan = planNextAction({
      now: NOW,
      tracks: [t],
      reviews: [review(s.id, daysFromNow(0))],
    });

    expect(plan!.primary.kind).toBe("next_subtopic");
    expect(plan!.primary.cta).toBe("Continue session");
  });

  it("orders subtopics by topic order then subtopic order", () => {
    const later = sub({ title: "Later", status: "unlocked", topicOrder: 1, order: 0 });
    const first = sub({ title: "First", status: "unlocked", topicOrder: 0, order: 2 });
    const t = track({ subtopics: [later, first] });

    const plan = planNextAction({ now: NOW, tracks: [t], reviews: [] });

    expect(plan!.primary.to).toBe(`/session/${first.id}`);
  });

  it("falls back to the earliest upcoming review when everything is complete", () => {
    const s1 = sub({ title: "Chain Rule", status: "complete" });
    const s2 = sub({ title: "Limits", status: "complete" });
    const t = track({ subtopics: [s1, s2] });

    const plan = planNextAction({
      now: NOW,
      tracks: [t],
      reviews: [review(s1.id, daysFromNow(9)), review(s2.id, daysFromNow(4))],
    });

    expect(plan!.primary.kind).toBe("upcoming_review");
    expect(plan!.primary.reason).toBe('All caught up — next review "Limits" is in 4 days');
    expect(plan!.primary.to).toBe(`/session/${s2.id}?mode=review`);
  });

  it("suggests a new track when all complete and no reviews exist", () => {
    const t = track({ subtopics: [sub({ status: "complete" })] });

    const plan = planNextAction({ now: NOW, tracks: [t], reviews: [] });

    expect(plan!.primary.kind).toBe("new_track");
    expect(plan!.primary.to).toBe("/onboarding?new=1");
  });

  it("caps secondary suggestions at 2 and dedupes by destination", () => {
    const subs = [
      sub({ title: "A", status: "complete" }),
      sub({ title: "B", status: "complete" }),
      sub({ title: "C", status: "complete" }),
      sub({ title: "D", status: "complete" }),
    ];
    const t1 = track({ subtopics: [subs[0], subs[1]] });
    const t2 = track({ subtopics: [subs[2], subs[3]] });

    const plan = planNextAction({
      now: NOW,
      tracks: [t1, t2],
      reviews: subs.map((s, i) => review(s.id, daysFromNow(-(i + 1)))),
    });

    // 4 due reviews -> primary = most overdue (D), then exactly 2 secondaries.
    expect(plan!.primary.to).toBe(`/session/${subs[3].id}?mode=review`);
    expect(plan!.secondary).toHaveLength(2);
    const destinations = [plan!.primary.to, ...plan!.secondary.map((s) => s.to)];
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it("is deterministic: same input yields the same plan", () => {
    const s1 = sub({ title: "X", status: "complete" });
    const s2 = sub({ title: "Y" });
    const t = track({ examDate: daysFromNow(14), subtopics: [s1, s2] });
    const input = { now: NOW, tracks: [t], reviews: [review(s1.id, daysFromNow(-2))] };

    expect(planNextAction(input)).toEqual(planNextAction(input));
  });
});
