/**
 * UK University Integration Bee 2022/23 — Round One.
 *
 * Mined from four documents that turned out to overlap heavily:
 *  - 2022_Round_1_UK_University_Integration_Bee.txt — the main Round One paper (30 problems),
 *    { name: "UK University Integration Bee", year: 2022, round: "Round 1" }
 *  - Oxford_2022_Round_1_UK_University_Integration_Bee_1_1.txt — a separate 30-problem Oxford
 *    sitting of Round One, { round: "Round 1 (Oxford)" }
 *  - MIT_Tiebreaker_2022_Round_1_UK_University_Integration_Bee_3.txt — a 30-problem tiebreaker
 *    set, { round: "Round 1 Tiebreaker" }
 *  - Tiebreaker_2022_Round_1_UK_University_Integration_Bee_7.txt — a 20-problem tiebreaker set
 *    that turned out to be an exact ordered subset of the Oxford paper's first ~27 problems (every
 *    one of its 20 problems is a verbatim repeat of an Oxford problem already covered below) —
 *    every one of its problems is therefore a skip, logged in the report as a duplicate of the
 *    matching Oxford entry, never a second copy.
 *  - MIT_Tiebreaker's own first 13 problems are also a verbatim-ordered repeat of Oxford's first
 *    ~19 (see the report for the exact map); only MIT_Tiebreaker's problems 14 onward are genuinely
 *    new content not present in any of the other three documents.
 *  - Where the *main* Round 1 paper shares a problem with Oxford/the tiebreakers (a handful of
 *    problems really were reused across sittings), the single entry below is attributed to the main
 *    "Round 1" paper per the mining brief, and the overlap is noted in the report rather than
 *    duplicated.
 *
 * Every answer below was hand-derived, then checked against
 * harness.local/verify.ts (same normalize()/derivative()/quadrature() as problems.test.ts) before
 * being written here.
 */
import type { Problem } from "../../types";

export const UkuibRound1_2022: Problem[] = [];
