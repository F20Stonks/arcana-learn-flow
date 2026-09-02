import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAssessmentRun } from "./useAssessmentRun";
import type { FirmSpec, ModuleSpec } from "../types";

/**
 * Engine behaviour that only shows up once a run is driven end to end.
 *
 * The choice-label case is the one that motivated this file: a multiple-choice item is graded on
 * an opaque choice id ("opt-2"), and it would be easy — and useless — to record that id as the
 * candidate's answer. The debrief and the oa_items rows have to carry what the human actually saw.
 */

const choiceModule: ModuleSpec = {
  id: "choice-mod",
  name: "Choice module",
  kind: "arithmetic",
  blurb: "",
  rules: [],
  itemCount: 2,
  durationS: 600,
  perItemMs: null,
  input: "choice",
  negativeMarking: true,
  allowSkip: false,
  allowBack: false,
  calculator: false,
  passMark: null,
  generate: ({ index }) => ({
    id: `item-${index}`,
    tag: "add",
    prompt: `${index} + 1`,
    // The correct choice is deliberately not the first option, so a test that passed by
    // accident on ordering would fail here.
    answer: "opt-1",
    choices: [
      { id: "opt-0", label: "wrong-label" },
      { id: "opt-1", label: `right-label-${index}` },
    ],
  }),
};

const firm = (module: ModuleSpec): FirmSpec => ({
  id: "test-firm",
  name: "Test Firm",
  blurb: "",
  modules: [module],
  lastVerified: "2026-09-02",
  sourceNote: "Fixture used by the engine tests, not a real firm.",
  specVersion: 1,
});

describe("useAssessmentRun", () => {
  it("records what the candidate saw, not the choice id it graded on", () => {
    const { result } = renderHook(() => useAssessmentRun({ firm: firm(choiceModule), seed: 1 }));

    act(() => result.current.beginSection());
    act(() => result.current.submit("opt-1")); // correct
    act(() => result.current.submit("opt-0")); // wrong

    const items = result.current.result!.sections[0].items;
    expect(items[0].given).toBe("right-label-0");
    expect(items[0].expected).toBe("right-label-0");
    expect(items[0].correct).toBe(true);

    expect(items[1].given).toBe("wrong-label");
    expect(items[1].expected).toBe("right-label-1");
    expect(items[1].correct).toBe(false);

    // Graded on the id, so negative marking still nets to zero over one right and one wrong.
    expect(result.current.result!.sections[0].rawScore).toBe(0);
  });

  it("counts an unreached question as skipped rather than wrong", () => {
    const { result } = renderHook(() => useAssessmentRun({ firm: firm(choiceModule), seed: 1 }));

    act(() => result.current.beginSection());
    act(() => result.current.submit("opt-1"));
    act(() => result.current.abandon());

    const section = result.current.result!.sections[0];
    expect(section.correct).toBe(1);
    expect(section.wrong).toBe(0);
    expect(section.skipped).toBe(1);
    expect(section.items[1].given).toBe("");
  });

  it("holds every result back until the run is over", () => {
    const { result } = renderHook(() => useAssessmentRun({ firm: firm(choiceModule), seed: 1 }));

    act(() => result.current.beginSection());
    act(() => result.current.submit("opt-1"));

    // One question answered, one to go: a real assessment reveals nothing at this point, and
    // neither does the hook.
    expect(result.current.result).toBeNull();
    expect(result.current.status).toBe("running");
  });

  it("reproduces the same paper from the same seed", () => {
    const prompts = () => {
      const { result } = renderHook(() => useAssessmentRun({ firm: firm(choiceModule), seed: 99 }));
      act(() => result.current.beginSection());
      return result.current.items.map((i) => i.prompt);
    };
    expect(prompts()).toEqual(prompts());
  });
});
