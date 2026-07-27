import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// A global concept dependency graph: nodes are atomic concepts, directed edges are prerequisite → dependent
// (derived from subtopic_concepts: within a subtopic, everything it REQUIRES points to everything it
// TEACHES). We render the subgraph around what the student knows — their known concepts plus the concepts
// one hop away (prerequisites they're missing and concepts their knowledge unlocks) — so the picture stays
// legible and answers "what do I know, and what does it lead to."

type ConceptRow = { id: string; name: string; type: string };
type EdgeRow = { subtopic_id: string; concept_id: string; role: string };

interface GNode { id: string; name: string; type: string; known: boolean; x: number; y: number }
interface GEdge { from: string; to: string }

const TYPE_COLOR: Record<string, string> = {
  notation: "hsl(190, 80%, 55%)",
  terminology: "hsl(239, 84%, 67%)",
  skill: "hsl(340, 75%, 60%)",
};

export default function ConceptGraph() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [edgesRaw, setEdgesRaw] = useState<EdgeRow[]>([]);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: cs }, { data: sc }, { data: uck }] = await Promise.all([
        supabase.from("concepts").select("id, name, type"),
        supabase.from("subtopic_concepts").select("subtopic_id, concept_id, role"),
        supabase.from("user_concept_knowledge").select("concept_id").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setConcepts((cs || []) as ConceptRow[]);
      setEdgesRaw((sc || []) as EdgeRow[]);
      setKnownIds(new Set(((uck || []) as { concept_id: string }[]).map((r) => r.concept_id)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const { nodes, edges } = useMemo(
    () => buildGraph(concepts, edgesRaw, knownIds),
    [concepts, edgesRaw, knownIds],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="py-2 space-y-3">
        <p className="text-sm text-muted-foreground text-center py-10 leading-relaxed">
          Your concept map builds itself as you complete sessions. Each concept you lock in appears here,
          wired to what it builds on and what it unlocks next.
        </p>
      </div>
    );
  }

  const W = 320, H = 320;

  return (
    <div className="py-2 space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Concepts you know, plus what they build on and unlock. Arrows point from a prerequisite to what it
        enables.
      </p>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ aspectRatio: "1 / 1" }}>
          <defs>
            <marker id="cg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" opacity="0.5" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const a = nodes.find((n) => n.id === e.from);
            const b = nodes.find((n) => n.id === e.to);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="var(--muted-foreground)" strokeOpacity={0.3} strokeWidth={1.2}
                markerEnd="url(#cg-arrow)"
              />
            );
          })}
          {nodes.map((n) => (
            <g key={n.id}>
              <circle
                cx={n.x} cy={n.y} r={n.known ? 8 : 6}
                fill={n.known ? TYPE_COLOR[n.type] || TYPE_COLOR.terminology : "var(--card)"}
                stroke={TYPE_COLOR[n.type] || TYPE_COLOR.terminology}
                strokeWidth={n.known ? 0 : 1.5}
                strokeOpacity={n.known ? 1 : 0.6}
              />
              <text
                x={n.x} y={n.y - 11} textAnchor="middle"
                className={n.known ? "fill-foreground" : "fill-muted-foreground"}
                style={{ fontSize: 8 }}
              >
                {n.name.length > 18 ? n.name.slice(0, 17) + "…" : n.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground flex-wrap">
        {(["terminology", "notation", "skill"] as const).map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLOR[t] }} />
            {t === "terminology" ? "term" : t}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border border-muted-foreground/60" /> not yet learned
        </span>
      </div>
    </div>
  );
}

function buildGraph(concepts: ConceptRow[], edgesRaw: EdgeRow[], knownIds: Set<string>): { nodes: GNode[]; edges: GEdge[] } {
  if (concepts.length === 0) return { nodes: [], edges: [] };
  const byId = new Map(concepts.map((c) => [c.id, c]));

  // Derive prerequisite → dependent edges: within each subtopic, every REQUIRED concept points to every
  // concept the subtopic TEACHES.
  const bySubtopic = new Map<string, { requires: string[]; teaches: string[] }>();
  for (const e of edgesRaw) {
    if (!byId.has(e.concept_id)) continue;
    const slot = bySubtopic.get(e.subtopic_id) || { requires: [], teaches: [] };
    if (e.role === "requires") slot.requires.push(e.concept_id);
    else if (e.role === "teaches") slot.teaches.push(e.concept_id);
    bySubtopic.set(e.subtopic_id, slot);
  }
  const edgeSet = new Set<string>();
  const allEdges: GEdge[] = [];
  for (const { requires, teaches } of bySubtopic.values()) {
    for (const from of requires) {
      for (const to of teaches) {
        if (from === to) continue;
        const key = `${from}>${to}`;
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        allEdges.push({ from, to });
      }
    }
  }

  // Focus on the student's frontier: known concepts + everything one hop away (missing prerequisites and
  // freshly-unlocked next steps). If nothing is known yet, there is no frontier to draw.
  const focus = new Set<string>(knownIds);
  if (focus.size === 0) return { nodes: [], edges: [] };
  for (const e of allEdges) {
    if (knownIds.has(e.from)) focus.add(e.to);
    if (knownIds.has(e.to)) focus.add(e.from);
  }
  const nodeIds = [...focus].filter((id) => byId.has(id)).slice(0, 40);
  const nodeIdSet = new Set(nodeIds);
  const edges = allEdges.filter((e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to));

  // Simple deterministic radial layout: known concepts on an inner ring, frontier on an outer ring.
  const W = 320, H = 320, cx = W / 2, cy = H / 2;
  const inner = nodeIds.filter((id) => knownIds.has(id));
  const outer = nodeIds.filter((id) => !knownIds.has(id));
  const place = (ids: string[], radius: number): GNode[] =>
    ids.map((id, i) => {
      const angle = ids.length === 1 ? -Math.PI / 2 : (i / ids.length) * Math.PI * 2 - Math.PI / 2;
      const c = byId.get(id)!;
      return {
        id, name: c.name, type: c.type, known: knownIds.has(id),
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });
  const nodes = [
    ...place(inner, outer.length ? 70 : 100),
    ...place(outer, 130),
  ];
  return { nodes, edges };
}
