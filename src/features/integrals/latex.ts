import type { Problem } from "./types";

/** The integral itself, assembled from the problem's parts so the bank never has to store an ∫. */
export function integralLatex(p: Problem): string {
  const bounds = p.kind === "definite" ? `_{${p.lower}}^{${p.upper}}` : "";
  return `\\int${bounds} ${p.integrand}\\,dx`;
}
