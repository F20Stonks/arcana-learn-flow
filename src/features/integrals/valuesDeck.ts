/**
 * The values deck (WS-6, UK_BEE_BURST.md) — flashcards for the memorised results.
 *
 * Sourced only from content already in the repo, per standing directive #2 in CLAUDE.md: every
 * definite problem already in the bank (a definite integral's value is exactly the kind of thing
 * worth having cold), plus every worked example in techniques.ts that states a literal evaluable
 * result (`resultExpr` set — the WS-2 "machine-checkable-mirror" convention, which already
 * distinguishes a stated closed-form value from a qualitative aside or a pure derivation). No new
 * problem, example or fact is authored here — this only re-presents what's already written down.
 */
import { PROBLEMS } from "./problems";
import { integralLatex } from "./latex";
import { TECHNIQUES } from "./techniques";
import type { TechniqueId, WorkedExample } from "./types";

export interface FlashCard {
  id: string;
  front: string;
  back: string;
  technique: TechniqueId;
  source: "bank" | "lesson";
}

/**
 * Deliberately the exact same wrapping LessonBody.tsx's own ExampleCard already uses (`\int
 * ${integrand}\,dx`, no bounds ever added), not a "richer" version of it. A definite example's
 * `domain` looked like free bound-rendering material at first, but at least one existing example
 * (feynman's Frullani integral) already writes its domain straight into `integrand` as prose —
 * `"... \text{ on } [0,\infty)"` — for exactly this rendering, so adding `_{0}^{\infty}` on top
 * would double it up. Matching the established convention exactly avoids guessing per example
 * which ones already embed their own domain text and which don't.
 */
function exampleFront(example: WorkedExample): string {
  return `\\int ${example.integrand}\\,dx`;
}

function cardsFromBank(): FlashCard[] {
  return PROBLEMS.filter((p) => p.kind === "definite").map((p) => ({
    id: `bank:${p.id}`,
    front: integralLatex(p),
    back: p.answerLatex,
    technique: p.techniques[0],
    source: "bank" as const,
  }));
}

function cardsFromLessons(): FlashCard[] {
  return TECHNIQUES.flatMap((technique) => {
    // Same fallback LessonBody.tsx itself uses: a rebuilt lesson's `examples` array, or the
    // legacy singular `example` for one not yet rebuilt — never both, so a rebuilt technique's
    // example is never double-counted (examples[0] *is* .example for those, by WS-2's own design).
    const examples = technique.examples ?? [technique.example];
    return examples
      .filter((ex) => ex.resultExpr !== undefined) // a literal stated value, not a derivation/aside
      .map((example, i) => ({
        id: `lesson:${technique.id}:${i}`,
        front: exampleFront(example),
        back: example.result,
        technique: technique.id,
        source: "lesson" as const,
      }));
  });
}

/** The full deck, bank cards first then lesson cards — callers shuffle/filter as they like; this
 *  just assembles what's available, deterministically. */
export function buildValuesDeck(): FlashCard[] {
  return [...cardsFromBank(), ...cardsFromLessons()];
}

export function valuesDeckForTechnique(deck: readonly FlashCard[], technique: TechniqueId): FlashCard[] {
  return deck.filter((c) => c.technique === technique);
}
