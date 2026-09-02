/**
 * Firm profiles over the probability template bank. A weight of 0 switches a template off
 * entirely; weights are relative, matching the arithmetic module's convention
 * (see modules/arithmetic/profiles.ts).
 *
 * Difficulty mix by template (see templates/*.ts for the derivations):
 *   1 (quick, single-step):  coin_at_least_one_head, dice_sum_two, dice_at_least_one_target
 *   2 (formula + setup):     coin_exact_k_heads, cards_*, ev_fair_price_die,
 *                             combo_*, geometric_variance, order_stat_*, gamblers_ruin_fair,
 *                             birthday_*, variance_sum_dice
 *   3 (multi-step / derive): bayes_base_rate, geometric_hh_wait, gamblers_ruin_biased,
 *                             markov_absorption
 */
import { PROB_TEMPLATES, type ProbTemplateId } from "./templates";

export interface ProbabilityProfile {
  id: string;
  weights: Record<ProbTemplateId, number>;
}

const ALL_IDS = Object.keys(PROB_TEMPLATES) as ProbTemplateId[];

const NONE: Record<ProbTemplateId, number> = Object.fromEntries(ALL_IDS.map((id) => [id, 0])) as Record<
  ProbTemplateId,
  number
>;

function weights(overrides: Partial<Record<ProbTemplateId, number>>): Record<ProbTemplateId, number> {
  return { ...NONE, ...overrides };
}

const EASY_IDS: ProbTemplateId[] = ["prob_coin_at_least_one_head", "prob_dice_sum_two", "prob_dice_at_least_one_target"];

const HARD_IDS: ProbTemplateId[] = [
  "prob_bayes_base_rate",
  "prob_geometric_hh_wait",
  "prob_gamblers_ruin_biased",
  "prob_markov_absorption",
];

const MEDIUM_IDS: ProbTemplateId[] = ALL_IDS.filter(
  (id) => !EASY_IDS.includes(id) && !HARD_IDS.includes(id),
);

/** Citadel's screen: general-purpose probability, every topic weighted evenly. */
export const CITADEL_PROFILE: ProbabilityProfile = {
  id: "citadel-oa-probability",
  weights: weights(Object.fromEntries(ALL_IDS.map((id) => [id, 1]))),
};

/**
 * DRW: six questions in 45 minutes, so every item should be a real multi-step problem — the
 * three quick single-formula templates are switched off entirely, and the hardest (derive a
 * recursion / solve a linear system / apply Bayes) templates are weighted above the rest.
 */
export const DRW_PROFILE: ProbabilityProfile = {
  id: "drw-oa-probability",
  weights: weights({
    ...Object.fromEntries(MEDIUM_IDS.map((id) => [id, 1])),
    ...Object.fromEntries(HARD_IDS.map((id) => [id, 3])),
  }),
};

/**
 * SIG: logic-and-brainteaser flavoured. Combinatorics, geometric waiting-time, gambler's ruin,
 * Markov chains, the birthday problem, and the Bayes base-rate trap are the classic "SIG-style"
 * brainteasers, so they carry the most weight; coin/dice/card basics and plain EV stay in the mix
 * at a lower weight for variety.
 */
export const SIG_PROFILE: ProbabilityProfile = {
  id: "sig-quant-eval-probability",
  weights: weights({
    prob_coin_at_least_one_head: 1,
    prob_coin_exact_k_heads: 1,
    prob_dice_sum_two: 1,
    prob_dice_at_least_one_target: 1,
    prob_cards_conditional_second_match: 2,
    prob_cards_at_least_one_ace: 1,
    prob_bayes_base_rate: 3,
    prob_ev_fair_price_die: 1,
    prob_combo_arrangements_non_adjacent: 3,
    prob_combo_selection_at_least_one: 3,
    prob_geometric_hh_wait: 3,
    prob_geometric_variance: 2,
    prob_order_stat_max_uniform: 2,
    prob_order_stat_max_dice: 2,
    prob_gamblers_ruin_biased: 3,
    prob_gamblers_ruin_fair: 2,
    prob_markov_absorption: 3,
    prob_birthday_collision: 3,
    prob_birthday_expected_pairs: 2,
    prob_variance_sum_dice: 1,
  }),
};

/**
 * G-Research: 90 minutes for 10 questions means genuinely long items, so — like DRW — the quick
 * single-step templates are switched off, with the multi-step derivations weighted highest.
 */
export const GRESEARCH_PROFILE: ProbabilityProfile = {
  id: "gresearch-quant-quiz-probability",
  weights: weights({
    ...Object.fromEntries(MEDIUM_IDS.map((id) => [id, 2])),
    ...Object.fromEntries(HARD_IDS.map((id) => [id, 3])),
  }),
};

export const PROBABILITY_PROFILES: Record<string, ProbabilityProfile> = {
  [CITADEL_PROFILE.id]: CITADEL_PROFILE,
  [DRW_PROFILE.id]: DRW_PROFILE,
  [SIG_PROFILE.id]: SIG_PROFILE,
  [GRESEARCH_PROFILE.id]: GRESEARCH_PROFILE,
};
