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
 *
 * The sigh's-puzzles entries: sigh.github.io itself is blocked by this sandbox's network policy,
 * but the site is generated from the public sigh/puzzles GitHub repo, reachable through git
 * instead — every puzzle there is one short markdown file (a title, a couple of prompt sentences,
 * a collapsed solution). Titles and per-puzzle links are seeded here, one group per the repo's own
 * category folders; the actual prompts/solutions are read at the source, not reproduced here.
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
    id: "sigh-puzzles-cards",
    title: "sigh's puzzles — Cards",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "4_card_problem", label: "Four-card problem", url: "https://sigh.github.io/puzzles/4_card_problem" },
      { id: "5_card_trick", label: "Five-card trick", url: "https://sigh.github.io/puzzles/5_card_trick" },
      { id: "highest_card", label: "Highest card", url: "https://sigh.github.io/puzzles/highest_card" },
      { id: "pocket_kings", label: "Pocket kings drawing dead", url: "https://sigh.github.io/puzzles/pocket_kings" },
      { id: "second_black_ace", label: "Second black ace", url: "https://sigh.github.io/puzzles/second_black_ace" },
    ],
  },
  {
    id: "sigh-puzzles-geometry",
    title: "sigh's puzzles — Geometry",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "around_the_earth", label: "Around the Earth", url: "https://sigh.github.io/puzzles/around_the_earth" },
      { id: "belt_loop", label: "Belt loop", url: "https://sigh.github.io/puzzles/belt_loop" },
      { id: "buried_powerline", label: "Buried powerline", url: "https://sigh.github.io/puzzles/buried_powerline" },
      { id: "cold_walks", label: "Cold walks", url: "https://sigh.github.io/puzzles/cold_walks" },
      { id: "colored_plane", label: "Colored plane", url: "https://sigh.github.io/puzzles/colored_plane" },
      { id: "finding_the_river", label: "Finding the river", url: "https://sigh.github.io/puzzles/finding_the_river" },
      { id: "ghost_ships", label: "Ghost ships", url: "https://sigh.github.io/puzzles/ghost_ships" },
      { id: "lake_monster", label: "Lake monster", url: "https://sigh.github.io/puzzles/lake_monster" },
      { id: "planet_shadow", label: "Planet shadow", url: "https://sigh.github.io/puzzles/planet_shadow" },
      { id: "points_and_coins", label: "Points and coins", url: "https://sigh.github.io/puzzles/points_and_coins" },
      { id: "worm_and_apple", label: "Worm and the apple", url: "https://sigh.github.io/puzzles/worm_and_apple" },
    ],
  },
  {
    id: "sigh-puzzles-logic",
    title: "sigh's puzzles — Logic",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "10_wires", label: "10 wires", url: "https://sigh.github.io/puzzles/10_wires" },
      { id: "3_prisoner_line", label: "3 prisoners in a line", url: "https://sigh.github.io/puzzles/3_prisoner_line" },
      { id: "3_switch_lightbulb", label: "3 switches and a lightblub", url: "https://sigh.github.io/puzzles/3_switch_lightbulb" },
      { id: "attacking_knights", label: "Attacking knights", url: "https://sigh.github.io/puzzles/attacking_knights" },
      { id: "calendar_cubes", label: "Calendar cubes", url: "https://sigh.github.io/puzzles/calendar_cubes" },
      { id: "covering_queens", label: "Covering queens", url: "https://sigh.github.io/puzzles/covering_queens" },
      { id: "dice_groups", label: "Dice groups", url: "https://sigh.github.io/puzzles/dice_groups" },
      { id: "flipping_coins", label: "Flipping coins", url: "https://sigh.github.io/puzzles/flipping_coins" },
      { id: "gold_chain", label: "Gold chain", url: "https://sigh.github.io/puzzles/gold_chain" },
      { id: "handshakes", label: "Handshakes", url: "https://sigh.github.io/puzzles/handshakes" },
      { id: "jewel_thieves", label: "Jewel thieves", url: "https://sigh.github.io/puzzles/jewel_thieves" },
      { id: "marble_cans", label: "Mislabelled marble cans", url: "https://sigh.github.io/puzzles/marble_cans" },
      { id: "marked_prisoners", label: "Marked prisoners", url: "https://sigh.github.io/puzzles/marked_prisoners" },
      { id: "parking_lot", label: "Parking lot", url: "https://sigh.github.io/puzzles/parking_lot" },
      { id: "party_hats", label: "Party hats", url: "https://sigh.github.io/puzzles/party_hats" },
      { id: "sorting_hats", label: "Sorting hats", url: "https://sigh.github.io/puzzles/sorting_hats" },
      { id: "spinning_room", label: "Spinning room", url: "https://sigh.github.io/puzzles/spinning_room" },
      { id: "tall_and_short", label: "Short and tall", url: "https://sigh.github.io/puzzles/tall_and_short" },
      { id: "the_bookworm", label: "The bookworm", url: "https://sigh.github.io/puzzles/the_bookworm" },
    ],
  },
  {
    id: "sigh-puzzles-maths",
    title: "sigh's puzzles — Maths",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "birthday_problem", label: "Birthday problem", url: "https://sigh.github.io/puzzles/birthday_problem" },
      { id: "caterpillar_bungee", label: "Caterpillar on a bungee", url: "https://sigh.github.io/puzzles/caterpillar_bungee" },
      { id: "chameleons", label: "Chameleons", url: "https://sigh.github.io/puzzles/chameleons" },
      { id: "colliding_ants", label: "Colliding ants", url: "https://sigh.github.io/puzzles/colliding_ants" },
      { id: "everything_equals_six", label: "Everything equals 6", url: "https://sigh.github.io/puzzles/everything_equals_six" },
      { id: "factorial_zeros", label: "Factorial zeros", url: "https://sigh.github.io/puzzles/factorial_zeros" },
      { id: "friend_party", label: "Friends at a party", url: "https://sigh.github.io/puzzles/friend_party" },
      { id: "fuel_circuit", label: "Fuel circuit", url: "https://sigh.github.io/puzzles/fuel_circuit" },
      { id: "hidden_ages", label: "Hidden ages", url: "https://sigh.github.io/puzzles/hidden_ages" },
      { id: "hidden_polynomial", label: "Hidden polynomial", url: "https://sigh.github.io/puzzles/hidden_polynomial" },
      { id: "lockers", label: "Open lockers", url: "https://sigh.github.io/puzzles/lockers" },
      { id: "monkey_and_coconuts", label: "Monkey and the coconuts", url: "https://sigh.github.io/puzzles/monkey_and_coconuts" },
      { id: "mountain_hiking", label: "Hiking in the mountains", url: "https://sigh.github.io/puzzles/mountain_hiking" },
      { id: "negating_function", label: "Negating function", url: "https://sigh.github.io/puzzles/negating_function" },
    ],
  },
  {
    id: "sigh-puzzles-measurement",
    title: "sigh's puzzles — Measurement",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "burning_fuses", label: "Burning fuses", url: "https://sigh.github.io/puzzles/burning_fuses" },
      { id: "hourglasses", label: "Hourglasses", url: "https://sigh.github.io/puzzles/hourglasses" },
      { id: "marble_bags", label: "Marble bags", url: "https://sigh.github.io/puzzles/marble_bags" },
      { id: "marble_scales", label: "Marble scales", url: "https://sigh.github.io/puzzles/marble_scales" },
      { id: "water_bottle", label: "Melted water bottle", url: "https://sigh.github.io/puzzles/water_bottle" },
      { id: "water_jugs", label: "Water jugs", url: "https://sigh.github.io/puzzles/water_jugs" },
    ],
  },
  {
    id: "sigh-puzzles-optimization",
    title: "sigh's puzzles — Optimization",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "airport_walkway", label: "Airport walkway", url: "https://sigh.github.io/puzzles/airport_walkway" },
      { id: "apple_delivery", label: "Apple delivery", url: "https://sigh.github.io/puzzles/apple_delivery" },
      { id: "greedy_pirates", label: "Greedy pirates", url: "https://sigh.github.io/puzzles/greedy_pirates" },
      { id: "locked_pirates_chest", label: "Locked pirate chest", url: "https://sigh.github.io/puzzles/locked_pirates_chest" },
      { id: "marble_drop", label: "Marble dropping", url: "https://sigh.github.io/puzzles/marble_drop" },
    ],
  },
  {
    id: "sigh-puzzles-paradox",
    title: "sigh's puzzles — Paradox",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "coin_rotation", label: "Coin rotation", url: "https://sigh.github.io/puzzles/coin_rotation" },
      { id: "false_equations", label: "False Equations", url: "https://sigh.github.io/puzzles/false_equations" },
      { id: "missing_square", label: "Missing square", url: "https://sigh.github.io/puzzles/missing_square" },
      { id: "same_color", label: "All horses are the same color", url: "https://sigh.github.io/puzzles/same_color" },
    ],
  },
  {
    id: "sigh-puzzles-physics",
    title: "sigh's puzzles — Physics",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "disrupted_scale", label: "Disrupted scale", url: "https://sigh.github.io/puzzles/disrupted_scale" },
      { id: "find_the_magnet", label: "Find the magnet", url: "https://sigh.github.io/puzzles/find_the_magnet" },
      { id: "plane_conveyor", label: "Plane on a conveyor belt", url: "https://sigh.github.io/puzzles/plane_conveyor" },
      { id: "radioactive_cookies", label: "Radioactive cookies", url: "https://sigh.github.io/puzzles/radioactive_cookies" },
      { id: "resistors", label: "Resistor network", url: "https://sigh.github.io/puzzles/resistors" },
      { id: "rock_boat", label: "Rock in a boat", url: "https://sigh.github.io/puzzles/rock_boat" },
    ],
  },
  {
    id: "sigh-puzzles-probability",
    title: "sigh's puzzles — Probability",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "3_way_shootout", label: "3-way shootout", url: "https://sigh.github.io/puzzles/3_way_shootout" },
      { id: "gender_odds", label: "Gender odds", url: "https://sigh.github.io/puzzles/gender_odds" },
      { id: "gender_ratio", label: "Gender ratio", url: "https://sigh.github.io/puzzles/gender_ratio" },
      { id: "guess_larger_number", label: "Guess the larger number", url: "https://sigh.github.io/puzzles/guess_larger_number" },
      { id: "monty_hall", label: "Monty hall", url: "https://sigh.github.io/puzzles/monty_hall" },
      { id: "prisoner_boxes", label: "Prisoners' names in boxes", url: "https://sigh.github.io/puzzles/prisoner_boxes" },
      { id: "prisoner_hats_circle", label: "Prisoners with hats in a circle", url: "https://sigh.github.io/puzzles/prisoner_hats_circle" },
      { id: "rand_number_bluff", label: "Random number bluff", url: "https://sigh.github.io/puzzles/rand_number_bluff" },
      { id: "red_blue_marbles", label: "Red marbles, blue marbles", url: "https://sigh.github.io/puzzles/red_blue_marbles" },
      { id: "seats_on_plane", label: "Seats on a plane", url: "https://sigh.github.io/puzzles/seats_on_plane" },
      { id: "tallest_in_line", label: "Tallest in line", url: "https://sigh.github.io/puzzles/tallest_in_line" },
    ],
  },
  {
    id: "sigh-puzzles-shapes",
    title: "sigh's puzzles — Shapes",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "10_10_tiling", label: "10x10 tiling", url: "https://sigh.github.io/puzzles/10_10_tiling" },
      { id: "broken_chessboard", label: "Broken chessboard", url: "https://sigh.github.io/puzzles/broken_chessboard" },
      { id: "cutout_shapes", label: "Cutout shapes", url: "https://sigh.github.io/puzzles/cutout_shapes" },
      { id: "cutting_a_square", label: "Cutting a square", url: "https://sigh.github.io/puzzles/cutting_a_square" },
      { id: "dividing_cakes", label: "Dividing cakes", url: "https://sigh.github.io/puzzles/dividing_cakes" },
      { id: "nine_dots", label: "Nine dots", url: "https://sigh.github.io/puzzles/nine_dots" },
      { id: "quarantine_squares", label: "Quarantine squares", url: "https://sigh.github.io/puzzles/quarantine_squares" },
      { id: "rows_of_trees", label: "Rows of trees", url: "https://sigh.github.io/puzzles/rows_of_trees" },
    ],
  },
  {
    id: "sigh-puzzles-simple_maths",
    title: "sigh's puzzles — Simple Maths",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "bat_and_ball", label: "Bat and ball", url: "https://sigh.github.io/puzzles/bat_and_ball" },
      { id: "dried_potatoes", label: "Dried potatoes", url: "https://sigh.github.io/puzzles/dried_potatoes" },
      { id: "lily_pads", label: "Lily pads", url: "https://sigh.github.io/puzzles/lily_pads" },
      { id: "magic_square", label: "Magic square", url: "https://sigh.github.io/puzzles/magic_square" },
      { id: "squashed_bee", label: "Squashed bee", url: "https://sigh.github.io/puzzles/squashed_bee" },
    ],
  },
  {
    id: "sigh-puzzles-strategy",
    title: "sigh's puzzles — Strategy",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "100_prisoners_line", label: "100 prisoners in a line", url: "https://sigh.github.io/puzzles/100_prisoners_line" },
      { id: "bad_processors", label: "Bad processors", url: "https://sigh.github.io/puzzles/bad_processors" },
      { id: "bridge_crossing", label: "Bridge crossing", url: "https://sigh.github.io/puzzles/bridge_crossing" },
      { id: "catch_the_fugative", label: "Catch the fugative", url: "https://sigh.github.io/puzzles/catch_the_fugative" },
      { id: "coin_table", label: "Table of coins", url: "https://sigh.github.io/puzzles/coin_table" },
      { id: "crashing_engines", label: "Crashing engines", url: "https://sigh.github.io/puzzles/crashing_engines" },
      { id: "hidden_salaries", label: "Hidden salaries", url: "https://sigh.github.io/puzzles/hidden_salaries" },
      { id: "locking_boxes", label: "Locking boxes", url: "https://sigh.github.io/puzzles/locking_boxes" },
      { id: "missing_number", label: "Missing number", url: "https://sigh.github.io/puzzles/missing_number" },
      { id: "poisoned_wine", label: "Poisoned wine bottles", url: "https://sigh.github.io/puzzles/poisoned_wine" },
      { id: "prisoner_lightbulb", label: "Prisoners and a lightbulb", url: "https://sigh.github.io/puzzles/prisoner_lightbulb" },
      { id: "prisoners_chessboard", label: "Prisoners' chessboard", url: "https://sigh.github.io/puzzles/prisoners_chessboard" },
      { id: "river_crossing", label: "River crossings", url: "https://sigh.github.io/puzzles/river_crossing" },
      { id: "shuffling_people", label: "Shuffling people", url: "https://sigh.github.io/puzzles/shuffling_people" },
      { id: "sink_the_sub", label: "Sink the sub", url: "https://sigh.github.io/puzzles/sink_the_sub" },
      { id: "spiders_web", label: "Spider's web", url: "https://sigh.github.io/puzzles/spiders_web" },
    ],
  },
  {
    id: "sigh-puzzles-truth",
    title: "sigh's puzzles — Truth & Lies",
    sourceUrl: "https://sigh.github.io/puzzles/all",
    sourceNote:
      "External site — each item links to that puzzle's own page; the solution is a collapsed " +
      "section on that page. Only titles are tracked here, not the puzzle text or solutions.",
    items: [
      { id: "bob_and_brother", label: "Bob and his brother", url: "https://sigh.github.io/puzzles/bob_and_brother" },
      { id: "knights_and_knaves", label: "Knights and knaves", url: "https://sigh.github.io/puzzles/knights_and_knaves" },
      { id: "knights_and_knaves_village", label: "Village of knights and knaves", url: "https://sigh.github.io/puzzles/knights_and_knaves_village" },
      { id: "shaded_stones", label: "Shaded stones", url: "https://sigh.github.io/puzzles/shaded_stones" },
      { id: "true_false_gods", label: "Honest and deceitful gods", url: "https://sigh.github.io/puzzles/true_false_gods" },
    ],
  },
];
