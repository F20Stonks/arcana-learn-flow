/**
 * Everything about the session workspace a student is allowed to bend to their own taste.
 *
 * One object, one localStorage key, one function that turns it into CSS custom properties. The
 * components then read the variables and never the preference object — so adding a control later
 * means adding a variable, not threading a prop through five layers. Anything that can't be
 * expressed as a variable (the reveal pace, which is a number a hook consumes) is exported as a
 * plain lookup instead.
 *
 * Defaults reproduce exactly what the workspace looked like before any of this existed, so a
 * student who never opens Settings sees no change at all.
 */

export type FontChoice = "sans" | "serif" | "mono";
export type Density = "compact" | "normal" | "roomy";
export type RevealPace = "instant" | "calm" | "steady" | "brisk";
export type GridStrength = "off" | "faint" | "normal" | "strong";
export type AccentId = "theme" | "sky" | "violet" | "emerald" | "amber" | "rose";

export interface SessionPrefs {
  /** Typeface for lesson prose. Math always stays in the KaTeX face. */
  font: FontChoice;
  /** Multiplier on the base prose size (13.5px). */
  textScale: number;
  lineHeight: number;
  /** Multiplier on rendered math, independent of prose — the two rarely want the same size. */
  mathScale: number;
  density: Density;
  reveal: RevealPace;
  animations: boolean;
  grid: GridStrength;
  /** Canvas backdrop shade: negative darkens, positive lightens, 0 leaves the theme alone. */
  tone: number;
  accent: AccentId;
}

export const DEFAULT_PREFS: SessionPrefs = {
  font: "sans",
  textScale: 1,
  lineHeight: 1.85,
  mathScale: 1,
  density: "normal",
  reveal: "steady",
  animations: true,
  grid: "normal",
  tone: 0,
  accent: "theme",
};

const STORAGE_KEY = "sessionPrefs.v1";

const FONT_STACKS: Record<FontChoice, string> = {
  sans: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', 'Source Serif 4', Georgia, Cambria, serif",
  mono: "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace",
};

export const FONT_LABELS: Record<FontChoice, string> = {
  sans: "Sans",
  serif: "Serif",
  mono: "Mono",
};

/** Padding inside a card, the gap between stacked cards, and the default card width. */
const DENSITY_SCALE: Record<Density, { pad: number; gap: number; card: number }> = {
  compact: { pad: 16, gap: 44, card: 470 },
  normal: { pad: 24, gap: 76, card: 540 },
  roomy: { pad: 34, gap: 108, card: 640 },
};

/** Characters-per-frame multiplier for the streamed-text reveal. 0 means "don't animate at all". */
export const REVEAL_RATE: Record<RevealPace, number> = {
  instant: 0,
  calm: 0.5,
  steady: 1,
  brisk: 2.2,
};

const GRID_ALPHA: Record<GridStrength, number> = {
  off: 0,
  faint: 0.16,
  normal: 0.35,
  strong: 0.62,
};

export const ACCENTS: { id: AccentId; label: string; swatch: string; css: string | null }[] = [
  { id: "theme", label: "Theme", swatch: "var(--primary)", css: null },
  { id: "sky", label: "Sky", swatch: "hsl(198 93% 60%)", css: "hsl(198 93% 60%)" },
  { id: "violet", label: "Violet", swatch: "hsl(262 83% 66%)", css: "hsl(262 83% 66%)" },
  { id: "emerald", label: "Emerald", swatch: "hsl(160 84% 45%)", css: "hsl(160 84% 45%)" },
  { id: "amber", label: "Amber", swatch: "hsl(38 92% 55%)", css: "hsl(38 92% 55%)" },
  { id: "rose", label: "Rose", swatch: "hsl(345 83% 62%)", css: "hsl(345 83% 62%)" },
];

export function loadSessionPrefs(): SessionPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const saved = JSON.parse(raw) as Partial<SessionPrefs>;
    // Merged over the defaults rather than trusted wholesale: a preference added in a later version
    // must not come back undefined for someone carrying an older blob.
    return { ...DEFAULT_PREFS, ...saved };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveSessionPrefs(prefs: SessionPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode — the session still works, it just won't remember */
  }
}

/** Default width of a turn card, in canvas units. */
export function cardWidth(prefs: SessionPrefs) {
  return DENSITY_SCALE[prefs.density].card;
}

/** Vertical gap between auto-flowed cards, in canvas units. */
export function cardGap(prefs: SessionPrefs) {
  return DENSITY_SCALE[prefs.density].gap;
}

/**
 * The preferences as CSS custom properties, to be spread onto the session frame's style. Everything
 * inside the session inherits them; nothing outside it is touched.
 */
export function prefsToVars(prefs: SessionPrefs): Record<string, string> {
  const d = DENSITY_SCALE[prefs.density];
  const accent = ACCENTS.find((a) => a.id === prefs.accent)?.css ?? null;
  const tone =
    prefs.tone === 0
      ? "transparent"
      : prefs.tone < 0
        ? `rgba(0,0,0,${(Math.min(40, -prefs.tone) / 100).toFixed(3)})`
        : `rgba(255,255,255,${(Math.min(40, prefs.tone) / 100).toFixed(3)})`;

  const vars: Record<string, string> = {
    "--sx-font": FONT_STACKS[prefs.font],
    "--sx-text": `${(13.5 * prefs.textScale).toFixed(2)}px`,
    "--sx-text-sm": `${(12.5 * prefs.textScale).toFixed(2)}px`,
    "--sx-leading": String(prefs.lineHeight),
    "--sx-math": String(prefs.mathScale),
    "--sx-pad": `${d.pad}px`,
    "--sx-pad-tight": `${Math.round(d.pad * 0.55)}px`,
    "--sx-grid": String(GRID_ALPHA[prefs.grid]),
    "--sx-tone": tone,
  };
  // Overriding --primary inside the frame re-tints every control in the session that already reads
  // it, which is all of them — no per-component accent plumbing needed.
  if (accent) vars["--primary"] = accent;
  return vars;
}
