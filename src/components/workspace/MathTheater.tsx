import { useEffect, useMemo, useState } from "react";
import { Bookmark, Library, Trash2, Atom, Sigma } from "lucide-react";
import VectorFieldEnvironment from "./VectorFieldEnvironment";
import WrappedPeriodicEnvironment from "./WrappedPeriodicEnvironment";
import MathRenderer from "@/components/MathRenderer";
import { mathTheme, EnvironmentKind, MathMode } from "@/lib/mathTheme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  subtopicId?: string;
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

// Labels per environment + mode (the isomorphism)
const labels: Record<EnvironmentKind, Record<MathMode, { title: string; subtitle: string; formulas: string[] }>> = {
  vector: {
    pure: {
      title: "Multivariable Calculus",
      subtitle: "Gradient Descent Optimization",
      formulas: ["$\\vec{v}(x,y) = -\\nabla f(x,y)$", "$f(x,y) = \\tfrac{1}{2}(x^2 + y^2)$"],
    },
    applied: {
      title: "Plasma Physics",
      subtitle: "Magnetic Confinement & Lorentz Force Tracking",
      formulas: ["$\\vec{F} = q(\\vec{E} + \\vec{v}\\times\\vec{B})$", "Confinement minimizes drift across $\\vec{B}$ lines"],
    },
  },
  wrapped: {
    pure: {
      title: "Modular Arithmetic",
      subtitle: "Chinese Remainder Theorem on $\\mathbb{Z}/n\\mathbb{Z}$",
      formulas: ["$x \\equiv a \\pmod{n}$", "$\\mathbb{Z}/m \\times \\mathbb{Z}/n \\cong \\mathbb{Z}/mn$"],
    },
    applied: {
      title: "Periodic Phase Space",
      subtitle: "Toroidal motion of coupled oscillators",
      formulas: ["$\\theta_1(t) = \\omega_1 t \\pmod{2\\pi}$", "$\\theta_2(t) = \\omega_2 t \\pmod{2\\pi}$"],
    },
  },
};

export default function MathTheater({ subtopicId }: Props) {
  const { user } = useAuth();
  const [env, setEnv] = useState<EnvironmentKind>("vector");
  const [mode, setMode] = useState<MathMode>("pure");
  const [tab, setTab] = useState<"theater" | "library">("theater");

  // Vector params
  const [strength, setStrength] = useState(1.2);
  const [particles, setParticles] = useState(220);
  const [fxExpr, setFxExpr] = useState("-x");
  const [fyExpr, setFyExpr] = useState("-y");

  // Wrapped params
  const [slope, setSlope] = useState(1.61);
  const [period, setPeriod] = useState(10);
  const [speed, setSpeed] = useState(1.5);
  const [wxExpr] = useState("t");
  const [wyExpr] = useState("slope * t");

  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);

  const meta = labels[env][mode];

  const loadInsights = async () => {
    if (!user) return;
    setLoadingLib(true);
    const { data } = await supabase
      .from("insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setInsights((data as unknown as InsightRow[]) || []);
    setLoadingLib(false);
  };

  useEffect(() => {
    if (tab === "library") loadInsights();
  }, [tab, user]);

  const currentParams = useMemo<Record<string, number>>(() => {
    return env === "vector"
      ? { strength, particles }
      : { slope, period, speed };
  }, [env, strength, particles, slope, period, speed]);

  const saveInsight = async () => {
    if (!user) return;
    const formulas =
      env === "vector" ? [`fx = ${fxExpr}`, `fy = ${fyExpr}`, ...meta.formulas] : [`x(t) = ${wxExpr}`, `y(t) = ${wyExpr}`, ...meta.formulas];
    const { error } = await supabase.from("insights").insert({
      user_id: user.id,
      subtopic_id: subtopicId ?? null,
      title: `${meta.title} · ${meta.subtitle}`,
      environment: env,
      mode,
      formulas,
      params: currentParams,
    });
    if (error) toast.error("Couldn't save insight");
    else {
      toast.success("Saved to your Insights Library");
      if (tab === "library") loadInsights();
    }
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
          <button
            onClick={() => setTab("theater")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "theater" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Math Theater
          </button>
          <button
            onClick={() => setTab("library")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              tab === "library" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Library className="h-3.5 w-3.5" /> Insights
          </button>
        </div>

        {tab === "theater" && (
          <div className="flex items-center gap-2">
            {/* Env selector */}
            <div className="flex rounded-md overflow-hidden border" style={{ borderColor: mathTheme.grid }}>
              <button
                onClick={() => setEnv("vector")}
                className={`px-2.5 py-1 text-[11px] ${env === "vector" ? "bg-sky-500/20 text-sky-200" : "text-slate-400"}`}
              >Vector Field</button>
              <button
                onClick={() => setEnv("wrapped")}
                className={`px-2.5 py-1 text-[11px] ${env === "wrapped" ? "bg-sky-500/20 text-sky-200" : "text-slate-400"}`}
              >Wrapped Periodic</button>
            </div>
            {/* Isomorphism toggle */}
            <button
              onClick={() => setMode(mode === "pure" ? "applied" : "pure")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] border transition-colors"
              style={{ borderColor: mathTheme.grid, color: mathTheme.text }}
              title="Toggle Pure ↔ Applied"
            >
              {mode === "pure" ? <Sigma className="h-3.5 w-3.5 text-sky-300" /> : <Atom className="h-3.5 w-3.5 text-violet-300" />}
              <span className="capitalize">{mode === "pure" ? "Pure Math" : "Applied Physics"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Theater body (canvas always mounted to keep 60fps) */}
      <div className={`relative flex-1 min-h-0 ${tab === "theater" ? "" : "hidden"}`}>
        {env === "vector" ? (
          <VectorFieldEnvironment fxExpr={fxExpr} fyExpr={fyExpr} particleCount={particles} strength={strength} />
        ) : (
          <WrappedPeriodicEnvironment fxExpr={wxExpr} fyExpr={wyExpr} slope={slope} period={period} speed={speed} />
        )}

        {/* Overlay: title + formulas */}
        <div className="absolute top-3 left-3 right-3 pointer-events-none">
          <div className="rounded-lg backdrop-blur-sm bg-black/30 border border-white/5 px-3 py-2 max-w-[60%]">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: mathTheme.textDim }}>
              {meta.title}
            </div>
            <div className="text-sm font-semibold" style={{ color: mathTheme.text }}>{meta.subtitle}</div>
            <div className="mt-1 text-xs space-y-0.5" style={{ color: mathTheme.text }}>
              {meta.formulas.map((f, i) => (
                <div key={i}><MathRenderer content={f} /></div>
              ))}
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={saveInsight}
          className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-100 text-xs font-medium transition-colors"
        >
          <Bookmark className="h-3.5 w-3.5" /> Save to Notebook
        </button>

        {/* Sliders */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 backdrop-blur-sm bg-black/40 border-t" style={{ borderColor: mathTheme.grid }}>
          {env === "vector" ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]" style={{ color: mathTheme.text }}>
              <Slider label={`Strength · ${strength.toFixed(2)}`} value={strength} min={0.1} max={4} step={0.05} onChange={setStrength} />
              <Slider label={`Particles · ${particles}`} value={particles} min={20} max={300} step={10} onChange={(v) => setParticles(Math.round(v))} />
              <TextField label="f_x(x,y)" value={fxExpr} onChange={setFxExpr} />
              <TextField label="f_y(x,y)" value={fyExpr} onChange={setFyExpr} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-[11px]" style={{ color: mathTheme.text }}>
              <Slider label={`Slope · ${slope.toFixed(2)}`} value={slope} min={0.1} max={4} step={0.01} onChange={setSlope} />
              <Slider label={`Period · ${period.toFixed(1)}`} value={period} min={2} max={20} step={0.5} onChange={setPeriod} />
              <Slider label={`Speed · ${speed.toFixed(2)}`} value={speed} min={0.2} max={6} step={0.1} onChange={setSpeed} />
            </div>
          )}
        </div>
      </div>

      {/* Library tab */}
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
                  {(it.formulas || []).map((f, i) => (
                    <div key={i}><MathRenderer content={f} /></div>
                  ))}
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

function Slider({
  label, value, min, max, step, onChange,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="accent-sky-400"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="px-2 py-1 rounded bg-black/40 border border-white/10 text-xs text-slate-100 font-mono outline-none focus:border-sky-400/60"
      />
    </label>
  );
}