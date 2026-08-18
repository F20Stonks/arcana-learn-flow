import type { DrillDefinition, SurfaceGlyphSpec } from "../types";
import { pick } from "../engine/rng";

/**
 * Eight surfaces, pairwise non-homeomorphic by construction — each differs from every other in
 * at least one of: boundary vs. closed, orientable vs. not, or hole-count (genus). "Same" always
 * means literally the same catalog entry; "different" always means two distinct entries. That
 * makes the answer provably correct without computing an invariant at generate-time.
 */
const CATALOG: { name: string; glyph: SurfaceGlyphSpec }[] = [
  { name: "sphere", glyph: { kind: "holes", holes: 0, dashed: false } },
  { name: "torus", glyph: { kind: "holes", holes: 1, dashed: false } },
  { name: "genus2", glyph: { kind: "holes", holes: 2, dashed: false } },
  { name: "disk", glyph: { kind: "holes", holes: 0, dashed: true } },
  { name: "annulus", glyph: { kind: "holes", holes: 1, dashed: true } },
  { name: "mobius", glyph: { kind: "mobius" } },
  { name: "klein", glyph: { kind: "klein" } },
  { name: "rp2", glyph: { kind: "rp2" } },
];

export const invariantMatch: DrillDefinition = {
  key: "invariant-match",
  name: "Invariant Match",
  tagline: "Same surface, or not — on sight.",
  domain: "topology",
  defaultDurationS: 75,
  inputKind: "binary",
  modes: [
    { id: "classic", label: "Classic sprint", description: "75 seconds calling surfaces same or different." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights toward whichever call — same or different — you get wrong most." },
  ],
  binaryOptions: [
    { value: "same", label: "Same surface" },
    { value: "different", label: "Different surfaces" },
  ],
  rules:
    "Two surface icons appear side by side — a blob's cut-out holes show its genus (0 = sphere, 1 = torus, 2 = double torus), a dashed outline means it has a boundary (disk, annulus), and three fixed glyphs cover the Möbius strip, Klein bottle, and projective plane. Call Same if they're the identical surface, Different if not.",
  generate: ({ rng, biasTags }) => {
    let wantSame = rng() < 0.5;
    if (biasTags?.length && rng() < 0.7) {
      const eligible = biasTags.filter((t) => t === "same" || t === "different");
      if (eligible.length) wantSame = pick(eligible, rng) === "same";
    }

    const left = pick(CATALOG, rng);
    let right = left;
    if (!wantSame) {
      do {
        right = pick(CATALOG, rng);
      } while (right.name === left.name);
    }

    const tag = wantSame ? "same" : "different";
    return {
      id: `${Date.now()}-${Math.floor(rng() * 1e6)}`,
      tag,
      prompt: "Same surface, or different?",
      answer: tag,
      visual: { kind: "invariant-pair", left: left.glyph, right: right.glyph },
    };
  },
};
