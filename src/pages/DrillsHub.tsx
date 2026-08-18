/**
 * Drills — timed practice games sharing one engine (src/features/drills). Zetamac++ is the first
 * game live; the rest of the retention-game roster (Modular Rush, Factor Sprint, Sieve Race, Venn
 * Blitz, Cayley Fill, and the topology games that need real diagram assets) lands on top of the
 * same engine without touching this page's shape.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Zap } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { DRILL_LIST } from "@/features/drills/registry";
import { fetchPersonalBests, type DrillBest } from "@/features/drills/engine/persistence";

export default function DrillsHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bests, setBests] = useState<Record<string, DrillBest>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchPersonalBests(user.id).then((b) => {
      if (!cancelled) {
        setBests(b);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Drills
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Short, timed, against the clock. Built to keep fast recall — arithmetic today, number
            theory and beyond next — from ever going stale.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center gap-3 py-16">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-[14px] text-muted-foreground">Loading your bests…</p>
          </div>
        ) : (
          <div className="reveal flex flex-col gap-4" style={{ animationDelay: "60ms" }}>
            {DRILL_LIST.map((def) => (
              <div key={def.key} className="glass-card rounded-2xl p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-[17px] font-semibold text-foreground">{def.name}</h2>
                      <p className="text-[13.5px] text-muted-foreground">{def.tagline}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {def.modes.map((m) => {
                    const best = bests[`${def.key}:${m.id}`];
                    return (
                      <button
                        key={m.id}
                        onClick={() => navigate(`/drills/${def.key}?mode=${m.id}`)}
                        className="group flex flex-col items-start gap-1 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                      >
                        <span className="text-[13px] font-medium text-foreground">{m.label}</span>
                        <span className="readout text-[12px] text-muted-foreground">
                          {best ? `${best.score}/min best` : "not run yet"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
