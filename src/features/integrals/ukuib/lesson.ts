/**
 * Lesson assembly — turning (skill, crown, seed) into the ~8 exercises a student actually sees.
 *
 * The shape of a lesson is a function of its crown level, and that progression IS the pedagogy:
 * crown 0 teaches, then checks recognition, then asks for the last step of a worked solution, then
 * asks for two whole ones. By crown 4 there is no tip card, no hint, and nothing but problems. A
 * flat "pick a technique and grind" room cannot express that, which is why this module exists.
 *
 * Pure: no storage, no clock, no React. Seeded, so the same lesson can be replayed exactly — which
 * matters when a student fails a lesson and retries it, and matters more when a test wants to
 * assert on one.
 */
import type { Difficulty, Problem, TechniqueId } from "../types";
import { PROBLEMS, problemsForTechnique } from "../problems";
import { TECHNIQUE_BY_ID } from "../techniques";
import { buildValuesDeck, valuesDeckForTechnique, type FlashCard } from "../valuesDeck";
import { distractorsFor } from "../recognition";
import { shuffled } from "../rng";
import { MAX_CROWN, SKILL_BY_ID, type Skill } from "./curriculum";
import type { Exercise } from "./exercises";

/** Hearts per lesson. They refill free on exit — see UKUIB_PATH.md for why that is deliberate. */
export const HEARTS_PER_LESSON = 5;

/**
 * The recipe for each crown level: how many of each exercise type, and which difficulties the
 * problems come from. Index is the crown you are climbing FROM, so `SHAPES[0]` is a student's very
 * first lesson in a skill.
 */
export interface LessonShape {
  teach: boolean;
  recognise: number;
  order: number;
  complete: number;
  value: number;
  solve: number;
  /** Problems are drawn from these difficulties, easiest first. */
  band: Difficulty[];
  /** Interleaved problems from skills already met — spacing, not padding. */
  review: number;
  hintsAllowed: boolean;
}

export const SHAPES: LessonShape[] = [
  { teach: true, recognise: 2, order: 1, complete: 1, value: 0, solve: 2, band: [1, 2], review: 0, hintsAllowed: true },
  { teach: false, recognise: 1, order: 0, complete: 2, value: 0, solve: 4, band: [2, 3], review: 0, hintsAllowed: true },
  { teach: false, recognise: 0, order: 0, complete: 1, value: 1, solve: 5, band: [3, 4], review: 1, hintsAllowed: true },
  { teach: false, recognise: 0, order: 0, complete: 0, value: 1, solve: 6, band: [4, 5], review: 2, hintsAllowed: false },
  { teach: false, recognise: 0, order: 0, complete: 0, value: 0, solve: 8, band: [4, 5], review: 2, hintsAllowed: false },
];

export interface LessonPlan {
  skillId: string;
  /** The crown being climbed from — 0 for a first lesson. */
  crown: number;
  exercises: Exercise[];
  hearts: number;
  /** True for the legendary level, which the UI puts a clock on. */
  timed: boolean;
}

/** Everything assembly needs to know about a student, kept structural so this module stays pure. */
export interface LessonContext {
  crownOf(skillId: string): number;
  /** Skills already met, newest last — the pool interleaved review is drawn from. */
  metSkillIds: readonly string[];
}

function bandPool(technique: TechniqueId | undefined, band: Difficulty[]): Problem[] {
  const all = technique ? problemsForTechnique(technique) : PROBLEMS;
  const inBand = all.filter((p) => band.includes(p.difficulty));
  // A technique whose bank is thin at this difficulty still has to produce a lesson. Widen to the
  // whole technique before widening to the whole bank, so a Gamma lesson never quietly serves a
  // partial-fractions problem just because the hard Gamma problems ran out.
  if (inBand.length >= 4) return inBand;
  if (all.length > 0) return all;
  return PROBLEMS;
}

function valuePool(technique: TechniqueId | undefined, deck: readonly FlashCard[]): FlashCard[] {
  if (!technique) return [...deck];
  const own = valuesDeckForTechnique(deck, technique);
  return own.length >= 1 ? own : [...deck];
}

/**
 * Four options for a values card: its own back plus three from other cards, deduplicated by the
 * rendered string so a distractor can never coincidentally equal the answer.
 */
function valueOptions(card: FlashCard, deck: readonly FlashCard[], seed: number): string[] {
  const others: string[] = [];
  for (const c of shuffled(deck, seed)) {
    if (c.id === card.id) continue;
    if (c.back === card.back) continue;
    if (others.includes(c.back)) continue;
    others.push(c.back);
    if (others.length === 3) break;
  }
  return shuffled([card.back, ...others], seed + 31);
}

/**
 * Build one lesson.
 *
 * `seed` makes the draw reproducible; callers pass something stable for a given attempt (the run
 * hook uses skill + crown + a per-attempt nonce) so a retry after running out of hearts serves the
 * same lesson rather than a fresh one the student has never seen.
 */
export function planLesson(skillId: string, seed: number, ctx: LessonContext): LessonPlan {
  const skill: Skill | undefined = SKILL_BY_ID[skillId];
  const crown = Math.min(ctx.crownOf(skillId), MAX_CROWN - 1);
  const shape = SHAPES[Math.max(0, Math.min(crown, SHAPES.length - 1))];
  const exercises: Exercise[] = [];
  if (!skill) return { skillId, crown, exercises, hearts: HEARTS_PER_LESSON, timed: false };

  const technique = skill.technique;
  const lesson = technique ? TECHNIQUE_BY_ID[technique] : undefined;
  const pool = shuffled(bandPool(technique, shape.band), seed);
  let taken = 0;
  const nextProblem = (): Problem | undefined => pool[taken++ % Math.max(pool.length, 1)];

  if (shape.teach && lesson) {
    exercises.push({
      kind: "teach",
      id: `${skillId}-teach`,
      technique: lesson.id,
      exampleIndex: 0,
    });
  }

  for (let i = 0; i < shape.recognise; i++) {
    const p = nextProblem();
    if (!p) break;
    const correct = p.techniques[0];
    const options = shuffled([correct, ...distractorsFor(p, seed + i * 17)], seed + i * 23 + 5);
    exercises.push({
      kind: "recognise",
      id: `${skillId}-rec-${i}`,
      problemId: p.id,
      options,
      answer: correct,
    });
  }

  for (let i = 0; i < shape.order; i++) {
    if (!lesson || lesson.recipe.length < 3) break;
    // Four beats is enough to be a real ordering task without becoming a memory test.
    const correct = lesson.recipe.slice(0, Math.min(4, lesson.recipe.length));
    const mixed = shuffled(correct, seed + 101 + i);
    // A shuffle that happens to be the identity is not an exercise. Rotate it.
    const shuffledSteps =
      mixed.every((s, j) => s === correct[j]) && correct.length > 1
        ? [...mixed.slice(1), mixed[0]]
        : mixed;
    exercises.push({
      kind: "order",
      id: `${skillId}-ord-${i}`,
      technique: lesson.id,
      shuffled: shuffledSteps,
      correct,
    });
  }

  const completions = (lesson?.completions ?? []).filter(
    (c) => c.integrandExpr && c.resultExpr && c.domain && c.kind,
  );
  for (let i = 0; i < shape.complete && i < completions.length; i++) {
    const c = completions[i];
    exercises.push({
      kind: "complete",
      id: `${skillId}-cmp-${i}`,
      technique: lesson!.id,
      setup: c.setup,
      blank: c.blank,
      answerLatex: c.answer,
      answerExpr: c.resultExpr!,
      integralKind: c.kind!,
      domain: c.domain!,
    });
  }

  if (shape.value > 0) {
    const deck = buildValuesDeck();
    const own = valuePool(technique, deck);
    for (let i = 0; i < shape.value && own.length > 0; i++) {
      const card = shuffled(own, seed + 211 + i)[0];
      exercises.push({
        kind: "value",
        id: `${skillId}-val-${i}`,
        technique: card.technique,
        front: card.front,
        options: valueOptions(card, deck, seed + 307 + i),
        answer: card.back,
      });
    }
  }

  for (let i = 0; i < shape.solve; i++) {
    const p = nextProblem();
    if (!p) break;
    exercises.push({
      kind: "solve",
      id: `${skillId}-slv-${i}`,
      problemId: p.id,
      hintsAllowed: shape.hintsAllowed,
    });
  }

  // Interleaved review, appended last so the lesson's own material is taught before old material
  // is re-tested. Drawn from skills already met, never from this one.
  const reviewSkills = ctx.metSkillIds.filter((id) => id !== skillId);
  for (let i = 0; i < shape.review && reviewSkills.length > 0; i++) {
    const from = shuffled(reviewSkills, seed + 401 + i)[0];
    const t = SKILL_BY_ID[from]?.technique;
    const candidates = t ? problemsForTechnique(t) : PROBLEMS;
    if (candidates.length === 0) continue;
    const p = shuffled(candidates, seed + 503 + i)[0];
    exercises.push({
      kind: "solve",
      id: `${skillId}-rev-${i}`,
      problemId: p.id,
      hintsAllowed: shape.hintsAllowed,
    });
  }

  return {
    skillId,
    crown,
    exercises,
    hearts: HEARTS_PER_LESSON,
    timed: crown >= MAX_CROWN - 1,
  };
}

/** Total XP a flawless run of this plan is worth — shown on the lesson's end screen as the cap. */
export function maxXp(plan: LessonPlan, xpFor: (kind: Exercise["kind"]) => number): number {
  return plan.exercises.reduce((sum, ex) => sum + xpFor(ex.kind), 0);
}
