/**
 * End-to-end through the real pages: mount, type an answer, get graded, see the score banked.
 * AppShell is stubbed because it reaches for auth and Supabase; nothing else is mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user" }, session: null, profile: null, loading: false }),
}));

import DailyIntegral from "@/pages/DailyIntegral";
import IntegralsHub from "@/pages/IntegralsHub";
import IntegralTraining, { TrainingTechnique } from "@/pages/IntegralTraining";
import { dailyProblem, dailyProblems } from "./daily";
import { getProgress, markLessonRead, resetProgress } from "./progress";
import { scheduledQueue } from "./queue";
import { getAttempts } from "./attempts";
import { problemsForTechnique } from "./problems";
import type { Problem } from "./types";
import type { TechniqueId } from "./types";

beforeEach(() => {
  resetProgress();
  window.localStorage.clear();
});

/**
 * Which problem the training page serves first.
 *
 * These tests don't assert the ordering — they need to know which problem is on screen so they can
 * type its answer. So this mirrors `IntegralTraining`'s own selector: if the page changes how it
 * builds its queue, change it here too and the assertions below still hold unaltered.
 */
function servedFirst(techniqueId: TechniqueId): Problem {
  return scheduledQueue(problemsForTechnique(techniqueId), getProgress(), getAttempts())[0];
}

/** Solves every slot of the day's daily in order, clicking through to the next between them. */
async function solveDaily(problems: Problem[]) {
  for (let i = 0; i < problems.length; i++) {
    const input = screen.getByPlaceholderText(/your answer|a number/i);
    fireEvent.change(input, { target: { value: problems[i].answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    if (i < problems.length - 1) {
      await waitFor(() => expect(screen.getByText("Correct.")).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: /Next integral/i }));
    } else {
      await waitFor(() => expect(screen.getByText("Solved.")).toBeInTheDocument());
    }
  }
}

const at = (path: string, element: React.ReactNode, route: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );

describe("the daily", () => {
  it("shows today's integral and grades a correct answer", async () => {
    const problems = dailyProblems();
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Daily #\d+/);
    // One attempt per puzzle is the whole point of the daily — no skip escape hatch here.
    expect(screen.queryByRole("button", { name: /^Skip$/i })).not.toBeInTheDocument();

    await solveDaily(problems);
    expect(screen.getAllByText(/How it goes/).length).toBeGreaterThan(0);

    const p = getProgress();
    for (const problem of problems) expect(p.solves[problem.id]).toBeTruthy();
    expect(p.xp).toBeGreaterThan(0);
    expect(p.streak.current).toBe(1);
  });

  it("rejects a wrong answer and keeps the run going", async () => {
    const problem = dailyProblem();
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    const input = screen.getByPlaceholderText(/your answer|a number/i);
    // No fixed guess is safe here: today's problem is whichever one the deterministic daily
    // shuffle lands on. A fixed constant like "42" can coincidentally be a "nice" multiple of a
    // real definite answer (off-by-constant-factor, not incorrect); a huge fixed constant flips
    // that risk around for an indefinite answer, since checkIndefinite's tolerance scales with the
    // *guess's* own magnitude too — a wildly large constant can swamp a reference function's real
    // (but small) variation and look flat by comparison. Perturbing the actual correct answer is
    // the only guess that's wrong regardless of kind or magnitude: for definite it's off by exactly
    // 999999 (never a "nice" multiple of a small answer), and for indefinite the difference from
    // the reference is exactly "x" — genuinely non-constant, so it can never pass the "+C" check.
    const wrongGuess = problem.kind === "definite" ? `${problem.answer}+999999` : `${problem.answer}+x`;
    fireEvent.change(input, { target: { value: wrongGuess } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    // The exact wording depends on which of several "wrong" verdict shapes fires (incorrect,
    // off-by-constant-factor, unparseable) — what actually matters is that the run wasn't solved.
    await waitFor(() => expect(screen.getByRole("status")).not.toBeEmptyDOMElement());
    expect(screen.queryByText("Solved.")).not.toBeInTheDocument();
    expect(getProgress().xp).toBe(0);
  });

  it("reveals hints one at a time", async () => {
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    expect(screen.queryAllByTestId("hint")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Reveal a hint/i }));
    await waitFor(() => expect(screen.getAllByTestId("hint")).toHaveLength(1));
    expect(screen.queryAllByTestId("hint")).not.toHaveLength(dailyProblem().hints.length + 1);
  });

  it("does not hand out a second attempt after the day is finished", async () => {
    const problems = dailyProblems();
    const first = at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    await solveDaily(problems);
    first.unmount();

    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    expect(screen.getByText("Solved.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/your answer|a number/i)).not.toBeInTheDocument();
  });
});

describe("the leaderboard, when its tables are not deployed", () => {
  it("says so and leaves the run intact", async () => {
    // No Supabase in jsdom, so every call fails — which is exactly the state a player is in
    // before the migration is applied. The daily must not care.
    const problems = dailyProblems();
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    await solveDaily(problems);
    await waitFor(() => expect(screen.getByText(/board isn't reachable yet/)).toBeInTheDocument());

    // The score, the solve and the streak are all still banked locally.
    const p = getProgress();
    expect(p.xp).toBeGreaterThan(0);
    expect(p.streak.current).toBe(1);
    for (const problem of problems) expect(p.solves[problem.id]).toBeTruthy();
    expect(screen.getByText(/your streak is safe/)).toBeInTheDocument();
  });
});

describe("the hub", () => {
  it("hides today's integral until it's opened, and reflects a solve", async () => {
    const { unmount } = at("/integrals", <IntegralsHub />, "/integrals");
    expect(screen.getByText(/Not started/)).toBeInTheDocument();
    expect(screen.getByText(/Level 1/)).toBeInTheDocument();
    unmount();

    const problems = dailyProblems();
    const daily = at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    await solveDaily(problems);
    daily.unmount();

    at("/integrals", <IntegralsHub />, "/integrals");
    expect(screen.getByText(/Solved for \d+ points/)).toBeInTheDocument();
  });

  it("lists every technique as its own way in", () => {
    const { container } = at("/integrals/train", <IntegralTraining />, "/integrals/train");
    expect(container.querySelector('a[href="/integrals/train/parts"]')).toBeTruthy();
    expect(screen.getByText("Mixed practice")).toBeInTheDocument();
  });


});

describe("training", () => {
  it("leads with the lesson when it has never been read, and records it once put away", async () => {
    at("/integrals/train/parts", <TrainingTechnique />, "/integrals/train/:techniqueId");
    expect(getProgress().lessonsRead).toEqual([]);
    // Open on arrival — the whole design is lesson before drill.
    expect(screen.getByText("When to reach for it")).toBeInTheDocument();

    // Read means read: it is banked when the student closes it, not when it appears on screen.
    fireEvent.click(screen.getByRole("button", { name: /The lesson/i }));
    await waitFor(() => expect(screen.queryByText("When to reach for it")).toBeNull());
    expect(getProgress().lessonsRead).toContain("parts");
  });

  it("keeps an already-read lesson out of the way", () => {
    markLessonRead("parts");
    at("/integrals/train/parts", <TrainingTechnique />, "/integrals/train/:techniqueId");
    expect(screen.queryByText("When to reach for it")).toBeNull();
    expect(screen.getByRole("button", { name: /The lesson/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("resumes a queue where it was left rather than restarting at the top", async () => {
    const { unmount } = at(
      "/integrals/train/parts",
      <TrainingTechnique />,
      "/integrals/train/:techniqueId",
    );
    const first = screen.getByRole("heading", { level: 1 }).textContent;
    fireEvent.click(screen.getByRole("button", { name: /^Skip$/ }));
    const second = document.body.textContent;
    unmount();

    // Coming back lands on the problem it was left on, not the top of the queue.
    at("/integrals/train/parts", <TrainingTechnique />, "/integrals/train/:techniqueId");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(first);
    expect(second).toBeTruthy();
  });

  it(
    "ends the queue instead of silently wrapping to the start",
    async () => {
      at("/integrals/train/floor-function", <TrainingTechnique />, "/integrals/train/:techniqueId");
      const total = Number(/\d+\/(\d+)/.exec(screen.getByText(/\d+\/\d+ solved/).textContent!)![1]);
      // Walking off the end used to wrap silently back to the first problem, with no sign of it.
      for (let i = 0; i < total + 1; i++) {
        const skip = screen.queryByRole("button", { name: /^Skip$/ });
        if (!skip) break;
        fireEvent.click(skip);
      }
      await waitFor(() => expect(screen.getByText(/End of the/)).toBeInTheDocument());
    },
    // floor-function's pool has grown well past what it was when this test was written (content
    // seeding keeps adding to it) -- clicking Skip through the whole queue is real work per
    // problem, not a fixed cost, so the default 5000ms margin has gotten too tight under load in
    // the full suite. Widening the budget, not weakening the assertion: the loop still walks the
    // real total and still asserts the real end-of-queue message.
    15000,
  );

  it("advances through the queue and banks training XP", async () => {
    at("/integrals/train/parts", <TrainingTechnique />, "/integrals/train/:techniqueId");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Integration by parts");

    // Whatever the scheduler serves first, solve it.
    const before = screen.getByText(/1\/\d+/).textContent;
    const first = servedFirst("parts");
    const input = screen.getByPlaceholderText(/your answer|a number/i);
    fireEvent.change(input, { target: { value: first.answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    await waitFor(() => expect(screen.getByText(/Solved in/)).toBeInTheDocument());
    expect(getProgress().xp).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Next$/i }));
    await waitFor(() => expect(screen.getByText(/2\/\d+/).textContent).not.toBe(before));
  });

  it("skips a problem without answering it, recording nothing", async () => {
    at("/integrals/train/parts", <TrainingTechnique />, "/integrals/train/:techniqueId");
    const first = servedFirst("parts");
    const before = screen.getByText(/1\/\d+/).textContent;

    fireEvent.click(screen.getByRole("button", { name: /^Skip$/i }));

    await waitFor(() => expect(screen.getByText(/2\/\d+/).textContent).not.toBe(before));
    // Still mid-run on the next problem — skipping doesn't reveal a solution or end the run.
    expect(screen.getByPlaceholderText(/your answer|a number/i)).toBeInTheDocument();
    expect(getProgress().xp).toBe(0);
    expect(getProgress().solves[first.id]).toBeUndefined();
  });

  it("redirects an unknown technique back to the list", () => {
    at("/integrals/train/nonsense", <TrainingTechnique />, "/integrals/train/:techniqueId");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});
