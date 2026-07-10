import { useEffect, useMemo, useState } from "react";
import { Bookmark, Library, Trash2 } from "lucide-react";
import SimulationFactory from "./SimulationFactory";
import Scene3D from "./Scene3D";
import MathRenderer from "@/components/MathRenderer";
import { mathTheme, MathMode } from "@/lib/mathTheme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { SimulationPayload } from "@/lib/simulationPayload";
import { isSceneSpec, type SceneSpec } from "@/lib/sceneSpec";

type Payload = SimulationPayload | SceneSpec;

interface VizHistoryEntry {
  id: string;
  payload: Payload;
  preview: string;
  messageIndex: number;
}

interface Props {
  subtopicId?: string;
  payload: Payload;
  history?: VizHistoryEntry[];
  activeVizId?: string | null;
  onSelectViz?: (id: string) => void;
}

interface InsightRow {
  id: string;
  title: string;
  environment: string;
  mode: string;
  formulas: string[];
  params: Record<string, number>;
  created_at: string;
}

// Mode keys map: "abstract" / "applied" from payload, mirrored onto MathMode union.
const MODE_ABSTRACT: MathMode = "pure";
const MODE_APPLIED: MathMode = "applied";

export default function MathTheater({
  subtopicId,
  payload,
  history = [],
  activeVizId = null,
  onSelectViz,
}: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<MathMode>(MODE_ABSTRACT);
  const [tab, setTab] = useState<"theater" | "library">("theater");
  const [time, setTime] = useState(0);

  const isScene = isSceneSpec(payload);

  // Build initial slider params from payload — fully data-driven.
  const initialParams = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    const sliders = isSceneSpec(payload)
      ? payload.sliders ?? []
      : (payload.config as { sliders?: { key: string; default: number }[] }).sliders ?? [];
    for (const s of sliders) out[s.key] = s.default;
    return out;
  }, [payload]);

  const [params, setParams] = useState<Record<string, number>>(initialParams);
  // reset params when payload changes (e.g. lesson switch)
  useEffect(() => { setParams(initialParams); }, [initialParams]);

  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);

  const meta = isScene
    ? {
        title: (payload as SceneSpec).title,
        subtitle: (payload as SceneSpec).caption ?? "",
        formulas: (payload as SceneSpec).why ? [(payload as SceneSpec).why!] : [],
      }
    : mode === MODE_APPLIED
      ? (payload as SimulationPayload).labels.applied
      : (payload as SimulationPayload).labels.abstract;

  const sliders = isScene
    ? (payload as SceneSpec).sliders ?? []
    : ((payload as SimulationPayload).config as { sliders?: import("@/lib/simulationPayload").NumericSlider[] }).sliders ?? [];

  const loadInsights = async () => {
    if (!user) return;
    setLoadingLib(true);
    const { data } = await supabase
      .from("insights").select("*")
      .order("created_at", { ascending: false }).limit(50);
    setInsights((data as unknown as InsightRow[]) || []);
    setLoadingLib(false);
  };

  useEffect(() => { if (tab === "library") loadInsights(); }, [tab, user]);

  const saveInsight = async () => {
    if (!user) return;
    const env = isScene ? "scene" : (payload as SimulationPayload).archetype;
    const title = isScene
      ? (payload as SceneSpec).title
      : `${meta.title} · ${(meta.subtitle ?? "").replace(/\$/g, "")}`;
    const { error } = await supabase.from("insights").insert({
      user_id: user.id,
      subtopic_id: subtopicId ?? null,
      title,
      environment: env,
      mode,
      formulas: meta.formulas,
      params,
    });
    if (error) toast.error("Couldn't save insight");
    else { toast.success("Saved to your Insights Library"); if (tab === "library") loadInsights(); }
  };

  const deleteInsight = async (id: string) => {
    await supabase.from("insights").delete().eq("id", id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="h-full flex flex-col" style={{ background: mathTheme.bg }}>
      {/* Header: tabs + toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: mathTheme.grid }}>
        <div className="flex items-center gap-1">
          <button onClick={() => setTab("theater")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "theater" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            Math Theater
          </button>
          <button onClick={() => setTab("library")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              tab === "library" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            <Library className="h-3.5 w-3.5" /> Insights
          </button>
        </div>

        {tab === "theater" && (
          <div className="flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border"
              style={{ borderColor: mathTheme.grid, color: mathTheme.textDim }}>
              {isScene ? "scene" : (payload as SimulationPayload).archetype.replace("_", " ")}
            </div>
          </div>
        )}
      </div>

      {/* Theater body */}
      <div className={`relative flex-1 min-h-0 ${tab === "theater" ? "" : "hidden"}`}>
        {isScene ? (
          <Scene3D spec={payload as SceneSpec} params={params} time={time} onTime={setTime} />
        ) : (
          <SimulationFactory payload={payload as SimulationPayload} params={params} />
        )}

        {/* Overlay: dynamic labels from payload */}
        <div className="absolute top-3 left-3 right-3 pointer-events-none">
          <div className="rounded-lg backdrop-blur-sm bg-black/30 border border-white/5 px-3 py-2 max-w-[60%]">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: mathTheme.textDim }}>
              {meta.title}
            </div>
            {meta.subtitle && (
              <div className="text-sm font-semibold" style={{ color: mathTheme.text }}>
                <MathRenderer content={meta.subtitle} />
              </div>
            )}
            <div className="mt-1 text-xs space-y-0.5" style={{ color: mathTheme.text }}>
              {meta.formulas.map((f, i) => (<div key={i}><MathRenderer content={f} /></div>))}
            </div>
            {isScene && (payload as SceneSpec).flat !== true && (
              <div className="mt-1 text-[10px]" style={{ color: mathTheme.textDim }}>
                Drag to orbit · scroll to zoom · right-click to pan
              </div>
            )}
          </div>
        </div>

        <button
          onClick={saveInsight}
          className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-100 text-xs font-medium transition-colors"
        >
          <Bookmark className="h-3.5 w-3.5" /> Save to Notebook
        </button>

        {/* Visualization history strip — AI-emitted vizzes the student can scrub back through */}
        {history.length > 0 && (
          <div
            className="absolute left-3 right-3 flex gap-2 overflow-x-auto pb-1 pt-2"
            style={{
              bottom: sliders.length > 0 ? 92 : 12,
              scrollbarWidth: "thin",
            }}
          >
            {history.map((h, idx) => {
              const active = h.id === activeVizId;
              return (
                <button
                  key={h.id}
                  onClick={() => onSelectViz?.(h.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider border transition-all backdrop-blur-sm ${
                    active
                      ? "bg-sky-500/30 border-sky-400/70 text-white"
                      : "bg-black/40 border-white/10 text-slate-300 hover:border-sky-400/40"
                  }`}
                  title={h.preview}
                >
                  <span className="opacity-60 mr-1">#{idx + 1}</span>
                  {h.preview}
                </button>
              );
            })}
          </div>
        )}

        {/* Dynamic sliders from payload */}
        {sliders.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3 backdrop-blur-sm bg-black/40 border-t" style={{ borderColor: mathTheme.grid }}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-[11px]" style={{ color: mathTheme.text }}>
              {sliders.map((s) => {
                const raw = params[s.key] ?? s.default;
                const num = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
                const safe = Number.isFinite(num) ? num : 0;
                const step = typeof s.step === "number" && s.step > 0 ? s.step : 0.1;
                return (
                  <Slider key={s.key}
                    label={`${s.label} · ${safe.toFixed(step < 1 ? 2 : 0)}`}
                    value={safe}
                    min={typeof s.min === "number" ? s.min : 0}
                    max={typeof s.max === "number" ? s.max : 1}
                    step={step}
                    onChange={(v) => setParams((p) => ({ ...p, [s.key]: v }))}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Library */}
      <div className={`flex-1 min-h-0 overflow-y-auto p-4 ${tab === "library" ? "" : "hidden"}`}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: mathTheme.text }}>My Insights Library</h3>
        {loadingLib ? (
          <p className="text-xs" style={{ color: mathTheme.textDim }}>Loading…</p>
        ) : insights.length === 0 ? (
          <p className="text-xs" style={{ color: mathTheme.textDim }}>No insights yet. Save a snapshot from the Math Theater.</p>
        ) : (
          <div className="space-y-2">
            {insights.map((it) => (
              <div key={it.id} className="rounded-lg border p-3" style={{ borderColor: mathTheme.grid, background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: mathTheme.text }}>{it.title}</div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: mathTheme.textDim }}>
                      {it.environment} · {it.mode}
                    </div>
                  </div>
                  <button onClick={() => deleteInsight(it.id)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 space-y-0.5 text-xs" style={{ color: mathTheme.text }}>
                  {(it.formulas || []).map((f, i) => (<div key={i}><MathRenderer content={f} /></div>))}
                </div>
                <div className="mt-1 text-[10px]" style={{ color: mathTheme.textDim }}>
                  {Object.entries(it.params || {}).map(([k, v]) => `${k}=${typeof v === "number" ? v.toFixed?.(2) ?? v : v}`).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="accent-sky-400" />
    </label>
  );
}