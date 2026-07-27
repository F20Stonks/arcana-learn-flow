import { useEffect, useState } from "react";
import { Palette, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ACCENTS: { name: string; hsl: string }[] = [
  { name: "Indigo", hsl: "hsl(239 84% 67%)" },
  { name: "Emerald", hsl: "hsl(152 76% 44%)" },
  { name: "Amber", hsl: "hsl(38 95% 58%)" },
  { name: "Rose", hsl: "hsl(346 84% 61%)" },
  { name: "Sky", hsl: "hsl(199 89% 58%)" },
  { name: "Violet", hsl: "hsl(270 84% 67%)" },
];

const EMOJIS = ["🧠", "🚀", "🦊", "🐙", "🪐", "⚡", "🌱", "🔥", "🌙", "🎯"];

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
  const stored = localStorage.getItem("jarvis_accent");
  if (stored) document.documentElement.style.setProperty("--primary", normalizeAccent(stored));
}

export default function CustomizeMenu() {
  const { user, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [emoji, setEmoji] = useState(profile?.avatar_url || "🧠");
  const [accent, setAccent] = useState<string>(() => {
    const stored = localStorage.getItem("jarvis_accent");
    return stored ? normalizeAccent(stored) : ACCENTS[0].hsl;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name || "");
    setEmoji(profile?.avatar_url || "🧠");
  }, [profile]);

  const applyAccent = (hsl: string) => {
    setAccent(hsl);
    document.documentElement.style.setProperty("--primary", hsl);
    localStorage.setItem("jarvis_accent", hsl);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null, avatar_url: emoji })
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
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
            aria-label="Customize"
          >
            <Palette className="h-[17px] w-[17px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Appearance</TooltipContent>
      </Tooltip>

      {open && (
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
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-hidden focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`h-10 w-10 rounded-lg border text-xl flex items-center justify-center transition-colors ${
                        emoji === e ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
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
        </div>
      )}
    </>
  );
}