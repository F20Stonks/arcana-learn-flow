/**
 * Drills. The one behaviour that makes a drill a drill rather than a short paper is that it marks
 * each question in front of you and waits — so that is what most of this covers, along with the
 * per-kind tallies that decide what the arena tells you to work on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import OADrill from "@/pages/OADrill";
import { drillSeconds, drillToQuery, parseDrill, KIND_BY_ID } from "./drill";
import { rng } from "./rng";
import { generateQuestion } from "./generate";
import { getOaProgress, kindStandings, recordDrill, resetOaProgress, weakestKind } from "./progress";
import type { Attempt } from "./types";

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

const open = (query = "?kind=arithmetic&level=3&count=10") =>
  render(
    <MemoryRouter initialEntries={[`/oa/drill${query}`]}>
      <Routes>
        <Route path="/oa/drill" element={<OADrill />} />
      </Routes>
    </MemoryRouter>,
  );

/** The exact questions the page will build, so the test can answer them. */
const paperFor = (kind: Parameters<typeof generateQuestion>[0], level: number, count: number) => {
  const r = rng(SEED);
  return Array.from({ length: count }, (_, i) => generateQuestion(kind, r, level, `drill-${i}`));
};

const box = () => screen.getByLabelText(/Your answer/i);

describe("the drill setup", () => {
  it("round-trips through the URL, so a set-up drill is a link", () => {
    const config = { kind: "options" as const, level: 4, count: 40, seconds: null };
    expect(parseDrill(new URLSearchParams(drillToQuery(config).slice(1)))).toEqual(config);
  });

  it("falls back to sane defaults on a hand-edited URL", () => {
    const parsed = parseDrill(new URLSearchParams("kind=nonsense&level=99&count=7"));
    expect(parsed.kind).toBe("arithmetic");
    expect(parsed.level).toBe(3);
    expect(parsed.count).toBe(20);
    expect(parsed.seconds).toBeNull();
  });

  it("paces a timed drill at what a real screen allows for that type", () => {
    // Six seconds a question for arithmetic is Optiver's 80-in-8 rate.
    expect(drillSeconds({ kind: "arithmetic", level: 3, count: 10 })).toBe(60);
    expect(drillSeconds({ kind: "probability", level: 3, count: 10 })).toBe(
      KIND_BY_ID.probability.pace * 10,
    );
  });

  it("offers every question kind the arena can generate", () => {
    open();
    for (const kind of ["Mental arithmetic", "Sequences", "Options", "Grid scanning"]) {
      expect(screen.getByRole("button", { name: new RegExp(kind) })).toBeInTheDocument();
    }
  });
});

describe("running a drill", () => {
  it("marks each question in front of you and waits", () => {
    const paper = paperFor("arithmetic", 3, 10);
    open();
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));

    const first = paper[0];
    if (first.answer.type !== "numeric") throw new Error("expected numeric");
    fireEvent.change(box(), { target: { value: String(first.answer.value) } });
    fireEvent.click(screen.getByRole("button", { name: /^Check/ }));

    // A paper would already be on question 2; a drill stops and shows the working.
    expect(screen.getByRole("status").textContent).toMatch(/Correct/);
    expect(screen.getByText("1/10")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Next question/ }));
    expect(screen.getByText("2/10")).toBeInTheDocument();
  });

  it("shows the answer and the working when you get it wrong", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    fireEvent.change(box(), { target: { value: "-99999" } });
    fireEvent.click(screen.getByRole("button", { name: /^Check/ }));

    const live = screen.getByRole("status");
    expect(live.textContent).toMatch(/Not this one/);
    expect(live.textContent).toMatch(/the answer is/);
  });

  it("will not let one question be graded twice", () => {
    const paper = paperFor("arithmetic", 3, 10);
    open();
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    if (paper[0].answer.type !== "numeric") throw new Error("expected numeric");

    fireEvent.change(box(), { target: { value: "-99999" } });
    fireEvent.click(screen.getByRole("button", { name: /^Check/ }));
    // Retyping after the verdict must not change the mark already given.
    fireEvent.change(box(), { target: { value: String(paper[0].answer.value) } });
    expect(screen.getByRole("status").textContent).toMatch(/Not this one/);
  });

  it("counts a skip as wrong rather than flattering you", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    fireEvent.click(screen.getByRole("button", { name: /Skip/ }));
    expect(screen.getByText("2/10")).toBeInTheDocument();
    expect(screen.getByText(/0 right/)).toBeInTheDocument();
  });

  it("runs untimed by default and shows a clock only when asked", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("puts a clock on when the drill is timed, and stops on it", () => {
    open("?kind=arithmetic&level=3&count=10&timed=1");
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    expect(screen.getByRole("timer")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(61_000));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/on mental arithmetic/i);
  });

  it("banks what it taught even when abandoned halfway", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    fireEvent.change(box(), { target: { value: "-99999" } });
    fireEvent.click(screen.getByRole("button", { name: /^Check/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Next question/ }));

    fireEvent.click(screen.getByRole("button", { name: /End drill/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Yes$/ }));

    expect(getOaProgress().kinds.arithmetic?.seen).toBe(1);
    expect(getOaProgress().kinds.arithmetic?.correct).toBe(0);
  });

  it("lists only what you missed, because that is the part worth rereading", () => {
    const paper = paperFor("arithmetic", 3, 10);
    open();
    fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
    for (let i = 0; i < 10; i++) {
      const q = paper[i];
      if (q.answer.type !== "numeric") continue;
      // Alternate right and wrong.
      fireEvent.change(box(), { target: { value: i % 2 === 0 ? String(q.answer.value) : "-99999" } });
      fireEvent.click(screen.getByRole("button", { name: /^Check/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Next question/ }));
    }
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^5\/10/);
    expect(screen.getByText("What you missed")).toBeInTheDocument();
  });
});

describe("knowing what to drill", () => {
  const attempt = (kind: Attempt["question"]["kind"], correct: boolean): Attempt => ({
    question: { id: "x", kind, prompt: "p", answer: { type: "numeric", value: 1 }, explanation: "e" },
    given: "1",
    correct,
    ms: 4000,
  });

  it("ranks kinds worst-accuracy first", () => {
    recordDrill([
      ...Array.from({ length: 10 }, () => attempt("arithmetic", true)),
      ...Array.from({ length: 5 }, () => attempt("sequence", true)),
      ...Array.from({ length: 5 }, () => attempt("sequence", false)),
    ]);
    const standings = kindStandings(getOaProgress());
    expect(standings[0].kind).toBe("sequence");
    expect(standings[0].accuracy).toBeCloseTo(0.5);
    expect(standings[0].pace).toBeCloseTo(4);
  });

  it("says nothing about a weakness it has only three questions of evidence for", () => {
    // Advice from a sample that small is noise wearing the clothes of a finding.
    recordDrill(Array.from({ length: 3 }, () => attempt("options", false)));
    expect(weakestKind(getOaProgress())).toBeUndefined();
  });

  it("names a weakness once there is a real sample behind it", () => {
    recordDrill(Array.from({ length: 20 }, (_, i) => attempt("options", i % 4 === 0)));
    expect(weakestKind(getOaProgress())?.kind).toBe("options");
  });

  it("does not call a kind you are good at a weakness", () => {
    recordDrill(Array.from({ length: 20 }, () => attempt("options", true)));
    expect(weakestKind(getOaProgress())).toBeUndefined();
  });
});
