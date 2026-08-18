import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

const VARS = ["A", "B", "C"];

/**
 * Every problem is a minterm (A ∩ Bᶜ ∩ C, never a union) so it always resolves to exactly one
 * region — matching VennDiagramInput's single-tap answer model. Full union/symmetric-difference
 * questions would need a multi-region tap the current input doesn't support.
 *
 * Tag is `venn{code}` (one tag per region, e.g. 'venn101') so weak-spot mode can target the
 * specific region a player keeps mis-tapping, same pattern as Modular Rush's per-modulus tags.
 */
export const vennBlitz: DrillDefinition = {
  key: "venn-blitz",
  name: "Venn Blitz",
  tagline: "Set notation to region, on instinct.",
  domain: "logic",
  defaultDurationS: 75,
  inputKind: "venn",
  rules:
    "You'll see a set expression like A ∩ Bᶜ ∩ C. Tap the region of the three-circle diagram it describes — tapping outside all three circles is a valid answer when every set is complemented. Every expression names exactly one region, never a union.",
  modes: [
    { id: "classic", label: "Classic sprint", description: "75 seconds tapping the region a set expression describes." },
    { id: "adaptive", label: "Adaptive staircase", description: "Starts with plain sets, adds more complements as you build a streak." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights problems toward the specific region you keep mis-tapping." },
  ],
  generate: ({ level, rng, biasTags }) => {
    let bits: boolean[] | undefined;
    if (biasTags?.length && rng() < 0.7) {
      const codes = biasTags.map((t) => t.replace("venn", "")).filter((c) => /^[01]{3}$/.test(c));
      if (codes.length) bits = pick(codes, rng).split("").map((c) => c === "1");
    }
    if (!bits) {
      const pComplement = Math.min(0.8, 0.25 + level * 0.15);
      bits = [rng() < 0.5, rng() < 0.5, rng() < 0.5].map((inSet) => (rng() < pComplement ? !inSet : inSet));
    }

    const terms = VARS.map((v, i) => (bits![i] ? v : `${v}^{c}`));
    const code = bits.map((b) => (b ? "1" : "0")).join("");

    return {
      id: `${Date.now()}-${Math.floor(rng() * 1e6)}`,
      tag: `venn${code}`,
      prompt: `$${terms.join(" \\cap ")}$`,
      answer: code,
    };
  },
};
