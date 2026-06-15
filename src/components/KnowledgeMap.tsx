import { useMemo, useRef, useState, useEffect } from "react";
import { Tables } from "@/integrations/supabase/types";
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

type Topic = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

interface KnowledgeMapProps {
  topics: Topic[];
  trackTitle?: string;
  onSubtopicClick: (subtopicId: string) => void;
}

const STATUS_COLORS: Record<string, { fill: string; ring: string }> = {
  complete:   { fill: "hsl(142, 71%, 45%)", ring: "hsl(142, 71%, 55%)" },
  in_progress:{ fill: "hsl(38, 92%, 50%)",  ring: "hsl(38, 92%, 60%)"  },
  review_due: { fill: "hsl(0, 84%, 60%)",   ring: "hsl(0, 84%, 70%)"   },
  unlocked:   { fill: "hsl(239, 84%, 67%)", ring: "hsl(239, 84%, 75%)" },
  locked:     { fill: "hsl(0, 0%, 25%)",    ring: "hsl(0, 0%, 35%)"    },
};

const TOPIC_PALETTE = [
  "hsl(239, 84%, 67%)", "hsl(190, 80%, 55%)", "hsl(340, 75%, 60%)",
  "hsl(150, 60%, 50%)", "hsl(40, 90%, 60%)",  "hsl(280, 70%, 65%)",
  "hsl(15, 85%, 60%)",  "hsl(210, 70%, 60%)",
];

export default function KnowledgeMap({ topics, trackTitle, onSubtopicClick }: KnowledgeMapProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const layout = useMemo(() => computeRadialLayout(topics), [topics]);

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom((z) => Math.max(0.3, Math.min(3, z + delta)));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPan({ x: dragRef.current.px + (e.clientX - dragRef.current.x), y: dragRef.current.py + (e.clientY - dragRef.current.y) });
  };
  const onMouseUp = () => { dragRef.current = null; };

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-background"
    : "relative w-full h-[70vh] min-h-[500px] bg-card border border-border rounded-xl overflow-hidden";

  const total = topics.reduce((a, t) => a + t.subtopics.length, 0);
  const done = topics.reduce((a, t) => a + t.subtopics.filter(s => s.status === "complete").length, 0);

  return (
    <div className={containerClass}>
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 bg-card/90 backdrop-blur border border-border rounded-lg p-1">
        <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></button>
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></button>
        <button onClick={reset} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title="Reset view"><RotateCcw className="h-3.5 w-3.5" /></button>
        <button onClick={() => setFullscreen(f => !f)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-3 left-3 z-10 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mastery</p>
        <p className="text-sm font-semibold text-foreground">{done}/{total} <span className="text-xs text-muted-foreground font-normal">subtopics</span></p>
      </div>

      {/* Canvas */}
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transformOrigin: "center" }}>
            {/* Topic -> subtopic edges */}
            {layout.edges.map((e, i) => (
              <path
                key={`e-${i}`}
                d={`M ${e.x1} ${e.y1} C ${e.x1} ${(e.y1 + e.y2) / 2}, ${e.x2} ${(e.y1 + e.y2) / 2}, ${e.x2} ${e.y2}`}
                stroke={e.color}
                strokeWidth={2}
                strokeOpacity={0.4}
                fill="none"
              />
            ))}

            {/* Center -> topic edges */}
            {layout.centerEdges.map((e, i) => (
              <line
                key={`ce-${i}`}
                x1={layout.centerX} y1={layout.centerY}
                x2={e.x} y2={e.y}
                stroke={e.color}
                strokeWidth={3}
                strokeOpacity={0.5}
              />
            ))}

            {/* Root node */}
            <g data-node>
              <circle cx={layout.centerX} cy={layout.centerY} r={48} fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={2} />
              <text x={layout.centerX} y={layout.centerY} textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
                {truncate(trackTitle || "Track", 12)}
              </text>
            </g>

            {/* Topic nodes */}
            {layout.topicNodes.map((t) => (
              <g key={t.id} data-node>
                <circle cx={t.x} cy={t.y} r={32} fill={t.color} fillOpacity={0.15} stroke={t.color} strokeWidth={2} />
                <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 11, fontWeight: 600 }}>
                  {truncate(t.title, 14)}
                </text>
              </g>
            ))}

            {/* Subtopic nodes */}
            {layout.subNodes.map((n) => {
              const c = STATUS_COLORS[n.status] || STATUS_COLORS.unlocked;
              return (
                <g key={n.id} data-node className="cursor-pointer" onClick={() => onSubtopicClick(n.id)}>
                  <circle cx={n.x} cy={n.y} r={22} fill={c.fill} stroke={c.ring} strokeWidth={2} />
                  {n.status === "complete" && (
                    <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 14, fill: "white", fontWeight: 700 }}>✓</text>
                  )}
                  <text x={n.x} y={n.y + 38} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
                    {truncate(n.title, 18)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-card/90 backdrop-blur border border-border rounded-full px-4 py-1.5 text-xs text-muted-foreground">
        {[
          { label: "Complete", color: STATUS_COLORS.complete.fill },
          { label: "In progress", color: STATUS_COLORS.in_progress.fill },
          { label: "To do", color: STATUS_COLORS.unlocked.fill },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
        <span className="text-muted-foreground/60 ml-2">· drag · scroll to zoom</span>
      </div>
    </div>
  );
}

interface SubNode { id: string; x: number; y: number; title: string; status: string }
interface TopicNode { id: string; x: number; y: number; title: string; color: string }
interface Edge { x1: number; y1: number; x2: number; y2: number; color: string }
interface Layout {
  centerX: number; centerY: number; width: number; height: number;
  topicNodes: TopicNode[]; subNodes: SubNode[];
  edges: Edge[]; centerEdges: { x: number; y: number; color: string }[];
}

function computeRadialLayout(topics: Topic[]): Layout {
  const W = 1400, H = 1000;
  const cx = W / 2, cy = H / 2;
  const topicNodes: TopicNode[] = [];
  const subNodes: SubNode[] = [];
  const edges: Edge[] = [];
  const centerEdges: { x: number; y: number; color: string }[] = [];

  if (topics.length === 0) return { centerX: cx, centerY: cy, width: W, height: H, topicNodes, subNodes, edges, centerEdges };

  const topicRadius = 260;
  const subRadius = 130;

  topics.forEach((topic, i) => {
    const angle = (i / topics.length) * Math.PI * 2 - Math.PI / 2;
    const tx = cx + Math.cos(angle) * topicRadius;
    const ty = cy + Math.sin(angle) * topicRadius;
    const color = TOPIC_PALETTE[i % TOPIC_PALETTE.length];
    topicNodes.push({ id: topic.id, x: tx, y: ty, title: topic.title, color });
    centerEdges.push({ x: tx, y: ty, color });

    const subs = topic.subtopics;
    if (subs.length === 0) return;

    // Spread subtopics in an arc on the outside of the topic node
    const arcSpan = Math.min(Math.PI * 0.9, 0.35 + subs.length * 0.2);
    const startA = angle - arcSpan / 2;
    subs.forEach((sub, j) => {
      const a = subs.length === 1 ? angle : startA + (j / (subs.length - 1)) * arcSpan;
      const sx = tx + Math.cos(a) * subRadius;
      const sy = ty + Math.sin(a) * subRadius;
      subNodes.push({ id: sub.id, x: sx, y: sy, title: sub.title, status: sub.status });
      edges.push({ x1: tx, y1: ty, x2: sx, y2: sy, color });
    });
  });

  return { centerX: cx, centerY: cy, width: W, height: H, topicNodes, subNodes, edges, centerEdges };
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}