import type { TemplateResult } from "../choiceBuilder";

export interface ProbTemplate {
  /** Also the item tag — stable id for the debrief breakdown and weak-spot targeting. */
  id: string;
  topic: string;
  /** 1 = quick single-step, 2 = a formula plus setup, 3 = multi-step / needs real derivation. */
  difficulty: 1 | 2 | 3;
  /** Draws fresh parameters from `rng` and returns one instance. Called again on collision-retry. */
  generate: (rng: () => number) => TemplateResult;
}
