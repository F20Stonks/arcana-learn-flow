import { describe, expect, it } from "vitest";
import { buildErrorProfile, classifyError, ERROR_CLASSES, type ErrorClass } from "./errorTaxonomy";
import { gradeAnswer } from "./answer";
import { PROBLEMS } from "./problems";
import type { AttemptRecord } from "./attempts";
import type { Problem } from "./types";

function baseProblem(over: Partial<Problem> & { id: string }): Problem {
  return {
    kind: "indefinite",
    integrand: "x",
    integrandExpr: "x",
    answer: "x^2/2",
    answerLatex: "x^2/2",
    domain: [1, 5],
    difficulty: 3,
    techniques: ["power"],
    source: { name: "original" },
    hints: [],
    steps: [],
    ...over,
  };
}

/** Grades `input` for real (through the untouched, live gradeAnswer) and classifies the result —
 *  the same two-step path a real submission takes, end to end. */
function classify(problem: Problem, input: string): ErrorClass | null {
  return classifyError(problem, gradeAnswer(problem, input), input);
}

// ── the required regression guard ─────────────────────────────────────────────────────────────
//
// "This must not change what counts as correct" — the whole bank's own stored answers must still
// grade correct, unedited and unclassified, exactly as problems.test.ts already requires of them
// for a different reason. This is the same guarantee from the taxonomy's own side: nothing in this
// module can turn a correct answer into a labelled "error".

describe("classifyError — never touches a correct answer", () => {
  it("every problem's own stored answer grades correct and is never classified", () => {
    const bad: string[] = [];
    for (const p of PROBLEMS) {
      const verdict = gradeAnswer(p, p.answer);
      const cls = classifyError(p, verdict, p.answer);
      if (verdict.status !== "correct" || cls !== null) bad.push(`${p.id}: verdict=${verdict.status} class=${cls}`);
    }
    expect(bad).toEqual([]);
  });

  it("returns null for a correct verdict even if called directly (defensive)", () => {
    const p = baseProblem({ id: "defensive-correct" });
    expect(classifyError(p, { status: "correct" }, "x^2/2")).toBeNull();
  });

  it("returns null for an unparseable verdict — a typo isn't a classified error", () => {
    const p = baseProblem({ id: "defensive-unparseable" });
    expect(
      classifyError(p, { status: "unparseable", reason: "Nothing to grade yet." }, ""),
    ).toBeNull();
  });
});

// ── constant-factor / sign-flip ───────────────────────────────────────────────────────────────
//
// Both reuse answer.ts's own off-by-constant-factor detection directly — no separate numeric work.

describe("classifyError — constant-factor and sign-flip", () => {
  it("classifies a negated real bank answer as sign-flip", () => {
    const p = PROBLEMS.find((p) => p.kind === "indefinite")!;
    expect(classify(p, `-(${p.answer})`)).toBe("sign-flip");
  });

  it("classifies a doubled real bank answer as constant-factor, not sign-flip", () => {
    const p = PROBLEMS.find((p) => p.kind === "indefinite" && p.answer !== "0")!;
    expect(classify(p, `2*(${p.answer})`)).toBe("constant-factor");
  });

  it("draws the sign-flip/constant-factor line near -1, not just at exactly -1", () => {
    const p = baseProblem({ id: "factor-line", answer: "x^2/2", domain: [1, 5] });
    // The nearest *other* simple ratio (den <= 12, per answer.ts's own asSimpleRatio) to -1 is
    // -11/12, about 0.083 away — comfortably outside SIGN_FLIP_TOLERANCE (0.02), so this is the
    // closest real "off by a clean constant, but not -1" case the grader can ever actually
    // produce, not an arbitrarily-picked value.
    expect(classify(p, "(-11/12)*(x^2/2)")).toBe("constant-factor");
  });
});

// ── missing-absolute-value ────────────────────────────────────────────────────────────────────

describe("classifyError — missing-absolute-value", () => {
  const logProblem = baseProblem({
    id: "abs-value-log",
    integrand: "\\frac{1}{x}",
    integrandExpr: "1/x",
    answer: "log(abs(x))",
    answerLatex: "\\ln|x|",
    // Skewed so the still-defined (positive) side is the minority of the domain — see
    // errorTaxonomy.ts's RELAXED_SAMPLE_COUNT comment for why the skew is deliberate: too
    // balanced a domain and answer.ts's own live check happens to gather >= 5 usable points on
    // the shared side and grades log(x) correct outright, never reaching this classifier at all.
    domain: [-3, 1],
  });

  it("flags a dropped abs() on a log whose domain crosses the sign change", () => {
    expect(classify(logProblem, "log(x)")).toBe("missing-absolute-value");
  });

  it("grades the same dropped-abs answer correct outright on a domain that never needs it", () => {
    const allPositive = { ...logProblem, domain: [1, 5] as [number, number] };
    expect(gradeAnswer(allPositive, "log(x)").status).toBe("correct");
  });

  it("does not fire without the textual bare-log signal, even with a real domain gap", () => {
    // sqrt(x) on a domain crossing zero has exactly the same "reference-defined, user-undefined"
    // shape as the log case, but nothing about it is a missing-absolute-value mistake.
    const p = baseProblem({
      id: "abs-value-sqrt-decoy",
      answer: "(2/3)*x^(3/2)",
      answerLatex: "\\frac23x^{3/2}",
      domain: [-3, 1],
    });
    expect(classify(p, "x^2")).not.toBe("missing-absolute-value");
  });
});

// ── right-family-wrong-parameter ──────────────────────────────────────────────────────────────

describe("classifyError — right-family-wrong-parameter", () => {
  it("flags a wrong coefficient inside an otherwise-identical trig antiderivative", () => {
    const p = baseProblem({
      id: "family-sin",
      integrand: "\\cos(3x)",
      integrandExpr: "cos(3*x)",
      answer: "sin(3*x)/3",
      answerLatex: "\\sin(3x)/3",
      domain: [0.1, 1],
    });
    expect(classify(p, "sin(2*x)/3")).toBe("right-family-wrong-parameter");
  });

  it("flags a wrong constant inside an otherwise-identical definite closed form", () => {
    // sqrt(2)/4 vs sqrt(3)/4 — deliberately not a clean rational ratio (unlike e.g. pi/3 vs
    // pi/4 = 4/3), so the higher-priority off-by-constant-factor check doesn't claim it first.
    const p = baseProblem({
      id: "family-sqrt",
      kind: "definite",
      answer: "sqrt(3)/4",
      answerLatex: "\\sqrt3/4",
      domain: [0, 1],
    });
    expect(classify(p, "sqrt(2)/4")).toBe("right-family-wrong-parameter");
  });

  it("does not fire when the shape genuinely differs, not just a literal", () => {
    const p = baseProblem({
      id: "family-shape-mismatch",
      integrand: "\\cos(x)",
      integrandExpr: "cos(x)",
      answer: "sin(x)",
      answerLatex: "\\sin(x)",
      domain: [0.2, 1],
    });
    expect(classify(p, "cos(x)")).not.toBe("right-family-wrong-parameter");
  });
});

// ── correct-but-unsimplified ───────────────────────────────────────────────────────────────────
//
// Tests the classifier's own logic given a controlled (problem, verdict, input) triple — a
// genuinely equivalent answer under a verdict forced to "incorrect" — rather than hunting for a
// live case where answer.ts's real strict tolerance actually produces a false negative. That
// keeps this test about classifyError's contract (a pure function of its three arguments)
// independent of whether such a live mismatch exists today.

describe("classifyError — correct-but-unsimplified", () => {
  it("flags a genuinely equivalent answer even when the verdict passed in says incorrect", () => {
    const p = baseProblem({ id: "unsimplified-equiv", answer: "x^2/2 + 3", domain: [1, 5] });
    expect(classifyError(p, { status: "incorrect" }, "x^2/2 + 3.0000001")).toBe("correct-but-unsimplified");
  });

  it("does not fire for a genuinely wrong answer forced through the same path", () => {
    const p = baseProblem({ id: "unsimplified-decoy", answer: "x^2/2", domain: [1, 5] });
    expect(classifyError(p, { status: "incorrect" }, "x^3/3")).not.toBe("correct-but-unsimplified");
  });

  it("takes priority over missing-absolute-value when the domain gap is negligible, not real", () => {
    // Same log(x)-vs-log(abs(x)) family as the missing-absolute-value tests above, but on a
    // domain that barely dips negative — a couple of stray gap points, not the real, substantial
    // domain split that test suite is about. Confirms the two classes are mutually exclusive by
    // gapCount, not just by which one happens to run first.
    const p = baseProblem({
      id: "unsimplified-vs-abs-value",
      answer: "log(abs(x))",
      answerLatex: "\\ln|x|",
      domain: [-0.02, 5],
    });
    const cls = classify(p, "log(x)");
    expect(cls === "correct-but-unsimplified" || cls === null).toBe(true);
    expect(cls).not.toBe("missing-absolute-value");
  });
});

// ── wrong-method ───────────────────────────────────────────────────────────────────────────────

describe("classifyError — wrong-method", () => {
  it("flags an answer built from entirely different functions than the reference needs", () => {
    const p = baseProblem({
      id: "method-trig",
      integrand: "\\cos(x)",
      integrandExpr: "cos(x)",
      answer: "sin(x)",
      answerLatex: "\\sin(x)",
      domain: [0.2, 1],
    });
    expect(classify(p, "x^2/2")).toBe("wrong-method");
  });

  it("does not fire when the reference itself uses no functions to compare against", () => {
    const p = baseProblem({ id: "method-no-reference-fns", answer: "x^2/2", domain: [1, 5] });
    expect(classify(p, "x^7 - 3")).not.toBe("wrong-method");
  });

  it("does not fire when the student's answer shares at least one function with the reference", () => {
    const p = baseProblem({
      id: "method-shared-fn",
      integrand: "\\cos(x)",
      integrandExpr: "cos(x)",
      answer: "sin(x)",
      answerLatex: "\\sin(x)",
      domain: [0.2, 1],
    });
    // Wrong, but at least reaches for the same family of function — not "no idea", just imprecise.
    expect(classify(p, "sin(x^2)")).not.toBe("wrong-method");
  });
});

// ── the honest fallback ────────────────────────────────────────────────────────────────────────

describe("classifyError — everything else stays unclassified", () => {
  it("returns null for a wrong answer that matches none of the six patterns", () => {
    const p = baseProblem({ id: "plain-wrong", answer: "x^2/2", domain: [1, 5] });
    expect(classify(p, "x^7 - 3")).toBeNull();
  });

  it("only ever returns one of the six documented classes, or null", () => {
    const cases: Array<[Problem, string]> = [
      [PROBLEMS.find((p) => p.kind === "indefinite")!, "0"],
      [PROBLEMS.find((p) => p.kind === "definite")!, "0"],
      [PROBLEMS[10], "999999"],
      [PROBLEMS[20], "-1"],
    ];
    for (const [p, input] of cases) {
      const cls = classify(p, input);
      expect(cls === null || ERROR_CLASSES.includes(cls)).toBe(true);
    }
  });
});

// ── the profile ────────────────────────────────────────────────────────────────────────────────

function attemptRecord(
  problemId: string,
  submitted: string,
  verdictClass: AttemptRecord["verdictClass"] = "incorrect",
): AttemptRecord {
  return {
    id: `test-${problemId}-${submitted}-${Math.random()}`,
    problemId,
    mode: "training",
    at: new Date().toISOString(),
    verdictClass,
    submitted,
    hintsOpen: 0,
    wrongAttemptsSoFar: 0,
    msToFirstKeystroke: null,
    msFirstKeystrokeToSubmit: null,
  };
}

describe("buildErrorProfile", () => {
  it("ignores correct and unparseable attempts entirely", () => {
    const p = PROBLEMS.find((p) => p.kind === "indefinite")!;
    const profile = buildErrorProfile([
      attemptRecord(p.id, p.answer, "correct"),
      attemptRecord(p.id, "", "unparseable"),
    ]);
    expect(profile.consideredAttempts).toBe(0);
    expect(profile.classifiedAttempts).toBe(0);
    expect(profile.dominant).toBeNull();
    expect(profile.byTechnique).toEqual([]);
  });

  it("tallies classified attempts overall and finds the dominant class", () => {
    const p = PROBLEMS.find((p) => p.kind === "indefinite")!;
    const profile = buildErrorProfile([
      attemptRecord(p.id, `-(${p.answer})`), // sign-flip
      attemptRecord(p.id, `-(${p.answer})`), // sign-flip again
      attemptRecord(p.id, `2*(${p.answer})`), // constant-factor
    ]);
    expect(profile.consideredAttempts).toBe(3);
    expect(profile.classifiedAttempts).toBe(3);
    expect(profile.counts["sign-flip"]).toBe(2);
    expect(profile.counts["constant-factor"]).toBe(1);
    expect(profile.dominant).toBe("sign-flip");
  });

  it("breaks the tally down per (primary) technique", () => {
    const p = PROBLEMS.find((p) => p.kind === "indefinite")!;
    const primary = p.techniques[0];
    const profile = buildErrorProfile([
      attemptRecord(p.id, `-(${p.answer})`),
      attemptRecord(p.id, `2*(${p.answer})`),
    ]);
    const techProfile = profile.byTechnique.find((t) => t.technique === primary);
    expect(techProfile?.total).toBe(2);
    expect(techProfile?.counts["sign-flip"]).toBe(1);
    expect(techProfile?.counts["constant-factor"]).toBe(1);
  });

  it("sorts byTechnique with the most-classified technique first", () => {
    const a = PROBLEMS.find((p) => p.kind === "indefinite")!;
    const b = PROBLEMS.find((p) => p.kind === "indefinite" && p.techniques[0] !== a.techniques[0]);
    if (!b) return; // the real bank has plenty of technique variety; don't hard-fail if that ever changes
    const profile = buildErrorProfile([
      attemptRecord(a.id, `-(${a.answer})`),
      attemptRecord(b.id, `-(${b.answer})`),
      attemptRecord(b.id, `2*(${b.answer})`),
    ]);
    expect(profile.byTechnique[0].technique).toBe(b.techniques[0]);
    expect(profile.byTechnique[0].total).toBe(2);
  });

  it("skips an attempt on a problem id no longer in the bank, without crashing", () => {
    expect(() => buildErrorProfile([attemptRecord("this-id-does-not-exist", "0")])).not.toThrow();
    expect(buildErrorProfile([attemptRecord("this-id-does-not-exist", "0")]).consideredAttempts).toBe(0);
  });

  it("counts an unclassifiable wrong attempt toward consideredAttempts but not classifiedAttempts", () => {
    // buildErrorProfile looks problems up in the real PROBLEM_BY_ID, so (unlike classify() above)
    // this needs an id that's actually in the bank. power-monomial's answer (x^6/6) has no
    // function calls in it at all, so wrong-method structurally can't fire for it — confirmed
    // against the real bank, not assumed.
    const p = PROBLEMS.find((p) => p.id === "power-monomial")!;
    const profile = buildErrorProfile([attemptRecord(p.id, "x^7 - 3")]);
    expect(profile.consideredAttempts).toBe(1);
    expect(profile.classifiedAttempts).toBe(0);
  });
});
