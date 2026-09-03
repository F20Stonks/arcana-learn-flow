/**
 * Lesson assembly and exercise grading.
 *
 * Black-box against the documented behaviour: what a lesson is *shaped* like at each crown, and
 * what each exercise type accepts. The point of the shape tests is that the scaffolding really does
 * fall away — a crown-4 lesson that still shipped a tip card and hints would look fine on screen
 * and quietly be the same lesson as crown 0.
 */
import { describe, expect, it } from "vitest";
import { HEARTS_PER_LESSON, planLesson, SHAPES, maxXp, type LessonContext } from "./lesson";
import { EXERCISE_XP, gradeExercise, isScored, type Exercise } from "./exercises";
import { MAX_CROWN, SKILLS, UNITS } from "./curriculum";

function ctx(crowns: Record<string, number> = {}, met: string[] = []): LessonContext {
  return { crownOf: (id) => crowns[id] ?? 0, metSkillIds: met };
}

/** A skill that definitely has a real technique and a real problem pool behind it. */
const BASE = UNITS[0].skills[0].id;

const kinds = (ex: Exercise[]) => ex.map((e) => e.kind);

describe("lesson shape by crown", () => {
  it("teaches on a student's very first lesson in a skill", () => {
    const plan = planLesson(BASE, 1, ctx());
    expect(plan.exercises[0].kind).toBe("teach");
    expect(plan.crown).toBe(0);
  });

  it("stops teaching once the first crown is in", () => {
    const plan = planLesson(BASE, 1, ctx({ [BASE]: 1 }));
    expect(kinds(plan.exercises)).not.toContain("teach");
  });

  it("withdraws hints as the crown rises", () => {
    const early = planLesson(BASE, 1, ctx({ [BASE]: 0 }));
    const late = planLesson(BASE, 1, ctx({ [BASE]: 3 }));
    const hintFlags = (p: ReturnType<typeof planLesson>) =>
      p.exercises.filter((e) => e.kind === "solve").map((e) => (e as { hintsAllowed: boolean }).hintsAllowed);
    expect(hintFlags(early).every(Boolean)).toBe(true);
    expect(hintFlags(late).some(Boolean)).toBe(false);
  });

  it("puts a clock on the legendary level only", () => {
    expect(planLesson(BASE, 1, ctx({ [BASE]: 0 })).timed).toBe(false);
    expect(planLesson(BASE, 1, ctx({ [BASE]: MAX_CROWN - 1 })).timed).toBe(true);
  });

  it("leans harder on solving the further up the skill you are", () => {
    const solveCount = (crown: number) =>
      planLesson(BASE, 1, ctx({ [BASE]: crown })).exercises.filter((e) => e.kind === "solve").length;
    expect(solveCount(MAX_CROWN - 1)).toBeGreaterThan(solveCount(0));
  });

  it("hands out five hearts whatever the crown", () => {
    for (let c = 0; c < MAX_CROWN; c++) {
      expect(planLesson(BASE, 1, ctx({ [BASE]: c })).hearts).toBe(HEARTS_PER_LESSON);
    }
  });

  it("clamps a crown past the top back onto the last shape rather than crashing", () => {
    const plan = planLesson(BASE, 1, ctx({ [BASE]: 99 }));
    expect(plan.exercises.length).toBeGreaterThan(0);
    expect(plan.crown).toBe(MAX_CROWN - 1);
  });
});

describe("assembly", () => {
  it("is deterministic for the same seed", () => {
    const a = planLesson(BASE, 77, ctx());
    const b = planLesson(BASE, 77, ctx());
    expect(a.exercises).toEqual(b.exercises);
  });

  it("draws differently for different seeds", () => {
    const a = planLesson(BASE, 1, ctx());
    const b = planLesson(BASE, 2, ctx());
    expect(a.exercises).not.toEqual(b.exercises);
  });

  it("produces something for every skill on the path without throwing", () => {
    for (const skill of SKILLS) {
      for (let crown = 0; crown < MAX_CROWN; crown++) {
        const plan = planLesson(skill.id, 5, ctx({ [skill.id]: crown }));
        // A skill whose lesson and bank are still being authored can legitimately come up short;
        // it must never crash, and it must never produce a lesson with a duplicate exercise id.
        const ids = plan.exercises.map((e) => e.id);
        expect(new Set(ids).size, `${skill.id} crown ${crown}`).toBe(ids.length);
      }
    }
  });

  it("returns an empty plan for a skill that doesn't exist", () => {
    const plan = planLesson("not-a-skill", 1, ctx());
    expect(plan.exercises).toEqual([]);
    expect(plan.hearts).toBe(HEARTS_PER_LESSON);
  });

  it("never ships a recognise exercise — cut after real feedback that guessing a label before solving anything teaches guessing, not integration", () => {
    for (const skill of SKILLS) {
      for (let crown = 0; crown < MAX_CROWN; crown++) {
        const plan = planLesson(skill.id, 3, ctx({ [skill.id]: crown }));
        expect(plan.exercises.some((e) => e.kind === "recognise"), `${skill.id} crown ${crown}`).toBe(
          false,
        );
      }
    }
  });

  it("never ships an ordering exercise that is already in the right order", () => {
    // A shuffle can legitimately come back as the identity; that is not an exercise, it's a
    // free point. Sweep every skill and seed combination that produces one.
    for (const skill of SKILLS) {
      for (let seed = 1; seed <= 12; seed++) {
        const plan = planLesson(skill.id, seed, ctx());
        for (const e of plan.exercises) {
          if (e.kind !== "order") continue;
          const ex = e as Extract<Exercise, { kind: "order" }>;
          expect(
            ex.shuffled.every((s, i) => s === ex.correct[i]),
            `${skill.id} seed ${seed} shipped an already-ordered exercise`,
          ).toBe(false);
        }
      }
    }
  });

  it("gives every value exercise four distinct options containing the answer", () => {
    for (const skill of SKILLS) {
      const plan = planLesson(skill.id, 9, ctx({ [skill.id]: 2 }));
      for (const e of plan.exercises) {
        if (e.kind !== "value") continue;
        const ex = e as Extract<Exercise, { kind: "value" }>;
        expect(new Set(ex.options).size, `${skill.id} value options not distinct`).toBe(
          ex.options.length,
        );
        expect(ex.options).toContain(ex.answer);
      }
    }
  });
});

describe("interleaved review", () => {
  it("adds nothing for a student who has met nothing else", () => {
    const plan = planLesson(BASE, 1, ctx({ [BASE]: 2 }, []));
    expect(plan.exercises.filter((e) => e.id.includes("-rev-"))).toHaveLength(0);
  });

  it("resurfaces earlier skills once there are some, at the crowns that call for it", () => {
    const other = SKILLS[1].id;
    const plan = planLesson(BASE, 1, ctx({ [BASE]: 2 }, [other]));
    const reviews = plan.exercises.filter((e) => e.id.includes("-rev-"));
    expect(reviews.length).toBe(SHAPES[2].review);
  });

  it("never reviews the skill currently being drilled", () => {
    const plan = planLesson(BASE, 1, ctx({ [BASE]: 3 }, [BASE]));
    expect(plan.exercises.filter((e) => e.id.includes("-rev-"))).toHaveLength(0);
  });
});

describe("grading", () => {
  it("never charges a heart for reading", () => {
    expect(isScored({ kind: "teach", id: "t", technique: "power", exampleIndex: 0 })).toBe(false);
  });

  it("marks a recognise answer right only for the tagged technique", () => {
    const ex: Exercise = {
      kind: "recognise",
      id: "r",
      problemId: "p",
      options: ["power", "u-sub", "parts", "t-sub"],
      answer: "u-sub",
    };
    expect(gradeExercise(ex, { kind: "recognise", choice: "u-sub" }).correct).toBe(true);
    expect(gradeExercise(ex, { kind: "recognise", choice: "power" }).correct).toBe(false);
  });

  it("marks an ordering right only in the exact order", () => {
    const ex: Exercise = {
      kind: "order",
      id: "o",
      technique: "power",
      shuffled: ["b", "a"],
      correct: ["a", "b"],
    };
    expect(gradeExercise(ex, { kind: "order", ordering: ["a", "b"] }).correct).toBe(true);
    expect(gradeExercise(ex, { kind: "order", ordering: ["b", "a"] }).correct).toBe(false);
    expect(gradeExercise(ex, { kind: "order", ordering: ["a"] }).correct).toBe(false);
  });

  it("grades a completion through the real grader, constant of integration and all", () => {
    const ex: Exercise = {
      kind: "complete",
      id: "c",
      technique: "power",
      setup: [],
      blank: "",
      answerLatex: "\\frac{x^3}{3}",
      answerExpr: "x^3/3",
      integralKind: "indefinite",
      domain: [1, 3],
    };
    // The whole point of reusing answer.ts: an antiderivative differing by a constant is correct,
    // and a student who writes it a different way must not be told they are wrong.
    expect(gradeExercise(ex, { kind: "complete", input: "x^3/3" }).correct).toBe(true);
    expect(gradeExercise(ex, { kind: "complete", input: "x^3/3 + 5" }).correct).toBe(true);
    expect(gradeExercise(ex, { kind: "complete", input: "x^2/2" }).correct).toBe(false);
  });

  it("reports the off-by-a-constant-factor verdict rather than a bare wrong", () => {
    const ex: Exercise = {
      kind: "complete",
      id: "c",
      technique: "power",
      setup: [],
      blank: "",
      answerLatex: "\\frac{x^3}{3}",
      answerExpr: "x^3/3",
      integralKind: "indefinite",
      domain: [1, 3],
    };
    const result = gradeExercise(ex, { kind: "complete", input: "2*x^3/3" });
    expect(result.correct).toBe(false);
    expect(result.verdict?.status).toBe("off-by-constant-factor");
  });

  it("grades a definite completion by value", () => {
    const ex: Exercise = {
      kind: "complete",
      id: "c",
      technique: "gamma-function",
      setup: [],
      blank: "",
      answerLatex: "6",
      answerExpr: "6",
      integralKind: "definite",
      domain: [0, Infinity],
    };
    expect(gradeExercise(ex, { kind: "complete", input: "6" }).correct).toBe(true);
    expect(gradeExercise(ex, { kind: "complete", input: "3*2" }).correct).toBe(true);
    expect(gradeExercise(ex, { kind: "complete", input: "7" }).correct).toBe(false);
  });

  it("refuses a response of the wrong shape rather than crediting it", () => {
    const ex: Exercise = {
      kind: "recognise",
      id: "r",
      problemId: "p",
      options: ["power"],
      answer: "power",
    };
    expect(gradeExercise(ex, { kind: "value", choice: "power" }).correct).toBe(false);
  });
});

describe("xp", () => {
  it("pays more for solving than for recognising, and nothing for reading", () => {
    expect(EXERCISE_XP.solve).toBeGreaterThan(EXERCISE_XP.recognise);
    expect(EXERCISE_XP.teach).toBe(0);
  });

  it("totals a plan's cap from its own exercises", () => {
    const plan = planLesson(BASE, 4, ctx());
    const expected = plan.exercises.reduce((s, e) => s + EXERCISE_XP[e.kind], 0);
    expect(maxXp(plan, (k) => EXERCISE_XP[k])).toBe(expected);
  });
});
