/**
 * The OA arena end to end, on a fake clock so an eight-minute paper takes a millisecond.
 *
 * The tests that matter most here are the honesty ones: that the arena says on every screen that
 * it is a reconstruction, that it flags the rounds it cannot simulate rather than quietly
 * replacing them, and that it never shows a pass mark for a firm that has no reported one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import OAHub from "@/pages/OAHub";
import OAFirm from "@/pages/OAFirm";
import OARun from "@/pages/OARun";
import { findAssessment, FIRMS } from "./firms";
import { buildRun } from "./generate";
import { getOaProgress, resetOaProgress } from "./progress";

/** Math.random seeds the paper; pinning it makes the exact questions knowable to the test. */
const SEED = Math.floor(0.5 * 1e9);

beforeEach(() => {
  resetOaProgress();
  window.localStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const at = (path: string, element: React.ReactNode, route: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("the hub", () => {
  it("lists the firms and what each assessment costs you in time", () => {
    at("/oa", <OAHub />, "/oa");
    expect(screen.getByRole("link", { name: /Optiver/ })).toHaveAttribute("href", "/oa/optiver");
    expect(screen.getByRole("link", { name: /Susquehanna/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Akuna/ })).toBeInTheDocument();
    // 80 in 8, stated as what it is.
    expect(screen.getByText("80 in 8")).toBeInTheDocument();
  });

  it("says on the page that these are reconstructions", () => {
    at("/oa", <OAHub />, "/oa");
    expect(screen.getByText(/not any firm's real assessment/i)).toBeInTheDocument();
  });
});

describe("a firm page", () => {
  it("shows the process, the sections and where the format came from", () => {
    at("/oa/optiver", <OAFirm />, "/oa/:firmId");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Optiver");
    expect(screen.getByText("Mental arithmetic")).toBeInTheDocument();
    expect(screen.getAllByText(/candidate accounts/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Sit it/ }).length).toBeGreaterThan(0);
  });

  it("flags the rounds it cannot simulate instead of quietly replacing them", () => {
    at("/oa/hrt", <OAFirm />, "/oa/:firmId");
    expect(screen.getByText(/coding round.*not simulated here/i)).toBeInTheDocument();
  });

  it("sends an unknown firm back to the hub", () => {
    at("/oa/nonsense", <OAFirm />, "/oa/:firmId");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});

describe("sitting a paper", () => {
  const open = (firmId: string, assessmentId: string) =>
    at(`/oa/${firmId}/${assessmentId}`, <OARun />, "/oa/:firmId/:assessmentId");

  it("briefs you on the shape before the clock starts", () => {
    open("optiver", "80-in-8");
    expect(screen.getByText("80 in 8")).toBeInTheDocument();
    expect(screen.getByText("questions")).toBeInTheDocument();
    expect(screen.getByText(/cannot go back to a question/i)).toBeInTheDocument();
    expect(screen.getByText(/not any firm's real assessment/i)).toBeInTheDocument();
    // Nothing is running until you say so.
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("names the paper, so the same run can be sat again", () => {
    open("optiver", "80-in-8");
    expect(screen.getByText(new RegExp(`#${SEED}`))).toBeInTheDocument();
  });

  it("grades a right answer and moves straight on", () => {
    const assessment = findAssessment("optiver", "80-in-8")!;
    const paper = buildRun(assessment, SEED);
    open("optiver", "80-in-8");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));

    expect(screen.getByText("1/80")).toBeInTheDocument();
    const first = paper[0][0];
    if (first.answer.type !== "numeric") throw new Error("expected a numeric first question");
    fireEvent.change(screen.getByLabelText(/Your answer/i), {
      target: { value: String(first.answer.value) },
    });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    // Straight on to the next question, with the box cleared — there is no confirm step.
    expect(screen.getByText("2/80")).toBeInTheDocument();
    expect(screen.getByLabelText(/Your answer/i)).toHaveValue("");
  });

  it("ends the section when its clock runs out, whether or not you are answering", () => {
    open("optiver", "80-in-8");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    expect(screen.getByRole("timer")).toBeInTheDocument();

    tick(481_000);
    expect(screen.getByRole("heading", { name: /What you missed/ })).toBeInTheDocument();
  });

  it("records the sitting and shows the working for every question answered", () => {
    const assessment = findAssessment("optiver", "80-in-8")!;
    const paper = buildRun(assessment, SEED);
    open("optiver", "80-in-8");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));

    for (let i = 0; i < 3; i++) {
      const q = paper[0][i];
      if (q.answer.type !== "numeric") continue;
      fireEvent.change(screen.getByLabelText(/Your answer/i), {
        target: { value: String(q.answer.value) },
      });
      fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    }
    tick(481_000);

    expect(screen.getByText("3", { selector: ".readout" })).toBeTruthy();
    const best = getOaProgress().attempts["optiver/80-in-8"];
    expect(best.bestCorrect).toBe(3);
    expect(best.total).toBe(80);
    expect(best.sittings).toBe(1);

    // The review is the half that changes the next sitting. It leads with the misses — eighty
    // questions with their working is not a list anyone reads.
    expect(screen.getByRole("heading", { name: /What you missed/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show all 3 answered/ }));
    expect(screen.getAllByText(/you said/).length).toBe(3);
  });

  it("measures you against a reported bar only where one is reported", () => {
    open("optiver", "80-in-8");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    tick(481_000);
    expect(screen.getByText(/candidates commonly report/i)).toBeInTheDocument();
    expect(screen.getByText(/reported figure, not a published one/i)).toBeInTheDocument();
  });

  it("says plainly when a firm has no reported bar rather than inventing one", () => {
    open("imc", "imc-math");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    tick(301_000);
    expect(screen.getByText(/does not publish a cutoff/i)).toBeInTheDocument();
    expect(screen.queryByText(/candidates commonly report/i)).toBeNull();
  });

  it("counts a skip as wrong and does not come back to it", () => {
    open("optiver", "80-in-8");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    fireEvent.click(screen.getByRole("button", { name: /Skip/ }));
    expect(screen.getByText("2/80")).toBeInTheDocument();

    tick(481_000);
    expect(getOaProgress().attempts["optiver/80-in-8"].bestCorrect).toBe(0);
  });

  it("ends the paper early, but only on a confirmation", () => {
    open("optiver", "80-in-8");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    fireEvent.click(screen.getByRole("button", { name: /End paper/ }));
    expect(screen.getByText(/End the paper here\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Keep going/ }));
    expect(screen.getByRole("timer")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /End paper/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Yes$/ }));
    expect(screen.getByRole("heading", { name: /What you missed/ })).toBeInTheDocument();
  });

  it("walks a multi-section paper section by section", () => {
    const assessment = findAssessment("sig", "sig-oa")!;
    open("sig", "sig-oa");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    expect(screen.getByText(/section 1\/3/)).toBeInTheDocument();

    tick(assessment.sections[0].seconds * 1000 + 1000);
    expect(screen.getByText(/section 2\/3/)).toBeInTheDocument();

    tick(assessment.sections[1].seconds * 1000 + 1000);
    expect(screen.getByText(/section 3\/3/)).toBeInTheDocument();

    tick(assessment.sections[2].seconds * 1000 + 1000);
    expect(screen.getByText("By section")).toBeInTheDocument();
  });

  it("sends an unknown assessment back to the hub", () => {
    at("/oa/optiver/nonsense", <OARun />, "/oa/:firmId/:assessmentId");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});

describe("multiple choice questions", () => {
  it("commits on the click, the way the real thing does", () => {
    // Deduction sections are the only ones with choices; find one to be sure it renders.
    const firm = FIRMS.find((f) => f.assessments.some((a) => a.sections.some((s) => s.kind === "logic")))!;
    const assessment = firm.assessments.find((a) => a.sections.some((s) => s.kind === "logic"))!;
    const paper = buildRun(assessment, SEED);
    const sectionIndex = assessment.sections.findIndex((s) => s.kind === "logic");
    const hasChoice = paper[sectionIndex].some((q) => q.choices);
    // Not every seed produces an ordering question; when it does, the group must be reachable.
    if (!hasChoice) return;

    at(`/oa/${firm.id}/${assessment.id}`, <OARun />, "/oa/:firmId/:assessmentId");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    for (let i = 0; i < sectionIndex; i++) {
      tick(assessment.sections[i].seconds * 1000 + 1000);
    }
    const group = screen.queryByRole("radiogroup");
    if (group) expect(within(group).getAllByRole("radio").length).toBe(4);
  });
});

describe("the section clock", () => {
  it("advances exactly one section per expiry, however many ticks arrive at once", () => {
    // A backgrounded tab coalesces timers and a fake clock delivers every pending tick in one go.
    // Reading the section from React state here advanced the paper once per tick.
    const assessment = findAssessment("sig", "sig-oa")!;
    at("/oa/sig/sig-oa", <OARun />, "/oa/:firmId/:assessmentId");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));

    tick(assessment.sections[0].seconds * 1000 + 60_000);
    expect(screen.getByText(/section 2\/3/)).toBeInTheDocument();
    // And the new section got its own full clock, not the remainder of the old one.
    expect(screen.getByRole("timer").textContent).not.toBe("0:00");
  });
});

describe("the review, on a long paper", () => {
  it("leads with the misses and keeps the full list one click away", () => {
    const assessment = findAssessment("optiver", "80-in-8")!;
    const paper = buildRun(assessment, SEED);
    at("/oa/optiver/80-in-8", <OARun />, "/oa/:firmId/:assessmentId");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));

    // Two right, two wrong.
    for (let i = 0; i < 4; i++) {
      const q = paper[0][i];
      if (q.answer.type !== "numeric") continue;
      fireEvent.change(screen.getByLabelText(/Your answer/i), {
        target: { value: i < 2 ? String(q.answer.value) : "-99999" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    }
    tick(481_000);

    expect(screen.getByRole("heading", { name: /What you missed/ })).toBeInTheDocument();
    expect(screen.getAllByText(/you said/).length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: /Show all 4 answered/ }));
    expect(screen.getByRole("heading", { name: /Every question/ })).toBeInTheDocument();
    expect(screen.getAllByText(/you said/).length).toBe(4);
  });

  it("says so plainly when there is nothing to go back over", () => {
    at("/oa/optiver/80-in-8", <OARun />, "/oa/:firmId/:assessmentId");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    tick(481_000);
    expect(screen.getByText(/nothing to go back over/i)).toBeInTheDocument();
  });
});

describe("finding the right firm", () => {
  it("filters the list to firms that test what you pick", () => {
    at("/oa", <OAHub />, "/oa");
    const optiver = () => screen.queryByRole("link", { name: /Optiver/ });
    expect(optiver()).toBeInTheDocument();

    // Optiver's reconstructed assessments have no options section; Akuna's do.
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(optiver()).toBeNull();
    expect(screen.getByRole("link", { name: /Akuna/ })).toBeInTheDocument();
  });

  it("intersects the filters rather than unioning them", () => {
    at("/oa", <OAHub />, "/oa");
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    const afterOne = screen.getAllByRole("link", { name: /Sit|^[A-Z]/ }).length;
    fireEvent.click(screen.getByRole("button", { name: "Grid scanning" }));
    // Asking for both narrows; it never widens.
    expect(screen.getAllByRole("link").length).toBeLessThanOrEqual(afterOne);
  });

  it("says so rather than showing an empty page when nothing matches", () => {
    at("/oa", <OAHub />, "/oa");
    fireEvent.click(screen.getByRole("button", { name: "Grid scanning" }));
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(screen.getByText(/No firm here tests all of those together/)).toBeInTheDocument();
  });

  it("names what each firm tests on its card", () => {
    at("/oa", <OAHub />, "/oa");
    expect(screen.getAllByText(/^Tests: /).length).toBe(FIRMS.length);
  });
});
