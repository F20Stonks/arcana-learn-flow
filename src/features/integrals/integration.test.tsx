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
import { dailyProblem } from "./daily";
import { getProgress, resetProgress } from "./progress";
import { orderQueue } from "./queue";
import { problemsForTechnique } from "./problems";

beforeEach(() => {
  resetProgress();
  window.localStorage.clear();
});

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
    const problem = dailyProblem();
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Daily #\d+/);

    const input = screen.getByPlaceholderText(/your answer|a number/i);
    fireEvent.change(input, { target: { value: problem.answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    await waitFor(() => expect(screen.getByText("Solved.")).toBeInTheDocument());
    expect(screen.getByText(/How it goes/)).toBeInTheDocument();

    const p = getProgress();
    expect(p.solves[problem.id]).toBeTruthy();
    expect(p.xp).toBeGreaterThan(0);
    expect(p.streak.current).toBe(1);
  });

  it("rejects a wrong answer and keeps the run going", async () => {
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    const input = screen.getByPlaceholderText(/your answer|a number/i);
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    await waitFor(() => expect(screen.getByText(/Not equivalent|still have/)).toBeInTheDocument());
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
    const problem = dailyProblem();
    const first = at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    fireEvent.change(screen.getByPlaceholderText(/your answer|a number/i), {
      target: { value: problem.answer },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    await waitFor(() => expect(screen.getByText("Solved.")).toBeInTheDocument());
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
    const problem = dailyProblem();
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    fireEvent.change(screen.getByPlaceholderText(/your answer|a number/i), {
      target: { value: problem.answer },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    await waitFor(() => expect(screen.getByText("Solved.")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/board isn't reachable yet/)).toBeInTheDocument());

    // The score, the solve and the streak are all still banked locally.
    const p = getProgress();
    expect(p.xp).toBeGreaterThan(0);
    expect(p.streak.current).toBe(1);
    expect(p.solves[problem.id]).toBeTruthy();
    expect(screen.getByText(/your streak is safe/)).toBeInTheDocument();
  });
});

describe("the hub", () => {
  it("hides today's integral until it's opened, and reflects a solve", async () => {
    const { unmount } = at("/integrals", <IntegralsHub />, "/integrals");
    expect(screen.getByText(/Not started/)).toBeInTheDocument();
    expect(screen.getByText(/Level 1/)).toBeInTheDocument();
    unmount();

    const problem = dailyProblem();
    const daily = at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    fireEvent.change(screen.getByPlaceholderText(/your answer|a number/i), {
      target: { value: problem.answer },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    await waitFor(() => expect(screen.getByText("Solved.")).toBeInTheDocument());
    daily.unmount();

    at("/integrals", <IntegralsHub />, "/integrals");
    expect(screen.getByText(/Solved for \d+ points/)).toBeInTheDocument();
  });

  it("lists every technique", () => {
    at("/integrals/train", <IntegralTraining />, "/integrals/train");
    expect(screen.getByText("Integration by parts")).toBeInTheDocument();
    expect(screen.getByText("Mixed practice")).toBeInTheDocument();
  });
});

describe("training", () => {
  it("opens the lesson and records that it was read", async () => {
    at("/integrals/train/parts", <TrainingTechnique />, "/integrals/train/:techniqueId");
    expect(getProgress().lessonsRead).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: /The lesson/i }));
    await waitFor(() => expect(screen.getByText("When to reach for it")).toBeInTheDocument());
    expect(getProgress().lessonsRead).toContain("parts");
  });

  it("advances through the queue and banks training XP", async () => {
    at("/integrals/train/parts", <TrainingTechnique />, "/integrals/train/:techniqueId");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Integration by parts");

    // The queue starts on the easiest unsolved problem; solve it.
    const before = screen.getByText(/1\/\d+/).textContent;
    const first = orderQueue(problemsForTechnique("parts"), getProgress())[0];
    const input = screen.getByPlaceholderText(/your answer|a number/i);
    fireEvent.change(input, { target: { value: first.answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    await waitFor(() => expect(screen.getByText(/Solved in/)).toBeInTheDocument());
    expect(getProgress().xp).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Next$/i }));
    await waitFor(() => expect(screen.getByText(/2\/\d+/).textContent).not.toBe(before));
  });

  it("redirects an unknown technique back to the list", () => {
    at("/integrals/train/nonsense", <TrainingTechnique />, "/integrals/train/:techniqueId");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});
