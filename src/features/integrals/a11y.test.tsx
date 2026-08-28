/**
 * Accessibility regressions worth a test rather than a manual pass: the ones that are invisible
 * on screen and so would otherwise rot silently.
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
import { TrainingTechnique } from "@/pages/IntegralTraining";
import { dailyProblem, dailyProblems } from "./daily";
import { resetProgress } from "./progress";
import type { Problem } from "./types";

beforeEach(() => {
  resetProgress();
  window.localStorage.clear();
});

/** Solves every slot of the day's daily in order, clicking through to the next between them. */
async function solveDaily(problems: Problem[]) {
  for (let i = 0; i < problems.length; i++) {
    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: problems[i].answer } });
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

describe("the hub", () => {
  it("does not read the unplayed daily out to a screen reader", () => {
    const { container } = at("/integrals", <IntegralsHub />, "/integrals");

    // The integral is on screen but blurred; assistive tech must not be able to reach it.
    const hidden = container.querySelector('[aria-hidden="true"] .katex');
    expect(hidden, "the blurred integral should sit inside an aria-hidden container").toBeTruthy();
    expect(screen.getByText(/hidden until you start/i)).toBeInTheDocument();
  });

  it("labels difficulty rather than leaving bare star glyphs", () => {
    at("/integrals", <IntegralsHub />, "/integrals");
    expect(screen.getByLabelText(/Difficulty \d out of 5/)).toBeInTheDocument();
  });

  it("exposes XP and mastery as progress bars", () => {
    at("/integrals", <IntegralsHub />, "/integrals");
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBeGreaterThan(1);
    expect(bars[0]).toHaveAttribute("aria-valuemax");
    expect(screen.getByLabelText(/Level 1 progress/)).toBeInTheDocument();
  });

  it("summarises badges as a count rather than a wall of undifferentiated pills", () => {
    // The detail — which badge, earned or locked — lives on the progress page.
    at("/integrals", <IntegralsHub />, "/integrals");
    const link = screen.getByRole("link", { name: /Badges/ });
    expect(link).toHaveAttribute("href", "/integrals/progress");
    expect(link.textContent).toMatch(/0\/\d+/);
    expect(link.textContent).toMatch(/None yet/);
  });
});

describe("the run", () => {
  it("labels the answer box independently of its placeholder", () => {
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    expect(screen.getByLabelText(/Your answer to the integral/i)).toBeInTheDocument();
  });

  it("announces the verdict through a live region that was already mounted", async () => {
    const problem = dailyProblem();
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    const live = screen.getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();

    // No fixed guess is safe here: today's problem is whichever one the deterministic daily
    // shuffle lands on. A small guess can coincidentally equal the real answer (solving the run and
    // unmounting this very status region instead of just filling it); a huge fixed constant flips
    // that risk around for an indefinite answer, since checkIndefinite's tolerance scales with the
    // *guess's* own magnitude too — a wildly large constant can swamp a reference function's real
    // (but small) variation and look flat by comparison. Perturbing the actual correct answer is
    // the only guess that's wrong regardless of kind or magnitude — see integration.test.tsx.
    const wrongGuess = problem.kind === "definite" ? `${problem.answer}+999999` : `${problem.answer}+x`;
    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: wrongGuess } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    await waitFor(() => expect(screen.getByRole("status")).not.toBeEmptyDOMElement());
  });

  it("moves focus to the result when a slot ends", async () => {
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    const problem = dailyProblem();
    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: problem.answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    await waitFor(() => expect(screen.getByText("Correct.")).toBeInTheDocument());
    expect(document.activeElement?.contains(screen.getByText("Correct."))).toBe(true);
  });

  it("moves focus to the result when the whole day ends", async () => {
    const problems = dailyProblems();
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    await solveDaily(problems);
    expect(document.activeElement?.contains(screen.getByText("Solved."))).toBe(true);
  });
});

describe("training", () => {
  it("marks the lesson disclosure as expandable", async () => {
    at("/integrals/train/parts", <TrainingTechnique />, "/integrals/train/:techniqueId");
    const toggle = screen.getByRole("button", { name: /The lesson/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /The lesson/i })).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
  });
});
