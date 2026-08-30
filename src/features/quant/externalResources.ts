import type { ExternalResourceGroup } from "./types";

/**
 * Third-party resources this tracker points at rather than absorbs. Each item is just a label
 * (a chapter title, a puzzle name) plus a link back to the source — the actual problems and
 * solutions live there, not here. This only tracks whether you've worked through them.
 *
 * The probability-book entry: the linked file is a full published book (structured chapters,
 * per-chapter solutions, a foreword by Nassim Nicholas Taleb) despite its filename — not raw
 * "Cut The Knot" web content. Its content isn't reproduced here, only its real chapter titles
 * (a table of contents), which conveniently complement several lessons above almost one-to-one
 * (Conditional Probability ↔ the Bayes lesson, Expectation ↔ the EV lesson, Combinatorics ↔ nCr).
 */
export const EXTERNAL_RESOURCES: ExternalResourceGroup[] = [
  {
    id: "probability-puzzle-book",
    title: "Probability puzzle book (foreword by Nassim Nicholas Taleb)",
    sourceUrl: "https://github.com/iAm-Tushar/quant-preparation-resources/blob/main/CutTheKnot.pdf",
    sourceNote:
      "External PDF — work the chapter's puzzles and check its own solutions section at the source. " +
      "This only tracks which chapters you've been through; it doesn't reproduce any of the book's content.",
    items: [
      { id: "ch1", label: "1 — Intuitive Probability" },
      { id: "ch2", label: "2 — What Is Probability?" },
      { id: "ch3", label: "3 — Likely Surprises" },
      { id: "ch4", label: "4 — Basic Probability" },
      { id: "ch5", label: "5 — Geometric Probability" },
      { id: "ch6", label: "6 — Combinatorics" },
      { id: "ch7", label: "7 — Conditional Probability" },
      { id: "ch8", label: "8 — Expectation" },
      { id: "ch9", label: "9 — Recurrences and Markov Chains" },
      { id: "ch10", label: "10 — Sampling of American Mathematics Competition Problems" },
      { id: "ch11", label: "11 — Elementary Statistics" },
      { id: "appA", label: "Appendix A — Dependent and Independent Events" },
      { id: "appB", label: "Appendix B — Principle of Symmetry" },
    ],
  },
  {
    id: "sigh-puzzles",
    title: "sigh's puzzle collection",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — sigh.github.io is blocked by this sandbox's network policy, so only the puzzle " +
      "named directly could be seeded here. Give me more anchor ids/titles from the page and I'll add them.",
    items: [{ id: "4_card_problem", label: "4 Card Problem", url: "https://sigh.github.io/puzzles/all#4_card_problem" }],
  },
];
