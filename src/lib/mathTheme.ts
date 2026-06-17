export const mathTheme = {
  bg: "#0B0F19",
  grid: "#1E293B",
  gridStrong: "#334155",
  vector: "#38BDF8",
  particle: "#7DD3FC",
  highlight: "#A78BFA",
  text: "#CBD5E1",
  textDim: "#64748B",
} as const;

export type MathMode = "pure" | "applied";
export type EnvironmentKind = "vector" | "wrapped";

export interface SavedInsight {
  title: string;
  environment: EnvironmentKind;
  mode: MathMode;
  formulas: string[];
  params: Record<string, number>;
}