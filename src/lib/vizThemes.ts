export interface VizTheme {
  id: string;
  name: string;
  background: string;
  gridColor: string;
  glow: boolean;
  palette: string[];
}

export const VIZ_THEMES: VizTheme[] = [
  {
    id: "classic",
    name: "Classic",
    background: "#070b1a",
    gridColor: "#1e3a8a",
    glow: false,
    palette: ["#38bdf8", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#f97316"],
  },
  {
    id: "neon",
    name: "Neon",
    background: "#05010f",
    gridColor: "#7c3aed",
    glow: true,
    palette: ["#00fff2", "#ff00e5", "#faff00", "#00ff85", "#ff5100", "#7cfc00"],
  },
  {
    id: "aurora",
    name: "Aurora",
    background: "#03141a",
    gridColor: "#0ea5a1",
    glow: true,
    palette: ["#5eead4", "#38bdf8", "#c4b5fd", "#a7f3d0", "#f0abfc", "#67e8f9"],
  },
  {
    id: "sunset",
    name: "Sunset",
    background: "#170510",
    gridColor: "#7c2d12",
    glow: false,
    palette: ["#fb923c", "#f87171", "#facc15", "#fb7185", "#fbbf24", "#f472b6"],
  },
  {
    id: "mono",
    name: "Mono",
    background: "#050505",
    gridColor: "#333333",
    glow: false,
    palette: ["#f5f5f5", "#a3a3a3", "#e5e5e5", "#d4d4d4", "#c4c4c4", "#8a8a8a"],
  },
];

export const DEFAULT_VIZ_THEME = VIZ_THEMES[0];

const STORAGE_KEY = "jarvis-viz-theme";

export function loadVizTheme(): VizTheme {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return VIZ_THEMES.find((t) => t.id === id) ?? DEFAULT_VIZ_THEME;
  } catch {
    return DEFAULT_VIZ_THEME;
  }
}

export function saveVizTheme(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore — theme just won't persist */
  }
}

/**
 * Deterministically remaps the distinct colors used in a scene to a theme's
 * palette, preserving which-object-is-which-color distinctness (e.g. "target"
 * vs "approximation" curves) while reskinning the overall look.
 */
export function buildColorMap(usedColors: string[], palette: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const c of usedColors) {
    if (map.has(c)) continue;
    map.set(c, palette[i % palette.length]);
    i++;
  }
  return map;
}
