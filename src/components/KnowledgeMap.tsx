import { useMemo, useState, useEffect } from "react";
import { Tables } from "@/integrations/supabase/types";
import { Maximize2, Minimize2, Check, ChevronDown, ChevronUp, Sparkles, Zap, Trophy } from "lucide-react";

type Topic = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

interface KnowledgeMapProps {
  topics: Topic[];
  trackTitle?: string;
  onSubtopicClick: (subtopicId: string) => void;
  onVerifyClick?: (subtopicId: string) => void;
}

/**
 * Vertical tech-tree knowledge map. Neon-mint gamified palette.
 * - Each topic is a collapsible vertical column of subtopic nodes.
 * - Node states: complete (solid mint + check), frontier (pulsing glow, "next up"), pending (dim).
 * - Hover a non-complete node → "I know this" button triggers verification flow.
 * - Fullscreen toggle. Scrolls horizontally when many topics.
 */
export default function KnowledgeMap({ topics, trackTitle, onSubtopicClick, onVerifyClick }: KnowledgeMapProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // "Frontier": first non-complete subtopic in the first topic that isn't fully done.
  const frontierId = useMemo(() => {
    for (const t of topics) {
      const next = t.subtopics.find(s => s.status !== "complete");
      if (next) return next.id;
    }
    return null;
  }, [topics]);

  const toggleCollapse = (id: string) => setCollapsed(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const shell = fullscreen
    ? "fixed inset-0 z-50 bg-[#0a1520]"
    : "relative w-full h-[75vh] min-h-[560px] bg-[#0a1520] border border-[#14b892]/20 rounded-2xl overflow-hidden";

  return (
    <div className={shell}>
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: "radial-gradient(ellipse at 20% 0%, rgba(45,212,168,0.15), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(115,255,184,0.08), transparent 60%)",
        }}
      />
      {/* Grid backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: "linear-gradient(rgba(115,255,184,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(115,255,184,0.6) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />

      {/* HUD: header */}
      <div className="relative z-10 flex items-center justify-between gap-4 px-5 pt-4 pb-3 border-b border-[#14b892]/15">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-[#2dd4a8] to-[#0d7a5f] flex items-center justify-center shadow-[0_0_24px_rgba(45,212,168,0.5)] shrink-0">
            <Trophy className="h-5 w-5 text-[#0a1520]" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#5eead4]/70">Mastery Path</p>
            <p className="text-sm font-semibold text-[#e6fffa] truncate">{trackTitle || "Learning Track"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* No track-level progress bar here — TrackOverview owns the single progress meter, directly
              above this component. Per-topic bars below stay: those say something the page-level
              meter doesn't. */}
          <button onClick={() => setFullscreen(f => !f)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#0d1b2a] border border-[#14b892]/25 text-[#5eead4] hover:text-[#73ffb8] hover:border-[#2dd4a8] transition-colors" title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Tech tree canvas */}
      <div className="relative z-10 h-[calc(100%-64px)] overflow-auto p-6">
        {topics.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#5eead4]/50 text-sm">No topics yet.</div>
        ) : (
          <div className="flex gap-6 min-w-max pb-4">
            {topics.map((topic, i) => (
              <TopicColumn
                key={topic.id}
                topic={topic}
                index={i}
                collapsed={collapsed.has(topic.id)}
                onToggleCollapse={() => toggleCollapse(topic.id)}
                frontierId={frontierId}
                onSubtopicClick={onSubtopicClick}
                onVerifyClick={onVerifyClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-[#0d1b2a]/90 backdrop-blur border border-[#14b892]/25 rounded-full px-4 py-1.5 text-[11px] text-[#5eead4]/80">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#73ffb8] shadow-[0_0_6px_#73ffb8]" />Mastered</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#fbbf24] shadow-[0_0_6px_#fbbf24] animate-pulse" />Next up</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#334155]" />Pending</span>
      </div>
    </div>
  );
}

/* -------------------- Topic column -------------------- */

function TopicColumn({
  topic, index, collapsed, onToggleCollapse, frontierId, onSubtopicClick, onVerifyClick,
}: {
  topic: Topic; index: number; collapsed: boolean; onToggleCollapse: () => void;
  frontierId: string | null;
  onSubtopicClick: (id: string) => void;
  onVerifyClick?: (id: string) => void;
}) {
  const done = topic.subtopics.filter(s => s.status === "complete").length;
  const total = topic.subtopics.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const fullyDone = done === total && total > 0;

  return (
    <div className="flex flex-col items-center w-[260px] shrink-0">
      {/* Topic header card */}
      <button
        onClick={onToggleCollapse}
        className={`w-full group relative rounded-xl border px-4 py-3 text-left transition-all ${
          fullyDone
            ? "border-[#73ffb8]/50 bg-linear-to-b from-[#134e3a] to-[#0d1b2a] shadow-[0_0_28px_rgba(115,255,184,0.25)]"
            : "border-[#14b892]/30 bg-[#0d1b2a] hover:border-[#2dd4a8]/60"
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono text-[#5eead4]/60 tabular-nums">T{String(index + 1).padStart(2, "0")}</span>
            {fullyDone && <Sparkles className="h-3.5 w-3.5 text-[#73ffb8]" />}
          </div>
          {collapsed
            ? <ChevronDown className="h-4 w-4 text-[#5eead4]/60 group-hover:text-[#73ffb8]" />
            : <ChevronUp className="h-4 w-4 text-[#5eead4]/60 group-hover:text-[#73ffb8]" />}
        </div>
        <p className="text-sm font-semibold text-[#e6fffa] leading-tight line-clamp-2">{topic.title}</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-[#0a1520] overflow-hidden border border-[#14b892]/15">
            <div className="h-full rounded-full bg-linear-to-r from-[#2dd4a8] to-[#73ffb8]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-[#5eead4]/70 tabular-nums">{done}/{total}</span>
        </div>
      </button>

      {/* Connector spine down */}
      {!collapsed && total > 0 && (
        <div className="w-px h-4 bg-linear-to-b from-[#2dd4a8]/60 to-[#2dd4a8]/20" />
      )}

      {/* Subtopic chain */}
      {!collapsed && (
        <div className="flex flex-col items-center gap-0 w-full">
          {topic.subtopics.map((sub, i) => {
            const isComplete = sub.status === "complete";
            const isFrontier = sub.id === frontierId;
            return (
              <div key={sub.id} className="flex flex-col items-center w-full">
                <SubtopicNode
                  sub={sub}
                  isComplete={isComplete}
                  isFrontier={isFrontier}
                  onClick={() => onSubtopicClick(sub.id)}
                  onVerify={onVerifyClick ? () => onVerifyClick(sub.id) : undefined}
                />
                {i < topic.subtopics.length - 1 && (
                  <div className={`w-px h-6 ${isComplete ? "bg-[#73ffb8]/60" : "bg-[#14b892]/25"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------- Subtopic node -------------------- */

function SubtopicNode({
  sub, isComplete, isFrontier, onClick, onVerify,
}: {
  sub: Tables<"subtopics">;
  isComplete: boolean;
  isFrontier: boolean;
  onClick: () => void;
  onVerify?: () => void;
}) {
  const [hover, setHover] = useState(false);

  const ringColor = isComplete ? "#73ffb8" : isFrontier ? "#fbbf24" : "#334155";
  const fillGrad = isComplete
    ? "linear-gradient(135deg,#2dd4a8,#134e3a)"
    : isFrontier
      ? "linear-gradient(135deg,#fbbf24,#78350f)"
      : "linear-gradient(135deg,#1e293b,#0d1b2a)";
  const glow = isComplete
    ? "0 0 22px rgba(115,255,184,0.55)"
    : isFrontier
      ? "0 0 26px rgba(251,191,36,0.65)"
      : "0 0 0 rgba(0,0,0,0)";

  return (
    <div
      className="relative w-full flex items-center gap-3 py-1.5 px-2 rounded-lg group"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Orb */}
      <button
        onClick={onClick}
        className={`relative shrink-0 h-12 w-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${isFrontier ? "animate-pulse-slow" : ""}`}
        style={{ background: fillGrad, boxShadow: glow, border: `2px solid ${ringColor}` }}
        title={sub.title}
      >
        {isComplete ? (
          <Check className="h-5 w-5 text-[#0a1520]" strokeWidth={3} />
        ) : isFrontier ? (
          <Zap className="h-5 w-5 text-[#78350f]" strokeWidth={2.5} />
        ) : (
          <span className="text-[11px] font-mono text-[#5eead4]/60">{sub.order_index + 1}</span>
        )}
        {isFrontier && (
          <span className="absolute -top-1 -right-1 text-[8px] font-bold uppercase tracking-wider bg-[#fbbf24] text-[#78350f] px-1.5 py-0.5 rounded-sm shadow">Next</span>
        )}
      </button>

      {/* Label + verify */}
      <div className="flex-1 min-w-0">
        <button
          onClick={onClick}
          className={`block text-left text-xs leading-tight truncate w-full transition-colors ${
            isComplete ? "text-[#73ffb8]" : isFrontier ? "text-[#fef3c7]" : "text-[#94a3b8] hover:text-[#e6fffa]"
          }`}
        >
          {sub.title}
        </button>
        {!isComplete && onVerify && hover && (
          <button
            onClick={(e) => { e.stopPropagation(); onVerify(); }}
            className="mt-1 text-[10px] uppercase tracking-wider text-[#5eead4] hover:text-[#73ffb8] underline decoration-dotted underline-offset-2"
          >
            I already know this — verify me
          </button>
        )}
      </div>
    </div>
  );
}