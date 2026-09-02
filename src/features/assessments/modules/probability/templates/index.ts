import { coinAtLeastOneHead, coinExactKHeads } from "./coin";
import { diceSumTwoDice, diceAtLeastOneTarget } from "./dice";
import { cardsConditionalSecondMatch, cardsAtLeastOneAce } from "./cards";
import { bayesBaseRate } from "./bayes";
import { evFairPriceDieBet } from "./ev";
import { comboArrangementsNonAdjacent, comboSelectionAtLeastOne } from "./combinatorics";
import { geometricHHWait, geometricVariance } from "./geometric";
import { orderStatMaxUniform, orderStatMaxDice } from "./orderStats";
import { gamblersRuinBiased, gamblersRuinFair } from "./gamblersRuin";
import { markovAbsorption } from "./markov";
import { birthdayCollisionProb, birthdayExpectedPairs } from "./birthday";
import { varianceSumDice } from "./variance";
import type { ProbTemplate } from "./types";

export type { ProbTemplate } from "./types";
export type { Distractor, TemplateResult } from "../choiceBuilder";

/**
 * Hand-declared (rather than derived via `keyof typeof PROB_TEMPLATES`) because `ProbTemplate.id`
 * is typed as plain `string`: deriving the union from computed object keys built off a `string`
 * field widens to `string | number` (a string index signature's `keyof` includes `number` in
 * TypeScript), which breaks `weightedPick`'s `K extends string` constraint in generate.ts.
 */
export type ProbTemplateId =
  | "prob_coin_at_least_one_head"
  | "prob_coin_exact_k_heads"
  | "prob_dice_sum_two"
  | "prob_dice_at_least_one_target"
  | "prob_cards_conditional_second_match"
  | "prob_cards_at_least_one_ace"
  | "prob_bayes_base_rate"
  | "prob_ev_fair_price_die"
  | "prob_combo_arrangements_non_adjacent"
  | "prob_combo_selection_at_least_one"
  | "prob_geometric_hh_wait"
  | "prob_geometric_variance"
  | "prob_order_stat_max_uniform"
  | "prob_order_stat_max_dice"
  | "prob_gamblers_ruin_biased"
  | "prob_gamblers_ruin_fair"
  | "prob_markov_absorption"
  | "prob_birthday_collision"
  | "prob_birthday_expected_pairs"
  | "prob_variance_sum_dice";

/** Every template in the bank, keyed by its id. A profile's weights record is keyed off this. */
export const PROB_TEMPLATES: Record<ProbTemplateId, ProbTemplate> = {
  prob_coin_at_least_one_head: coinAtLeastOneHead,
  prob_coin_exact_k_heads: coinExactKHeads,
  prob_dice_sum_two: diceSumTwoDice,
  prob_dice_at_least_one_target: diceAtLeastOneTarget,
  prob_cards_conditional_second_match: cardsConditionalSecondMatch,
  prob_cards_at_least_one_ace: cardsAtLeastOneAce,
  prob_bayes_base_rate: bayesBaseRate,
  prob_ev_fair_price_die: evFairPriceDieBet,
  prob_combo_arrangements_non_adjacent: comboArrangementsNonAdjacent,
  prob_combo_selection_at_least_one: comboSelectionAtLeastOne,
  prob_geometric_hh_wait: geometricHHWait,
  prob_geometric_variance: geometricVariance,
  prob_order_stat_max_uniform: orderStatMaxUniform,
  prob_order_stat_max_dice: orderStatMaxDice,
  prob_gamblers_ruin_biased: gamblersRuinBiased,
  prob_gamblers_ruin_fair: gamblersRuinFair,
  prob_markov_absorption: markovAbsorption,
  prob_birthday_collision: birthdayCollisionProb,
  prob_birthday_expected_pairs: birthdayExpectedPairs,
  prob_variance_sum_dice: varianceSumDice,
};

export const PROB_TEMPLATE_LIST: ProbTemplate[] = Object.values(PROB_TEMPLATES);
