import type { QuantRung, QuantTopic } from "./types";

export const RUNG_ORDER: QuantRung[] = ["a-level", "further-maths", "step", "quant"];

export const RUNG_LABEL: Record<QuantRung, string> = {
  "a-level": "A-level",
  "further-maths": "Further Maths",
  step: "STEP-level",
  quant: "Quant-specific",
};

/**
 * Six topics, ordered along the A-level → Further Maths → STEP → quant-specific ladder. Each
 * teaches a recognition cue and a recipe first (the part a formula sheet doesn't give you), then
 * links to focused practice on exactly that sub-skill via the existing drill generators'
 * `config.focusTag` hook — see probabilityFlash.ts / estimateSprint.ts.
 */
export const QUANT_TOPICS: QuantTopic[] = [
  {
    id: "dice-counting",
    title: "Two-Dice Counting",
    rung: "a-level",
    tagline: "Enumerate the sample space, don't just multiply.",
    whenToUse:
      "Reach for direct enumeration whenever a problem reduces to counting favourable outcomes over a " +
      "small, fixed, equally-likely sample space — two dice give 36 *ordered* pairs $(a,b)$, not 21 " +
      "unordered sums. The most common slip is treating a sum like 7 as \"one way\" instead of counting " +
      "every ordered pair that produces it.",
    recipe: [
      "Confirm the sample space is ordered pairs, not sums — $(2,5)$ and $(5,2)$ are different outcomes.",
      "Learn the count-per-sum table once: sums $2..12$ have counts $1,2,3,4,5,6,5,4,3,2,1$ — symmetric " +
        "around 7, peak of 6 at the sum 7 itself.",
      "For \"exactly $s$\": read the table directly. For \"at least / at most $s$\": sum the relevant " +
        "run of the table rather than re-deriving from scratch.",
    ],
    example: {
      prompt: "How many of the 36 outcomes sum to 8 or more?",
      work: [
        "Sums 8 through 12 have counts $5, 4, 3, 2, 1$ from the table.",
        "$5+4+3+2+1 = 15$.",
      ],
      result: "$15/36$",
    },
    pitfalls: [
      "Confusing \"ways to make a sum\" with \"the sum itself\" — order matters in the sample space even " +
        "though it doesn't matter in the final total.",
      "Misremembering the extremes: sums 2 and 12 each have only 1 way, not 0 — easy to drop under time pressure.",
    ],
    practice: [{ drillKey: "probability-flash", focusTag: "dice-sum", label: "Practice: dice-sum counting" }],
  },
  {
    id: "ncr-combinatorics",
    title: "Combinatorics: nCr on Sight",
    rung: "further-maths",
    tagline: "Choosing beats arranging — know which one the question is really asking.",
    whenToUse:
      "Ask first: does swapping two of the chosen items give a *different* outcome? No → it's a " +
      "combination, $\\binom{n}{r}$. Yes → it's a permutation, $n!/(n-r)!$, a different number entirely. " +
      "Mixing these up is the single most common combinatorics slip in an interview.",
    recipe: [
      "Decide combination vs permutation from the swap test above before computing anything.",
      "Compute $\\binom{n}{r}$ via the multiplicative form $\\frac{n(n-1)\\cdots(n-r+1)}{r!}$, never raw " +
        "factorials — it cancels immediately and never risks an overflowing intermediate value.",
      "Use the symmetry $\\binom{n}{r}=\\binom{n}{n-r}$ to pick whichever side is smaller before multiplying.",
      "Sanity-check against $\\binom{n}{0}=1$, $\\binom{n}{1}=n$, $\\binom{n}{2}=\\frac{n(n-1)}{2}$ before " +
        "trusting a bigger computation.",
    ],
    example: {
      prompt: "Ways to choose 3 items from 9?",
      work: [
        "$\\binom{9}{3}=\\binom{9}{6}$ — pick the smaller side, $r=3$.",
        "$\\frac{9\\times 8\\times 7}{3!} = \\frac{504}{6}$.",
      ],
      result: "$84$",
    },
    pitfalls: [
      "Reaching for $n!$ directly and blowing up a mental calculation the multiplicative form would have cancelled instantly.",
      "Forgetting the $\\div r!$ and reporting the permutation count instead of the combination count.",
    ],
    practice: [{ drillKey: "probability-flash", focusTag: "ncr", label: "Practice: nCr on sight" }],
  },
  {
    id: "bayes-natural-frequencies",
    title: "Bayes' Theorem via Natural Frequencies",
    rung: "step",
    tagline: "Don't compute Bayes' formula — build the head-count table instead.",
    whenToUse:
      "Any \"given a positive test/signal, what's the real probability\" question. This is the single " +
      "most-tested piece of probability in quant interviews, and the one candidates get wrong most, " +
      "because they try to hold $P(A\\mid B)$ formula terms in their head instead of concrete counts.",
    recipe: [
      "Pick a round population (1000 is the standard choice) and split it: how many actually have the " +
        "condition, how many don't.",
      "Apply sensitivity to the \"have it\" group → true positives. Apply specificity to the \"don't have " +
        "it\" group → true negatives.",
      "Everyone testing positive = true positives + false positives (the \"don't have it\" group's leftover). " +
        "This is the new denominator — not the original population.",
      "The answer is true positives ÷ everyone testing positive, read straight off the table. No formula " +
        "needed once the table is built.",
    ],
    example: {
      prompt: "1000 people; 20 have it. Test flags 90% of true cases, clears 90% of clean ones. Of everyone testing positive, how many actually have it?",
      work: [
        "20 have it, 980 don't.",
        "True positives: $90\\% \\times 20 = 18$. True negatives: $90\\% \\times 980 = 882$.",
        "False positives: $980 - 882 = 98$. Total testing positive: $18 + 98 = 116$.",
        "$18 / 116 \\approx 15.5\\%$ — a 90%-accurate test, but most positives are still false alarms.",
      ],
      result: "$\\approx 15.5\\%$, not 90%",
    },
    pitfalls: [
      "Confusing $P(\\text{positive}\\mid\\text{disease})$ (sensitivity, the test's own property) with " +
        "$P(\\text{disease}\\mid\\text{positive})$ (what's actually asked) — these are rarely close, and " +
        "conflating them is the base-rate fallacy.",
      "Forgetting the healthy group is almost always far bigger than the affected group, so even a small " +
        "false-positive rate applied to it can dwarf the true positives.",
    ],
    practice: [{ drillKey: "probability-flash", focusTag: "bayes-freq", label: "Practice: Bayes via natural frequencies" }],
  },
  {
    id: "expected-value",
    title: "Constructing Expected Value",
    rung: "further-maths",
    tagline: "EV is a weighted average of outcomes — build it from the payout table, don't guess.",
    whenToUse:
      "Any \"is this worth playing\" or \"what's this bet worth\" question. $EV=\\sum(\\text{probability} " +
      "\\times \\text{payoff})$, and every quant gamble question reduces to this even when it's dressed up " +
      "as something else.",
    recipe: [
      "List every outcome with its payoff (losses as negative numbers) and its probability as a clean fraction.",
      "Multiply each payoff by its probability and sum — don't average the raw payoffs, weight them.",
      "Two-outcome bet (win $W$ at probability $p$, lose $L$ otherwise): $EV = pW - (1-p)L$. Sanity-check the " +
        "sign matches intuition.",
      "If probabilities share a denominator $n$, work in \"total across $n$ trials\" and divide by $n$ only " +
        "at the end — keeps everything in integers until the last step.",
    ],
    example: {
      prompt: "Urn of 10 balls: 3 pay £20 each, rest pay £0. Expected value?",
      work: [
        "Total payout across all 10 balls: $3 \\times £20 = £60$.",
        "Spread over 10 balls: $£60 / 10$.",
      ],
      result: "£6",
    },
    pitfalls: [
      "Averaging the payoffs without weighting by probability — treating a 1-in-10 win the same as a coin flip.",
      "Dropping the sign on a loss term — it must be subtracted, not added.",
    ],
    practice: [
      { drillKey: "probability-flash", focusTag: "ev-urn", label: "Practice: EV — urn bets" },
      { drillKey: "probability-flash", focusTag: "ev-coin", label: "Practice: EV — coin bets" },
    ],
  },
  {
    id: "ev-sign-under-pressure",
    title: "Take It or Pass: EV Sign Under Pressure",
    rung: "quant",
    tagline: "You don't need the exact number — you need the sign, fast.",
    whenToUse:
      "Live interview gut-checks (\"would you take this bet\") where computing the precise EV wastes time " +
      "you don't have. You only need the sign, not the value.",
    recipe: [
      "Compare $k\\cdot W$ against $(n-k)\\cdot L$ directly — cross-multiply, don't divide. The sign of " +
        "$k\\cdot W-(n-k)\\cdot L$ *is* the sign of the EV, and this avoids fractions entirely.",
      "Round $W$, $L$, $k$, $n$ to one significant figure first if the numbers are ugly — for a sign call, " +
        "precision past the first digit almost never flips the answer.",
      "State the call immediately — hesitating to double-check the exact number when only the sign was " +
        "asked for reads as a lack of confidence.",
    ],
    example: {
      prompt: "Win £15 at 2/5, else lose £8. Take it?",
      work: ["$k\\cdot W = 2\\times15 = 30$.", "$(n-k)\\cdot L = 3\\times8 = 24$.", "$30 > 24$ → positive EV."],
      result: "Take it.",
    },
    pitfalls: [
      "Reaching for the full division $\\frac{kW-(n-k)L}{n}$ out of habit when only the sign was asked for.",
      "Forgetting it's $(n-k)$, not $n$, multiplying the loss — a common slip under time pressure.",
    ],
    practice: [{ drillKey: "edge-check", label: "Practice: take it or pass" }],
  },
  {
    id: "fast-estimation",
    title: "Fast Estimation: Round Smart",
    rung: "quant",
    tagline: "Round the inputs, correct the direction, land within one digit.",
    whenToUse:
      "Any calculation where speed and order-of-magnitude correctness beat exact arithmetic — products, " +
      "quotients, percentages, and roots of ugly numbers.",
    recipe: [
      "Square roots: bracket between consecutive perfect squares, then linear-interpolate the fractional " +
        "distance into the gap — $\\sqrt{83}$ sits $2/19$ of the way from $81$ to $100$, so $\\approx 9.1$.",
      "Percentages: decompose into 10%/5%/1% chunks you can add — $17\\%$ of $140$ = $10\\%+5\\%+2\\%$ = " +
        "$14+7+2.8=23.8$.",
      "Products: round each factor to 1–2 significant figures, multiply, then correct — if you rounded one " +
        "factor up and the other down, the errors partly cancel; same direction, correct further.",
      "Divisions: invert to a multiplication of a memorised reciprocal — $a\\div b \\approx a \\times " +
        "\\tfrac1b$, and $\\tfrac13\\approx0.33$, $\\tfrac17\\approx0.14$, $\\tfrac19\\approx0.11$ beat long division live.",
    ],
    example: {
      prompt: "Estimate 47 × 213, nearest 100.",
      work: [
        "$47\\approx50$ (rounded up), $213\\approx200$ (rounded down) — the errors partly cancel.",
        "$50\\times200=10{,}000$.",
        "Exact value is $10{,}011$ — nearest 100 is still $10{,}000$.",
      ],
      result: "10,000",
    },
    pitfalls: [
      "Rounding both factors in the same direction without correcting — compounds the error instead of cancelling it.",
      "For square roots, losing track of which perimeter square you bracketed between when the target sits near the midpoint.",
    ],
    practice: [
      { drillKey: "estimate-sprint", focusTag: "sqrt-round", label: "Practice: square roots" },
      { drillKey: "estimate-sprint", focusTag: "percent-round", label: "Practice: percentages" },
      { drillKey: "estimate-sprint", focusTag: "product-round", label: "Practice: products" },
      { drillKey: "estimate-sprint", focusTag: "division-round", label: "Practice: divisions" },
    ],
  },
];
