/**
 * Dispatches to one template, weighted by the active firm profile, and turns its result into a
 * graded `choice` item.
 */
import type { AssessmentItem } from "../../types";
import { weightedPick } from "../../engine/rng";
import { generateChoiceItem } from "./choiceBuilder";
import { PROB_TEMPLATES, type ProbTemplateId } from "./templates";
import type { ProbabilityProfile } from "./profiles";

export interface ProbabilityConfig {
  profile: ProbabilityProfile;
  optionsCount: number;
}

export function generateProbabilityItem(rng: () => number, index: number, config: ProbabilityConfig): AssessmentItem {
  const templateId = weightedPick<ProbTemplateId>(config.profile.weights, rng);
  const template = PROB_TEMPLATES[templateId];
  const id = `${config.profile.id}-${index}-${Math.floor(rng() * 1e9)}`;
  return generateChoiceItem(rng, id, config.optionsCount, () => template.generate(rng));
}
