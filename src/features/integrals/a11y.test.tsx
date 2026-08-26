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

import DailyIntegral from "@/pages/DailyIntegral";
import IntegralsHub from "@/pages/IntegralsHub";
import { TrainingTechnique } from "@/pages/IntegralTraining";
import { dailyProblem } from "./daily";
import { resetProgress } from "./progress";

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

  it("says whether a badge is earned or locked", () => {
    at("/integrals", <IntegralsHub />, "/integrals");
    expect(screen.getByLabelText(/First Blood: locked/)).toBeInTheDocument();
  });
});

describe("the run", () => {
  it("labels the answer box independently of its placeholder", () => {
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    expect(screen.getByLabelText(/Your answer to the integral/i)).toBeInTheDocument();
  });

  it("announces the verdict through a live region that was already mounted", async () => {
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    const live = screen.getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();

    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: "1+1" } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    await waitFor(() => expect(screen.getByRole("status")).not.toBeEmptyDOMElement());
  });

  it("moves focus to the result when the run ends", async () => {
    const problem = dailyProblem();
    at("/integrals/daily", <DailyIntegral />, "/integrals/daily");
    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: problem.answer } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    await waitFor(() => expect(screen.getByText("Solved.")).toBeInTheDocument());
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
