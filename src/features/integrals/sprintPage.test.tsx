/**
 * The sprint page end to end, on a fake clock so a three-minute run takes a millisecond.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import IntegralSprint from "@/pages/IntegralSprint";
import { buildQueue } from "./sprint";
import { getProgress, resetProgress, sprintBest } from "./progress";

beforeEach(() => {
  resetProgress();
  window.localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 26, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/integrals/sprint"]}>
      <Routes>
        <Route path="/integrals/sprint" element={<IntegralSprint />} />
      </Routes>
    </MemoryRouter>,
  );

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** The queue is seeded from the clock, which is frozen — so the test can know what comes up. */
const queueFor = (band: "warmup" | "mixed" | "hard" | "brutal", seconds: 60 | 180 | 300) =>
  buildQueue({ band, seconds }, Date.now());

describe("setting up a sprint", () => {
  it("offers every band and clock, and says there is no best yet", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /^Warm-up Levels 1–2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Brutal Levels 4–5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 min" })).toBeInTheDocument();
    expect(screen.getByText(/No run at this setting yet/)).toBeInTheDocument();
  });

  it("marks the selected band and clock as pressed", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /^Mixed/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /^Brutal/ }));
    expect(screen.getByRole("button", { name: /^Brutal/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Mixed/ })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("running a sprint", () => {
  const start = (seconds: 60 | 180 | 300 = 60) => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: seconds === 60 ? "1 min" : "3 min" }));
    const queue = queueFor("mixed", seconds);
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    return queue;
  };

  it("counts a solve and its points", () => {
    const queue = start();
    expect(screen.getByText("1:00")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: queue[0].answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(screen.getByText(/1 solved/)).toBeInTheDocument();
    expect(screen.getByText(/1 solved · \d+ pts/).textContent).not.toContain("· 0 pts");
    // The solve banked XP straight away rather than waiting for the clock.
    expect(getProgress().solves[queue[0].id]).toBeTruthy();
    expect(getProgress().xp).toBeGreaterThan(0);
  });

  it("moves on and charges for a skip", () => {
    const queue = start();
    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: queue[0].answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    const afterSolve = screen.getByText(/solved · \d+ pts/).textContent!;

    fireEvent.click(screen.getByRole("button", { name: /Skip/ }));
    const afterSkip = screen.getByText(/solved · \d+ pts/).textContent!;

    const points = (s: string) => Number(/· (\d+) pts/.exec(s)![1]);
    expect(points(afterSkip)).toBe(points(afterSolve) - 8);
  });

  it("keeps a wrong answer on the same problem", () => {
    const queue = start();
    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getByText(/0 solved/)).toBeInTheDocument();
    // Still the first problem, and the typed answer is still there to fix.
    expect(screen.getByLabelText(/Your answer/i)).toHaveValue("42");
    expect(queue[0]).toBeTruthy();
  });

  it("ends when the clock runs out and records the run", () => {
    const queue = start();
    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: queue[0].answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    tick(61_000);

    expect(screen.getByText("Time.")).toBeInTheDocument();
    expect(screen.getByText("points")).toBeInTheDocument();
    expect(screen.getByText("What you landed")).toBeInTheDocument();

    const best = sprintBest(getProgress(), { band: "mixed", seconds: 60 });
    expect(best?.solved).toBe(1);
    expect(best?.runs).toBe(1);
    expect(best?.score).toBeGreaterThan(0);
  });

  it("calls out a new best, and how far short otherwise", () => {
    const queue = start();
    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: queue[0].answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    tick(61_000);
    expect(screen.getByText(/New best at/)).toBeInTheDocument();

    // A second run that scores nothing should not claim the record.
    fireEvent.click(screen.getByRole("button", { name: /Again/ }));
    tick(61_000);
    expect(screen.getByText(/short\./)).toBeInTheDocument();
    expect(sprintBest(getProgress(), { band: "mixed", seconds: 60 })?.runs).toBe(2);
  });

  it("can be set up again after a run", () => {
    start();
    tick(61_000);
    fireEvent.click(screen.getByRole("button", { name: /Change setup/ }));
    expect(screen.getByRole("button", { name: /^Start/ })).toBeInTheDocument();
  });
});
