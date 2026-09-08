/**
 * The course's structural guarantees.
 *
 * The one that actually matters is syllabus coverage: this whole course exists to teach a specific
 * published syllabus, and "we think we covered it" is not a claim anyone should have to take on
 * trust. The list below is transcribed from UK_University_Integration_Bee_Syllabus.pdf and the test
 * fails if any item stops being taught.
 */
import { describe, expect, it } from "vitest";
import {
  courseProgress,
  MAX_CROWN,
  nextSkill,
  SKILLS,
  SKILL_BY_ID,
  skillIndex,
  skillUnlocked,
  UNITS,
  UNIT_BY_ID,
  unitOf,
  unitUnlocked,
  type CrownState,
  type UnitId,
} from "./curriculum";
import { planCheckpoint, CHECKPOINT_LENGTH } from "./checkpoint";
import { TECHNIQUE_BY_ID } from "../techniques";

/**
 * Every required item on the published syllabus. §1.x are the techniques, §2.x the specific
 * functions and results. Green's/Stokes'/Divergence are deliberately absent: the syllabus marks
 * them with an ✗ as NOT required, and teaching them would be inventing scope.
 */
const SYLLABUS_ITEMS = [
  "§1.1", // A-level and STEP integration
  "§1.2", // DUTIS, fixed limits
  "§1.3", // DUTIS, general (variable limits)
  "§1.4", // t-substitution
  "§1.5", // infinite series, swapping sum and integral
  "§1.6", // the reflection property
  "§1.7", // odd and even functions
  "§2.1", // Gamma
  "§2.2", // Euler reflection formula
  "§2.3", // Beta
  "§2.4", // Riemann zeta
  "§2.5", // floor, ceiling, fractional part
  "§2.6", // the named series
  "§2.7", // Euler-Mascheroni
  "§2.8", // Wallis' product
  "§2.9", // sine product
];

/** A CrownState backed by a plain map, for driving the unlock rules in tests. */
function state(crowns: Record<string, number> = {}, passed: UnitId[] = []): CrownState {
  return {
    crownOf: (id) => crowns[id] ?? 0,
    checkpointPassed: (unitId) => passed.includes(unitId),
  };
}

/** Every skill at one crown — "has met everything". */
const allMet = () => state(Object.fromEntries(SKILLS.map((s) => [s.id, 1])));

describe("syllabus coverage", () => {
  it("teaches every required syllabus item somewhere", () => {
    const taught = new Set(UNITS.flatMap((u) => u.syllabus));
    for (const item of SYLLABUS_ITEMS) {
      expect(taught.has(item), `${item} is on the syllabus but no unit claims it`).toBe(true);
    }
  });

  it("claims no syllabus item that isn't on the syllabus", () => {
    for (const unit of UNITS) {
      for (const item of unit.syllabus) {
        expect(SYLLABUS_ITEMS, `${unit.id} claims ${item}`).toContain(item);
      }
    }
  });
});

describe("structure", () => {
  it("gives every skill a unique id", () => {
    const ids = SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every unit a unique id", () => {
    const ids = UNITS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every skill's technique at a technique that will exist", () => {
    // The six syllabus-gap lessons are authored separately and wired into TECHNIQUES at
    // integration; until then a lookup is legitimately undefined. What must never happen is a
    // skill naming a technique id that is not in the union at all — TypeScript catches that, and
    // this test catches the runtime half for the ones already wired.
    for (const skill of SKILLS) {
      if (!skill.technique) continue;
      const lesson = TECHNIQUE_BY_ID[skill.technique];
      if (lesson) expect(lesson.id).toBe(skill.technique);
    }
  });

  it("finds the owning unit for every skill", () => {
    for (const skill of SKILLS) {
      expect(unitOf(skill.id)?.skills).toContain(skill);
    }
    expect(unitOf("not-a-skill")).toBeUndefined();
  });

  it("indexes skills along the path in unit order", () => {
    expect(skillIndex(UNITS[0].skills[0].id)).toBe(0);
    expect(skillIndex("not-a-skill")).toBe(-1);
    const last = UNITS[UNITS.length - 1].skills.slice(-1)[0];
    expect(skillIndex(last.id)).toBe(SKILLS.length - 1);
  });

  it("looks skills and units up by id", () => {
    expect(SKILL_BY_ID[SKILLS[0].id]).toBe(SKILLS[0]);
    expect(UNIT_BY_ID[UNITS[0].id]).toBe(UNITS[0]);
  });
});

describe("unlock rules", () => {
  it("opens the first unit to a brand new student", () => {
    expect(unitUnlocked(UNITS[0].id, state())).toBe(true);
  });

  it("keeps a later unit shut until the one before it has been met", () => {
    expect(unitUnlocked(UNITS[1].id, state())).toBe(false);
    const met = Object.fromEntries(UNITS[0].skills.map((s) => [s.id, 1]));
    expect(unitUnlocked(UNITS[1].id, state(met))).toBe(true);
  });

  it("opens a unit outright when the previous checkpoint has been passed", () => {
    // Nothing practised at all — but the checkpoint proves the material, so the gate lifts. This
    // is the "jump here" path, and it must not require any crowns.
    expect(unitUnlocked(UNITS[1].id, state({}, [UNITS[0].id]))).toBe(true);
  });

  it("asks only that the previous unit was MET, not mastered", () => {
    // One crown on each, not five. A wall here would make the path a chore rather than a route.
    const met = Object.fromEntries(UNITS[0].skills.map((s) => [s.id, 1]));
    expect(unitUnlocked(UNITS[1].id, state(met))).toBe(true);
  });

  it("opens the first skill of an open unit immediately", () => {
    expect(skillUnlocked(UNITS[0].skills[0].id, state())).toBe(true);
  });

  it("keeps later skills in a unit behind their predecessor", () => {
    const unit = UNITS[0];
    expect(skillUnlocked(unit.skills[1].id, state())).toBe(false);
    expect(skillUnlocked(unit.skills[1].id, state({ [unit.skills[0].id]: 1 }))).toBe(true);
  });

  it("keeps every skill of a locked unit shut, including its first", () => {
    expect(skillUnlocked(UNITS[1].skills[0].id, state())).toBe(false);
  });

  it("refuses to unlock a skill that doesn't exist", () => {
    expect(skillUnlocked("not-a-skill", allMet())).toBe(false);
  });
});

describe("where to go next", () => {
  it("points a new student at the very first skill", () => {
    expect(nextSkill(state())?.id).toBe(SKILLS[0].id);
  });

  it("skips past a skill already taken to legendary", () => {
    const s = state({ [SKILLS[0].id]: MAX_CROWN });
    expect(nextSkill(s)?.id).toBe(SKILLS[1].id);
  });

  it("returns nothing once every skill is legendary", () => {
    const done = Object.fromEntries(SKILLS.map((s) => [s.id, MAX_CROWN]));
    expect(nextSkill(state(done))).toBeUndefined();
  });
});

describe("course progress", () => {
  it("is zero for a new student and one for a finished course", () => {
    expect(courseProgress(state())).toBe(0);
    const done = Object.fromEntries(SKILLS.map((s) => [s.id, MAX_CROWN]));
    expect(courseProgress(state(done))).toBe(1);
  });

  it("counts crowns fractionally, not skills", () => {
    const one = courseProgress(state({ [SKILLS[0].id]: 1 }));
    const five = courseProgress(state({ [SKILLS[0].id]: MAX_CROWN }));
    expect(one).toBeGreaterThan(0);
    expect(five).toBeCloseTo(one * MAX_CROWN, 10);
  });

  it("never exceeds one even if a crown count somehow overshoots", () => {
    const over = Object.fromEntries(SKILLS.map((s) => [s.id, MAX_CROWN + 4]));
    expect(courseProgress(state(over))).toBe(1);
  });
});

describe("checkpoints", () => {
  it("draws a full checkpoint for every unit whose pool is deep enough", () => {
    for (const unit of UNITS) {
      const plan = planCheckpoint(unit.id, 7);
      // A unit whose techniques are still being authored can legitimately come up short; one that
      // has problems must produce a full-length test rather than a truncated one.
      if (plan.problems.length > 0) {
        expect(plan.problems.length, unit.id).toBe(CHECKPOINT_LENGTH);
      }
    }
  });

  it("draws only from its own unit's techniques", () => {
    const unit = UNIT_BY_ID["foundations"];
    const allowed = new Set(unit.skills.flatMap((s) => (s.technique ? [s.technique] : [])));
    for (const p of planCheckpoint("foundations", 3).problems) {
      expect(p.techniques.some((t) => allowed.has(t)), `${p.id} is not a Foundations problem`).toBe(
        true,
      );
    }
  });

  it("is the same ten problems on a retry", () => {
    const a = planCheckpoint("foundations", 42).problems.map((p) => p.id);
    const b = planCheckpoint("foundations", 42).problems.map((p) => p.id);
    expect(a).toEqual(b);
  });

  it("draws different problems for different seeds", () => {
    const a = planCheckpoint("foundations", 1).problems.map((p) => p.id);
    const b = planCheckpoint("foundations", 999).problems.map((p) => p.id);
    expect(a).not.toEqual(b);
  });

  it("never repeats a problem within one checkpoint", () => {
    const ids = planCheckpoint("foundations", 5).problems.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("spreads across difficulties rather than serving ten warm-ups", () => {
    const problems = planCheckpoint("foundations", 11).problems;
    const distinct = new Set(problems.map((p) => p.difficulty));
    expect(distinct.size).toBeGreaterThanOrEqual(3);
  });

  it("returns nothing for a unit that doesn't exist", () => {
    expect(planCheckpoint("not-a-unit" as UnitId, 1).problems).toEqual([]);
  });
});
