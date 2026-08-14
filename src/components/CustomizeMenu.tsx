import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Palette, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { APP_THEMES, loadStoredThemeId, applyTheme } from "@/lib/appThemes";

const ACCENTS: { name: string; hsl: string }[] = [
  { name: "Cyan", hsl: "hsl(198 93% 60%)" },
  { name: "Indigo", hsl: "hsl(239 84% 67%)" },
  { name: "Emerald", hsl: "hsl(152 76% 44%)" },
  { name: "Amber", hsl: "hsl(38 95% 58%)" },
  { name: "Rose", hsl: "hsl(346 84% 61%)" },
  { name: "Violet", hsl: "hsl(270 84% 67%)" },
];

/**
 * Tailwind v4 moved the design tokens from bare HSL triplets ("239 84% 67%", wrapped by the
 * config as `hsl(var(--primary))`) to complete colour values. Accents saved under the old
 * scheme are still in localStorage and would now be written verbatim into `--primary`, where
 * a bare triplet is not a valid colour — every `bg-primary` surface would fail to paint.
 * Normalising on read keeps existing users on the exact accent they chose.
 */
function normalizeAccent(value: string): string {
  const v = value.trim();
  return v.startsWith("hsl(") ? v : `hsl(${v})`;
}

export function applyStoredAccent() {
  const stored = localStorage.getItem("cortexed_accent");
  if (stored) document.documentElement.style.setProperty("--primary", normalizeAccent(stored));
}

export default function CustomizeMenu() {
  const { user, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [accent, setAccent] = useState<string>(() => {
    const stored = localStorage.getItem("cortexed_accent");
    return stored ? normalizeAccent(stored) : ACCENTS[0].hsl;
  });
  const [themeId, setThemeId] = useState<string>(() => loadStoredThemeId());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name || "");
  }, [profile]);

  const applyAccent = (hsl: string) => {
    setAccent(hsl);
    document.documentElement.style.setProperty("--primary", hsl);
    localStorage.setItem("cortexed_accent", hsl);
  };

  const selectTheme = (id: string) => {
    setThemeId(id);
    applyTheme(id);
    // A theme sets its own default --primary; clear any custom accent override so that
    // default shows cleanly instead of an old accent bleeding through. The user can still
    // re-pick an accent afterward, independently, exactly as before.
    document.documentElement.style.removeProperty("--primary");
    localStorage.removeItem("cortexed_accent");
    setAccent("");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    // Deliberately does NOT touch avatar_url. This menu used to write an emoji into that column,
    // but SettingsPage renders the same column as an <img src> under an "Avatar URL" field — two
    // features fighting over one value, so picking an emoji here left a broken image there.
    // Identity (name, avatar) belongs to Settings; this menu is appearance only.
    await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("user_id", user.id);
    await refreshProfile();
    setSaving(false);
    setOpen(false);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Customize"
          >
            <Palette className="h-[17px] w-[17px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Appearance</TooltipContent>
      </Tooltip>

      {/*
        Portalled to document.body: CommandBar (this component's DOM parent) has
        `backdrop-blur-xl`, and any ancestor with `filter`/`backdrop-filter` establishes a new
        containing block for descendant `position: fixed` elements. Without the portal, this
        modal's `fixed inset-0` resolved against the ~64px header instead of the viewport,
        collapsing it into a tiny clipped sliver near the top of the page instead of a
        centered dialog. Portaling out from under the header restores the real viewport as
        the containing block regardless of the header's backdrop-blur (which stays — it's a
        deliberate part of the header's glass-instrument look, not the bug).
      */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-foreground">Customize</h2>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Theme</label>
                  <div className="grid grid-cols-3 gap-2">
                    {APP_THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => selectTheme(t.id)}
                        title={t.description}
                        className={`group relative flex flex-col gap-1.5 rounded-xl border-2 p-1.5 transition-all hover:scale-[1.02] ${
                          themeId === t.id ? "border-primary" : "border-transparent hover:border-border"
                        }`}
                      >
                        <div
                          className="relative h-11 w-full overflow-hidden rounded-lg border border-black/10"
                          style={{ background: t.preview.background }}
                        >
                          <div
                            className="absolute inset-x-1.5 top-1.5 bottom-3.5 rounded-[5px]"
                            style={{ background: t.preview.card }}
                          />
                          <div
                            className="absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full"
                            style={{ background: t.preview.primary }}
                          />
                          <div
                            className="absolute bottom-1.5 left-4 right-1.5 h-1.5 rounded-full opacity-60"
                            style={{ background: t.preview.foreground }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-foreground">{t.name}</span>
                        {themeId === t.id && (
                          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Display name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-hidden focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Accent color</label>
                  <div className="flex flex-wrap gap-2">
                    {ACCENTS.map((a) => (
                      <button
                        key={a.hsl}
                        onClick={() => applyAccent(a.hsl)}
                        className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-transform ${
                          accent === a.hsl ? "border-foreground scale-105" : "border-transparent hover:scale-105"
                        }`}
                        style={{ background: a.hsl }}
                        title={a.name}
                      >
                        {accent === a.hsl && <Check className="h-4 w-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}