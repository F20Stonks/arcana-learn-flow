import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import IntegralProgress from "@/pages/IntegralProgress";
import { recordDaily, recordSprint, resetProgress } from "./progress";
import { PROBLEMS } from "./problems";

beforeEach(() => {
  resetProgress();
  window.localStorage.clear();
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/integrals/progress"]}>
      <Routes>
        <Route path="/integrals/progress" element={<IntegralProgress />} />
      </Routes>
    </MemoryRouter>,
  );

const playDaily = (date: Date, over: { solved?: boolean; score?: number } = {}) =>
  recordDaily(
    [
      {
        problemId: PROBLEMS[0].id,
        seconds: 25,
        hintsUsed: 0,
        wrongAttempts: 0,
        score: over.score ?? 60,
        solved: over.solved ?? true,
      },
    ],
    date,
  );

describe("an empty history", () => {
  it("says so rather than showing a blank dashboard", () => {
    renderPage();
    expect(screen.getByText(/Nothing recorded yet/)).toBeInTheDocument();
    expect(screen.getByText(/No sprints yet/)).toBeInTheDocument();
  });

  it("still draws the full calendar rectangle", () => {
    const { container } = renderPage();
    // 18 weeks of 7 days, all unplayed.
    expect(container.querySelectorAll(".bg-accent.rounded-\\[3px\\]").length).toBeGreaterThan(100);
  });
});

describe("a played history", () => {
  it("labels a played day with its result", () => {
    playDaily(new Date(2026, 7, 24, 12), { score: 55 });
    renderPage();
    // Locale-independent: assert the parts we control, not the date format.
    const cell = screen.getByLabelText(/solved, 55 points in 0:25/);
    expect(cell.getAttribute("aria-label")).toMatch(/2026/);
    expect(cell.getAttribute("aria-label")).toMatch(/Monday/);
  });

  it("distinguishes an attempt that was not solved", () => {
    playDaily(new Date(2026, 7, 24, 12), { solved: false, score: 0 });
    renderPage();
    expect(screen.getByLabelText(/attempted, not solved/)).toBeInTheDocument();
  });

  it("offers the same data as a table", () => {
    playDaily(new Date(2026, 7, 24, 12), { score: 55 });
    renderPage();

    // The daily heatmap's own Table toggle — the activity heatmap right below it has an
    // identically-labelled one, so this picks the first (the daily calendar renders first).
    fireEvent.click(screen.getAllByRole("button", { name: /Table/ })[0]);
    const table = screen.getByRole("table", { name: /Every day you have attempted/i });
    expect(within(table).getByText("2026-08-24")).toBeInTheDocument();
    expect(within(table).getByText("Solved")).toBeInTheDocument();
    expect(within(table).getByText("55")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Calendar/ })[0]);
    expect(screen.queryByRole("table", { name: /Every day you have attempted/i })).not.toBeInTheDocument();
  });

  it("reports turnout across the span rather than as a raw count", () => {
    playDaily(new Date(2026, 7, 24, 12));
    playDaily(new Date(2026, 7, 25, 12));
    renderPage();
    expect(screen.getByText("days turned up")).toBeInTheDocument();
    expect(screen.getByText(/dailies attempted, 2 solved/)).toBeInTheDocument();
  });
});

describe("the rest of the dashboard", () => {
  it("shows a sprint best once one exists", () => {
    recordSprint({ band: "hard", seconds: 180 }, { score: 210, solved: 5 });
    renderPage();
    expect(screen.queryByText(/No sprints yet/)).not.toBeInTheDocument();
    expect(screen.getByText("Hard · 3 min")).toBeInTheDocument();
    expect(screen.getByText("210")).toBeInTheDocument();
  });

  it("breaks the bank down by level, one bar each", () => {
    renderPage();
    for (const level of [1, 2, 3, 4, 5]) {
      expect(screen.getByLabelText(new RegExp(`^Level ${level}: \\d+ of \\d+ solved`))).toBeInTheDocument();
    }
  });

  it("states whether each badge is earned without relying on styling", () => {
    renderPage();
    expect(screen.getAllByText("— locked", { exact: false }).length).toBeGreaterThan(0);
    playDaily(new Date(2026, 7, 24, 12));
    renderPage();
    expect(screen.getAllByText("— earned", { exact: false }).length).toBeGreaterThan(0);
  });
});
