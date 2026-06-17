export interface BridgeCard {
  title: string;
  hook: string;
  link: string; // a hint/topic name to suggest
}

// Curated isomorphic links — generic across subjects for now.
// Keyed loosely by subject keyword; falls back to a default set.
const cards: Record<string, BridgeCard[]> = {
  mathematics: [
    { title: "Gradient ⇄ Force Field", hook: "Optimization steps mirror a charged particle in a potential.", link: "Plasma confinement" },
    { title: "Modular Arithmetic ⇄ Torus", hook: "Wrapping integers mod n is the same shape as a circular phase space.", link: "Periodic dynamics" },
    { title: "Linear Maps ⇄ Rotations", hook: "Every 2×2 orthogonal matrix is a rotation of the plane.", link: "Unit circle geometry" },
  ],
  physics: [
    { title: "Lorentz Force ⇄ Gradient Descent", hook: "Particles spiral toward minima the same way charges spiral along B-fields.", link: "Multivariable calculus" },
    { title: "Phase Space ⇄ Toroidal Geometry", hook: "Periodic motion lives on a torus — visualize it directly.", link: "Modular arithmetic" },
    { title: "Waves ⇄ Complex Exponentials", hook: "Every standing wave is a rotation in the complex plane.", link: "Euler's formula" },
  ],
  computer_science: [
    { title: "State Machines ⇄ Wrapped Grids", hook: "Cyclic states are paths on a torus.", link: "Periodic phase space" },
    { title: "Gradient Descent ⇄ Vector Fields", hook: "Training a model is navigating a force field.", link: "Optimization geometry" },
  ],
};

const fallback: BridgeCard[] = cards.mathematics;

export function getBridgeCards(subject?: string | null): BridgeCard[] {
  if (!subject) return fallback;
  const key = subject.toLowerCase().replace(/\s+/g, "_");
  return cards[key] ?? fallback;
}