import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { DRILL_REGISTRY } from "@/features/drills/registry";
import { fetchPersonalBests } from "@/features/drills/engine/persistence";
import DrillRunner from "@/features/drills/components/DrillRunner";
import type { DrillMode } from "@/features/drills/types";

const OPERATOR_LABELS: Record<string, string> = { add: "+", sub: "−", mul: "×", div: "÷" };

export default function DrillPlay() {
  const { drillKey = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode = (params.get("mode") || "classic") as DrillMode;

  const def = DRILL_REGISTRY[drillKey];
  const [previousBest, setPreviousBest] = useState<number | undefined>(undefined);

  const [customOperators, setCustomOperators] = useState<string[]>(["add", "sub", "mul", "div"]);
  const [customMax, setCustomMax] = useState(100);
  const [customReady, setCustomReady] = useState(mode !== "custom");

  useEffect(() => {
    if (!user || !def) return;
    let cancelled = false;
    fetchPersonalBests(user.id).then((bests) => {
      if (!cancelled) setPreviousBest(bests[`${def.key}:${mode}`]?.score);
    });
    return () => {
      cancelled = true;
    };
  }, [user, def, mode]);

  if (!def) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-5 pt-14 text-center">
          <p className="text-foreground">Unknown drill.</p>
          <button onClick={() => navigate("/drills")} className="mt-3 text-sm text-primary hover:underline">
            Back to Drills
          </button>
        </main>
      </AppShell>
    );
  }

  if (mode === "custom" && !customReady) {
    return (
      <AppShell>
        <main className="mx-auto max-w-lg px-5 pb-24 pt-14">
          <h1 className="mb-1 font-display text-[24px] font-semibold text-foreground">Custom rig</h1>
          <p className="mb-6 text-[14px] text-muted-foreground">Pick operators and a number range, then start.</p>

          <div className="glass-card rounded-2xl p-5">
            <p className="mb-2 text-[13px] font-medium text-foreground">Operators</p>
            <div className="mb-5 flex gap-2">
              {Object.entries(OPERATOR_LABELS).map(([op, label]) => {
                const on = customOperators.includes(op);
                return (
                  <button
                    key={op}
                    onClick={() =>
                      setCustomOperators((prev) =>
                        on ? prev.filter((o) => o !== op) : [...prev, op],
                      )
                    }
                    className={`h-11 w-11 rounded-lg border text-lg font-semibold transition-colors ${
                      on
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <p className="mb-2 text-[13px] font-medium text-foreground">Max number</p>
            <input
              type="range"
              min={20}
              max={999}
              step={10}
              value={customMax}
              onChange={(e) => setCustomMax(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="readout mt-1 text-sm text-muted-foreground">up to {customMax}</p>

            <button
              onClick={() => setCustomReady(true)}
              disabled={customOperators.length === 0}
              className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </main>
      </AppShell>
    );
  }

  const config = mode === "custom" ? { operators: customOperators, max: customMax } : undefined;

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <DrillRunner
          def={def}
          mode={mode}
          durationS={def.defaultDurationS}
          config={config}
          previousBest={previousBest}
          onExit={() => navigate("/drills")}
        />
      </main>
    </AppShell>
  );
}
