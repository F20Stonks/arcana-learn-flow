/**
 * Drills — timed practice games sharing one engine (src/features/drills). Eleven games live: the
 * arithmetic/number-theory/algebra/logic/probability/trading roster plus three topology games
 * (Invariant Match, Bridge Run, Knot or Not) built on real, correctly-labeled math rather than
 * improvised drawings.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Zap, Hash, Sigma, CircleDot, Shapes, Dices, TrendingUp, Info, Play, Trophy } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { DRILL_LIST } from "@/features/drills/registry";
import { fetchPersonalBests, type DrillBest } from "@/features/drills/engine/persistence";
import type { DrillDefinition } from "@/features/drills/types";

const DOMAIN_ICON: Record<DrillDefinition["domain"], typeof Zap> = {
  arithmetic: Zap,
  "number-theory": Hash,
  algebra: Sigma,
  logic: CircleDot,
  topology: Shapes,
  probability: Dices,
  trading: TrendingUp,
};

export default function DrillsHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bests, setBests] = useState<Record<string, DrillBest>>({});
  const [tab, setTab] = useState<Record<string, "play" | "info">>({});

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
            Short, timed, against the clock. Built to keep fast recall — arithmetic, number theory,
            probability, algebra, and topology — from ever going stale.
          </p>
          <Link
            to="/leaderboards"
            className="group mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Trophy className="h-3.5 w-3.5" /> Leaderboards
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </header>

        {loading ? (
          <div className="flex items-center gap-3 py-16">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-[14px] text-muted-foreground">Loading your bests…</p>
          </div>
        ) : (
          <div className="reveal flex flex-col gap-4" style={{ animationDelay: "60ms" }}>
            {DRILL_LIST.map((def) => {
              const activeTab = tab[def.key] ?? "play";
              const Icon = DOMAIN_ICON[def.domain];
              return (
                <div key={def.key} className="glass-card rounded-2xl p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-[17px] font-semibold text-foreground">{def.name}</h2>
                        <p className="text-[13.5px] text-muted-foreground">{def.tagline}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 rounded-full border border-border bg-secondary/40 p-0.5">
                      <button
                        onClick={() => setTab((t) => ({ ...t, [def.key]: "play" }))}
                        aria-pressed={activeTab === "play"}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                          activeTab === "play" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Play className="h-3 w-3" /> Play
                      </button>
                      <button
                        onClick={() => setTab((t) => ({ ...t, [def.key]: "info" }))}
                        aria-pressed={activeTab === "info"}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                          activeTab === "info" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Info className="h-3 w-3" /> Rules
                      </button>
                    </div>
                  </div>

                  {activeTab === "info" ? (
                    <p className="text-[13.5px] leading-relaxed text-muted-foreground">{def.rules}</p>
                  ) : (
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
