/**
 * LLM rubric grader — the semantic half of the harness. Scores each scene
 * against the Director's own four-bar contract and classifies failures into
 * a FIXED taxonomy so failure classes aggregate across runs.
 *
 * Honesty note (report this with results): the grader judges the scene
 * JSON — composition, mechanism, manipulability — not rendered pixels.
 * Renderer correctness is covered separately by the deterministic validator
 * plus the DevScenes bench. And the grader is itself a model: treat single
 * grades as evidence, aggregated failure CLASSES as the signal.
 */
import { callChatFn } from "./director";
import { parseModelJson } from "../../src/lib/vizExtract";
import type { SceneSpec } from "../../src/lib/sceneSpec";
import type { BatteryConcept } from "./battery";
import type { ValidationReport } from "../../src/lib/sceneValidate";

export const FAILURE_CLASSES = [
  "off-concept", // scene is about something else
  "result-not-mechanism", // shows the finished fact, not the moving parts that force it
  "no-manipulable", // nothing to move, or nothing load-bearing to move
  "inert-manipulable", // control exists but changes nothing structural
  "dishonest-geometry", // distances/angles/relations not actually true
  "illegible-clutter", // too much, labels drowning the argument
  "wrong-form", // e.g. 3D camera over planar content, graph where construction was needed
  "missing-capability", // the ideal scene needs expressive power the primitives lack
  "degenerate-fallback", // technically valid but near-empty / axis-only filler
  "overreach-nonspatial", // padded a non-spatial idea into a fake elaborate scene
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

export interface Grade {
  mechanism: number;
  manipulation: number;
  honesty: number;
  legibility: number;
  verdict: "pass" | "weak" | "fail";
  failure_classes: FailureClass[];
  missing_capability: string | null;
  note: string;
}

const GRADER_PROMPT = `You are the SCENE QUALITY AUDITOR for Cortexed, an elite maths/physics tutor whose Scene Director composes interactive teaching scenes from a primitive language. You receive one scene request (what the tutor wanted taught), the exact scene JSON that will render, and mechanical validator stats. You judge whether this scene TEACHES.

THE FOUR BARS (the Director's own contract — judge against these and nothing else):
1. MECHANISM (0-3): does the scene show the moving parts that FORCE the conclusion, or just a picture of the finished fact? 3 = the why is visibly forced; 2 = mechanism present but partly told-not-shown; 1 = mostly result/decoration; 0 = no mechanism at all or wrong concept.
2. MANIPULATION (0-3): is there a manipulable that could FALSIFY the claim, where the student watches it survive? 3 = the manipulation IS the proof becoming tangible; 2 = load-bearing but indirect; 1 = a control exists but changes nothing structural; 0 = nothing meaningful to move. EXCEPTION: for a genuinely non-spatial concept, a deliberately minimal scene without a manipulable may still score 2 here IF restraint was the right call.
3. HONESTY (0-3): every distance/angle/scale/relationship true? Deduct for fake geometry, cosmetic curves, decorative motion, or claims in labels the scene doesn't actually demonstrate.
4. LEGIBILITY (0-3): one idea, ≤4 colours + single accent on the load-bearing object, only labels that carry the argument, sane framing.

THE PRIMITIVE LANGUAGE the Director composes from (for judging missing-capability):
point (draggable, constrainable via projection), bulk points with indexed x/y/i-exprs + colorBy, curve (parametric, sliders/time in exprs), segment, arc, angleMark, surface, vectorField, arrow, polygon, grid, axes, text (KaTeX), group (matrix transform, exprs allowed); sliders; step-staging with per-primitive step tags; time animation. NOTABLE ABSENCES today: no labelled edge/connector between arbitrary anchors, no region-fill between curves, no primitive whose COUNT varies with a slider (counts are fixed at authoring time), no number-line-with-brackets primitive, no bar-chart primitive. If the concept's OPTIMAL scene needs one of these (or another genuinely missing power), say so in missing_capability even when the Director found a workaround — name the capability generically (e.g. "labelled connector between anchors"), never a per-concept template.

VERDICT: "pass" = all four bars ≥2 and the scene genuinely teaches this concept. "weak" = teaches something but a bar is at 1, or the mechanism is diluted. "fail" = any bar at 0, or off-concept, or a student would learn nothing true from it.

failure_classes: zero or more from EXACTLY this list: ${FAILURE_CLASSES.join(", ")}.

OUTPUT: strict JSON only, no prose, no code fences:
{"mechanism":n,"manipulation":n,"honesty":n,"legibility":n,"verdict":"pass|weak|fail","failure_classes":[...],"missing_capability":"...generic capability or null","note":"<=25 words, the single most useful observation"}`;

export async function gradeScene(
  c: BatteryConcept,
  scene: SceneSpec,
  validation: ValidationReport,
): Promise<Grade | null> {
  const user = `SCENE REQUEST (level: ${c.level}, subject: ${c.subject}, topic: ${c.topic} / ${c.subtopic}):
${c.request}

SCENE JSON AS IT WILL RENDER (post-sanitizer):
${JSON.stringify(scene)}

VALIDATOR STATS:
- primitives: ${validation.primCount} (${Object.entries(validation.kindsUsed)
    .map(([k, n]) => `${k}×${n}`)
    .join(", ")})
- interaction: ${validation.interaction.sliders} slider(s), ${validation.interaction.draggedPoints} draggable point(s), uses time: ${validation.interaction.usesTime}
- expression issues: ${validation.exprIssues.length === 0 ? "none" : validation.exprIssues.map((i) => `${i.kind}@${i.where}`).join("; ")}
- flags: ${validation.flags.length ? validation.flags.join(", ") : "none"}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callChatFn(GRADER_PROMPT, user);
      const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) continue;
      const g = parseModelJson(m[0]) as Grade | null;
      if (
        g &&
        typeof g === "object" &&
        ["pass", "weak", "fail"].includes(g.verdict) &&
        [g.mechanism, g.manipulation, g.honesty, g.legibility].every(
          (n) => typeof n === "number" && n >= 0 && n <= 3,
        )
      ) {
        g.failure_classes = Array.isArray(g.failure_classes)
          ? (g.failure_classes.filter((f) => (FAILURE_CLASSES as readonly string[]).includes(f)) as FailureClass[])
          : [];
        g.missing_capability = typeof g.missing_capability === "string" ? g.missing_capability : null;
        g.note = typeof g.note === "string" ? g.note : "";
        return g;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}
