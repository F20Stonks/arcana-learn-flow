/**
 * App-wide appearance themes — Dark/Light/Neon/etc, distinct from vizThemes.ts (which only
 * recolours Math Theater visualization scenes). Each theme is a full CSS-variable override
 * block, defined in index.css under `:root[data-theme="<id>"]`, activated by setting that
 * attribute on <html>. "Dark" has no override block — it IS the base `:root` values, kept
 * exactly as the app's original/default look.
 *
 * This is intentionally decoupled from CustomizeMenu's existing accent-color picker
 * (`jarvis_accent`, applyAccent/applyStoredAccent): a theme sets a full palette including its
 * own default --primary, while a custom accent is a further override on top, applied via
 * inline style (which always wins over the attribute-selector rules below). Picking a new
 * theme clears any custom accent override so the theme's intended palette shows cleanly —
 * see CustomizeMenu's selectTheme.
 */

export interface AppTheme {
  id: string;
  name: string;
  description: string;
  /** Enough of the real palette to render a small preview chip in the picker. */
  preview: { background: string; card: string; foreground: string; primary: string };
}

export const APP_THEMES: AppTheme[] = [
  {
    id: "dark",
    name: "Dark",
    description: "Obsidian instrument — the original look.",
    preview: { background: "hsl(240 9% 4%)", card: "hsl(240 7% 8%)", foreground: "hsl(240 10% 96%)", primary: "hsl(198 93% 60%)" },
  },
  {
    id: "light",
    name: "Light",
    description: "Same instrument, daylight surface.",
    preview: { background: "hsl(220 20% 98%)", card: "hsl(0 0% 100%)", foreground: "hsl(222 20% 12%)", primary: "hsl(217 91% 48%)" },
  },
  {
    id: "neon",
    name: "Neon",
    description: "Darker ground, saturated glow.",
    preview: { background: "hsl(260 45% 4%)", card: "hsl(262 40% 7%)", foreground: "hsl(200 20% 95%)", primary: "hsl(180 100% 50%)" },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep indigo, cooler and calmer.",
    preview: { background: "hsl(226 45% 6%)", card: "hsl(226 40% 10%)", foreground: "hsl(220 25% 95%)", primary: "hsl(243 85% 67%)" },
  },
  {
    id: "paper",
    name: "Paper",
    description: "Warm, low-glare reading mode.",
    preview: { background: "hsl(40 38% 94%)", card: "hsl(40 45% 97%)", foreground: "hsl(25 30% 18%)", primary: "hsl(20 75% 40%)" },
  },
];

export const DEFAULT_APP_THEME = APP_THEMES[0];

const STORAGE_KEY = "jarvis_theme";

export function loadStoredThemeId(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return id && APP_THEMES.some((t) => t.id === id) ? id : DEFAULT_APP_THEME.id;
  } catch {
    return DEFAULT_APP_THEME.id;
  }
}

/** Applies the saved theme to <html>. Call as early as possible (see main.tsx) to avoid a
 *  flash of the wrong theme — mirrors applyStoredAccent's role for the accent colour. */
export function applyStoredTheme() {
  document.documentElement.setAttribute("data-theme", loadStoredThemeId());
}

export function applyTheme(id: string) {
  document.documentElement.setAttribute("data-theme", id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore — theme just won't persist */
  }
}
