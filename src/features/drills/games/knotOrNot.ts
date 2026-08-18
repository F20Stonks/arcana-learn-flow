import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

/** (2,n) torus knots for odd n — a real, well-established family, not an improvised diagram.
 *  n=1 is the unknot, n=3 the trefoil, n=5 the cinquefoil. See KnotGlyph.tsx for the diagram. */
const CLASSES = [1, 3, 5];

export const knotOrNot: DrillDefinition = {
  key: "knot-or-not",
  name: "Knot or Not",
  tagline: "Read the diagram, not the drawing.",
  domain: "topology",
  defaultDurationS: 75,
  inputKind: "binary",
  modes: [
    { id: "classic", label: "Classic sprint", description: "75 seconds calling knot diagrams same or different." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights toward whichever call — same or different — you get wrong most." },
  ],
  binaryOptions: [
    { value: "same", label: "Same knot" },
    { value: "different", label: "Different knot" },
  ],
  rules:
    "Two knot diagrams appear side by side, drawn from the unknot / trefoil / cinquefoil family. The same knot can look different depending on how it's drawn — judge by the crossing pattern, not the curviness. Call Same or Different.",
  generate: ({ rng, biasTags }) => {
    let wantSame = rng() < 0.5;
    if (biasTags?.length && rng() < 0.7) {
      const eligible = biasTags.filter((t) => t === "same" || t === "different");
      if (eligible.length) wantSame = pick(eligible, rng) === "same";
    }

    const leftCrossings = pick(CLASSES, rng);
    let rightCrossings = leftCrossings;
    if (!wantSame) {
      do {
        rightCrossings = pick(CLASSES, rng);
      } while (rightCrossings === leftCrossings);
    }

    const tag = wantSame ? "same" : "different";
    return {
      id: `${Date.now()}-${Math.floor(rng() * 1e6)}`,
      tag,
      prompt: "Same knot, or different?",
      answer: tag,
      visual: {
        kind: "knot-pair",
        left: { crossings: leftCrossings, seed: Math.floor(rng() * 1000) },
        right: { crossings: rightCrossings, seed: Math.floor(rng() * 1000) },
      },
    };
  },
};
