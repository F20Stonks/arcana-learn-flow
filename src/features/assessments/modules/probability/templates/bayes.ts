/**
 * The base-rate / false-positive Bayes setup. Verified in generate.test.ts by simulating a large
 * population with the given prevalence, testing it with the given sensitivity and false-positive
 * rate, and checking the sample fraction of positives who are actually diseased (Monte Carlo).
 */
import { pick } from "../../../engine/rng";
import type { ProbTemplate } from "./types";

interface Rate {
  value: number;
  label: string;
}

const PREVALENCE: Rate[] = [
  { value: 0.001, label: "0.1%" },
  { value: 0.002, label: "0.2%" },
  { value: 0.005, label: "0.5%" },
  { value: 0.01, label: "1%" },
  { value: 0.02, label: "2%" },
  { value: 0.05, label: "5%" },
];

const SENSITIVITY: Rate[] = [
  { value: 0.9, label: "90%" },
  { value: 0.92, label: "92%" },
  { value: 0.95, label: "95%" },
  { value: 0.97, label: "97%" },
  { value: 0.98, label: "98%" },
  { value: 0.99, label: "99%" },
];

const FALSE_POSITIVE: Rate[] = [
  { value: 0.01, label: "1%" },
  { value: 0.02, label: "2%" },
  { value: 0.03, label: "3%" },
  { value: 0.05, label: "5%" },
  { value: 0.08, label: "8%" },
  { value: 0.1, label: "10%" },
];

/** P(disease | positive) via Bayes: se*p / (se*p + fp*(1-p)). */
export const bayesBaseRate: ProbTemplate = {
  id: "prob_bayes_base_rate",
  topic: "bayes",
  difficulty: 3,
  generate: (rng) => {
    const prevalence = pick(PREVALENCE, rng);
    const sensitivity = pick(SENSITIVITY, rng);
    const falsePositive = pick(FALSE_POSITIVE, rng);
    const p = prevalence.value;
    const se = sensitivity.value;
    const fp = falsePositive.value;

    const truePos = se * p;
    const falsePos = fp * (1 - p);
    const correct = truePos / (truePos + falsePos);

    return {
      tag: "prob_bayes_base_rate",
      prompt: `${prevalence.label} of a population has a disease. A screening test correctly flags a diseased person ${sensitivity.label} of the time (sensitivity), and incorrectly flags a healthy person as positive ${falsePositive.label} of the time (false-positive rate). A random person tests positive. What is the probability they actually have the disease?`,
      correct,
      isProbability: true,
      explanation: `By Bayes' rule, P(disease | positive) = P(positive | disease)·P(disease) / P(positive) = (${sensitivity.label}·${prevalence.label}) / (${sensitivity.label}·${prevalence.label} + ${falsePositive.label}·(1 − ${prevalence.label})). Because the disease is rare, the much larger healthy population still produces enough false positives to dominate the denominator.`,
      distractors: [
        // Inverted the conditional: reported P(positive | disease) instead of P(disease | positive).
        { value: se, reasoning: "inverted the conditional — reported the test's sensitivity P(positive | disease) instead of P(disease | positive)" },
        // Forgot to condition on testing positive at all — reported the joint probability.
        { value: truePos, reasoning: "computed the joint probability P(disease AND positive) instead of the conditional P(disease | positive)" },
        // Ignored the test result entirely.
        { value: p, reasoning: "ignored the test result — reported the base rate P(disease) with no update" },
        // Swapped sensitivity and false-positive rate in the formula.
        { value: (fp * p) / (fp * p + se * (1 - p)), reasoning: "swapped the sensitivity and false-positive rate in the Bayes formula" },
      ],
    };
  },
};
