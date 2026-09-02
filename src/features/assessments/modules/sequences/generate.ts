/**
 * The sequences item generator.
 *
 * Draws a candidate from the difficulty ramp (families.ts), rejects it if the ambiguity verifier
 * (verifier.ts, backed by the independent fitters in fitters.ts) finds a competing low-complexity
 * fit that disagrees on the next term, or if any term is an absurd magnitude, and retries with a
 * fresh draw — bounded, then falling back to the simplest family (arithmetic) so a hard-to-satisfy
 * tier can never spin forever.
 */
import type { AssessmentItem } from "../../types";
import { draftFallback, draftForTier, tierForIndex, withinMagnitudeGuard, type Draft } from "./families";
import { checkAmbiguityLetters, checkAmbiguityNumeric } from "./verifier";

const MAX_RETRIES = 25;

function isAmbiguous(draft: Draft): boolean {
  if (draft.kind === "letters") {
    const prefix = draft.terms.slice(0, -1);
    const next = draft.terms[draft.terms.length - 1];
    return checkAmbiguityLetters(prefix, next, draft.intendedComplexity).ambiguous;
  }
  const prefix = draft.terms.slice(0, -1);
  const next = draft.terms[draft.terms.length - 1];
  return checkAmbiguityNumeric(prefix, next, draft.intendedComplexity).ambiguous;
}

function formatDraft(draft: Draft): { prompt: string; answer: string } {
  if (draft.kind === "letters") {
    const shown = draft.terms.slice(0, -1);
    const answer = draft.terms[draft.terms.length - 1];
    return { prompt: `${shown.join(", ")}, ?`, answer };
  }
  const shown = draft.terms.slice(0, -1).map(String);
  const answer = String(draft.terms[draft.terms.length - 1]);
  return { prompt: `${shown.join(", ")}, ?`, answer };
}

/**
 * Scopes "sequences already used in this paper" to one specific rng closure. `seededRng(seed)`
 * returns a brand-new function object on every call, so keying on the function identity means this
 * never leaks state between two different papers — even two that happen to share a seed value —
 * and never needs an explicit reset: once a run's rng closure is unreachable, its entry (and the
 * Set inside it) is collected with it. Deliberately NOT plain module-level state, which would make
 * duplicate-avoidance depend on whatever OTHER papers this module instance had already generated
 * and break "same seed -> same paper".
 */
const seenByRng = new WeakMap<() => number, Set<string>>();

function seenSetFor(rng: () => number): Set<string> {
  let seen = seenByRng.get(rng);
  if (!seen) {
    seen = new Set();
    seenByRng.set(rng, seen);
  }
  return seen;
}

/** Magnitude guard, dedupe, and the ambiguity verifier, applied in the order they're cheapest. */
function commit(draft: Draft, seen: Set<string>): Draft | null {
  if (!withinMagnitudeGuard(draft)) return null;
  const signature = `${draft.tag}:${JSON.stringify(draft.terms)}`;
  if (seen.has(signature)) return null;
  if (isAmbiguous(draft)) return null;
  seen.add(signature);
  return draft;
}

function draftUnique(rng: () => number, tier: number): Draft {
  const seen = seenSetFor(rng);
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const draft = commit(draftForTier(rng, tier), seen);
    if (draft) return draft;
  }
  // The intended tier's pool couldn't produce something clean after MAX_RETRIES tries — fall back
  // to the simplest family rather than looping forever. Arithmetic's parameter space is enormous
  // relative to a <=30-item paper, so this always succeeds well within the same retry budget.
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const draft = commit(draftFallback(rng), seen);
    if (draft) return draft;
  }
  throw new Error("sequencesModule: exhausted retries drafting a unique, unambiguous item");
}

export function generateSequenceItem(rng: () => number, index: number, count: number): AssessmentItem {
  const tier = tierForIndex(index, count);
  const draft = draftUnique(rng, tier);
  const { prompt, answer } = formatDraft(draft);
  const id = `sequences-${index}-${Math.floor(rng() * 1e9)}`;
  return { id, tag: draft.tag, prompt, answer };
}
