/**
 * The registry checks itself.
 *
 * Every assessment listed must actually be sittable: its sections must name generators that exist,
 * every question must build, and the clock must be survivable. A firm whose paper cannot be
 * generated is worse than a firm that is not listed.
 */
import { describe, expect, it } from "vitest";
import { ASSESSMENTS, FIRMS, FIRM_BY_ID, findAssessment, FIDELITY_NOTE } from "./firms";
import { assessmentShape, buildRun } from "./generate";
import { isCorrect } from "./grade";

describe("the registry", () => {
  it("covers the firms whose assessments are actually documented", () => {
    // The named screens the arena exists to train against.
    for (const id of ["optiver", "sig", "imc", "jane-street", "akuna", "citadel"]) {
      expect(FIRM_BY_ID[id], `${id} missing from the registry`).toBeDefined();
    }
    expect(FIRMS.length).toBeGreaterThanOrEqual(20);
  });

  it("gives every firm and assessment a unique id", () => {
    expect(new Set(FIRMS.map((f) => f.id)).size).toBe(FIRMS.length);
    const keys = ASSESSMENTS.map((a) => `${a.firmId}/${a.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every section a unique id, so two clocks can never share one", () => {
    const ids = ASSESSMENTS.flatMap((a) => a.sections.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("files every assessment under the firm that owns it", () => {
    for (const firm of FIRMS) {
      for (const a of firm.assessments) {
        expect(a.firmId).toBe(firm.id);
        expect(findAssessment(firm.id, a.id)).toBe(a);
      }
    }
  });

  it("says out loud that these are reconstructions", () => {
    expect(FIDELITY_NOTE).toMatch(/not any firm's real assessment/i);
    // Every assessment accounts for where its shape came from.
    for (const a of ASSESSMENTS) {
      expect(a.sourcing.trim().length, `${a.firmId}/${a.id} has no sourcing`).toBeGreaterThan(30);
      expect(a.rules.length, `${a.firmId}/${a.id} has no rules`).toBeGreaterThan(0);
    }
  });

  it("never invents a pass mark", () => {
    for (const a of ASSESSMENTS) {
      if (a.reportedPassMark === undefined) continue;
      expect(a.reportedPassMark).toBeGreaterThan(0);
      expect(a.reportedPassMark).toBeLessThanOrEqual(1);
      // A cutoff is only stated where the rules explain that it is reported, not measured.
      expect(a.rules.join(" ")).toMatch(/report/i);
    }
  });
});

describe("every assessment is actually sittable", () => {
  it.each(ASSESSMENTS.map((a) => [`${a.firmId}/${a.id}`, a] as const))(
    "%s builds a complete, gradeable paper",
    (key, assessment) => {
      const paper = buildRun(assessment, 12345);
      expect(paper).toHaveLength(assessment.sections.length);

      paper.forEach((questions, i) => {
        const section = assessment.sections[i];
        expect(questions, `${key} section ${section.id}`).toHaveLength(section.count);
        for (const q of questions) {
          expect(q.kind).toBe(section.kind);
          expect(q.prompt.trim()).not.toBe("");
          expect(q.explanation.trim()).not.toBe("");
          // The stored answer must pass the real grader — the same safety net the generators have.
          const own =
            q.answer.type === "choice"
              ? String(q.answer.index)
              : q.answer.type === "range"
                ? String((q.answer.low + q.answer.high) / 2)
                : String(q.answer.value);
          expect(isCorrect(q.answer, own), `${key}: ${q.prompt}`).toBe(true);
        }
      });
    },
  );

  it.each(ASSESSMENTS.map((a) => [`${a.firmId}/${a.id}`, a] as const))(
    "%s leaves a survivable amount of time per question",
    (key, assessment) => {
      for (const s of assessment.sections) {
        const perQuestion = s.seconds / s.count;
        // Six seconds is Optiver's 80-in-8, which is the tightest real screen anyone reports.
        expect(perQuestion, `${key} ${s.name} is faster than 80-in-8`).toBeGreaterThanOrEqual(6);
        expect(perQuestion, `${key} ${s.name} is not a timed section at all`).toBeLessThanOrEqual(150);
      }
      const shape = assessmentShape(assessment);
      expect(shape.questions).toBeGreaterThan(0);
      // Nothing here should be longer than an hour; a two-hour practice paper never gets sat.
      expect(shape.seconds, `${key} runs too long to be sat`).toBeLessThanOrEqual(3600);
    },
  );

  it("gives a different paper on a different seed", () => {
    const a = ASSESSMENTS[0];
    const one = buildRun(a, 1).flat().map((q) => q.prompt);
    const two = buildRun(a, 2).flat().map((q) => q.prompt);
    expect(one).not.toEqual(two);
  });

  it("gives the same paper on the same seed", () => {
    const a = ASSESSMENTS[0];
    expect(buildRun(a, 99).flat().map((q) => q.prompt)).toEqual(
      buildRun(a, 99).flat().map((q) => q.prompt),
    );
  });
});
