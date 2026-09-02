/**
 * Standard 52-card deck templates. Verified in generate.test.ts by simulating shuffles and draws
 * without replacement (Monte Carlo).
 */
import { pick, randInt } from "../../../engine/rng";
import { choose } from "../format";
import type { ProbTemplate } from "./types";

interface Category {
  count: number;
  label: string;
}

const CATEGORIES: Category[] = [
  { count: 4, label: "aces" },
  { count: 4, label: "kings" },
  { count: 12, label: "face cards (jack, queen, or king)" },
  { count: 13, label: "cards of the same suit as the first" },
  { count: 26, label: "red cards" },
];

/** Given the first of two cards drawn (no replacement) is in the category, P(second also is) = (A-1)/51. */
export const cardsConditionalSecondMatch: ProbTemplate = {
  id: "prob_cards_conditional_second_match",
  topic: "cards",
  difficulty: 2,
  generate: (rng) => {
    const cat = pick(CATEGORIES, rng);
    const A = cat.count;
    const correct = (A - 1) / 51;
    return {
      tag: "prob_cards_conditional_second_match",
      prompt: `Two cards are drawn without replacement from a standard 52-card deck. Given that the first card is one of the ${cat.label} (there are ${A} such cards in the deck), what is the probability the second card is also one of the ${cat.label}?`,
      correct,
      isProbability: true,
      explanation: `Conditioning removes one card from both the deck and the category: P = (${A} − 1)/(52 − 1) = ${A - 1}/51.`,
      distractors: [
        // Forgot to condition — computed the unconditional joint probability of both cards matching.
        { value: (A / 52) * ((A - 1) / 51), reasoning: "computed the joint probability P(both match) instead of the conditional probability" },
        // Treated the draws as independent / with replacement — ignored that the first card was removed.
        { value: A / 52, reasoning: "assumed independence (with replacement) — ignored that the first matching card was removed" },
        // Forgot to remove the drawn card from the favourable count, only from the deck size.
        { value: A / 51, reasoning: "reduced the deck size for the second draw but forgot to remove the first card from the favourable count" },
        // Reduced the favourable count but not the deck size.
        { value: (A - 1) / 52, reasoning: "reduced the favourable count but used the original deck size of 52" },
      ],
    };
  },
};

/** P(at least one ace among k cards drawn without replacement) = 1 - C(48,k)/C(52,k). */
export const cardsAtLeastOneAce: ProbTemplate = {
  id: "prob_cards_at_least_one_ace",
  topic: "cards",
  difficulty: 2,
  generate: (rng) => {
    const k = randInt(2, 8, rng);
    const noAceWays = choose(48, k);
    const totalWays = choose(52, k);
    const correct = 1 - noAceWays / totalWays;
    return {
      tag: "prob_cards_at_least_one_ace",
      prompt: `${k} cards are drawn without replacement from a standard 52-card deck. What is the probability at least one is an ace?`,
      correct,
      isProbability: true,
      explanation: `P(at least one ace) = 1 − P(no aces) = 1 − C(48,${k})/C(52,${k}), counting the ways to draw ${k} cards from the 48 non-aces.`,
      distractors: [
        { value: noAceWays / totalWays, reasoning: "reported P(no aces) itself instead of its complement" },
        { value: 1 - Math.pow(48 / 52, k), reasoning: "assumed independence between draws (with replacement) instead of drawing without replacement" },
        { value: (k * 4) / 52, reasoning: "computed the expected number of aces (k·4/52) instead of the probability of at least one" },
        { value: 1 - choose(47, k) / choose(51, k), reasoning: "off-by-one — treated the deck as 51 cards with 47 non-aces" },
      ],
    };
  },
};
