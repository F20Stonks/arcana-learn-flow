import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { CheckCircle2, Circle, Loader2, ClipboardList, ExternalLink } from "lucide-react";

// spec_checklist_items isn't in the generated Supabase types yet — only exists once Lovable applies
// supabase/migrations/20260713150000_spec_checklist.sql and regenerates types.ts. Typed locally in the
// meantime, same pattern as TrackPapers.tsx before its migration landed.
interface SpecItem {
  id: string;
  topic_id: string | null;
  code: string | null;
  text: string;
  rigor: "simple" | "complex";
  evidence_requirements: string[];
  subtopic_ids: string[];
  source_url: string | null;
  ticked: boolean;
  ticked_at: string | null;
}

type Topic = Tables<"topics">;

export default function SpecChecklist({ trackId, topics, hasExamBoard }: { trackId: string; topics: Topic[]; hasExamBoard: boolean }) {
  const [items, setItems] = useState<SpecItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [noSpec, setNoSpec] = useState(false);

  useEffect(() => {
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  const loadExisting = async () => {
    setLoading(true);
    const { data } = await (supabase.from("spec_checklist_items" as never) as any)
      .select("*").eq("track_id", trackId);
    setItems((data || []) as SpecItem[]);
    setLoading(false);
  };

  const build = async () => {
    setBuilding(true);
    try {
      const resp = await supabase.functions.invoke("resolve-spec-checklist", { body: { trackId } });
      if (resp.data?.noSpec) { setNoSpec(true); setItems([]); }
      else setItems((resp.data?.items || []) as SpecItem[]);
    } catch (e) {
      console.error("Spec checklist build failed:", e);
      setItems((prev) => prev ?? []);
    } finally {
      setBuilding(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (!hasExamBoard || noSpec) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">No official specification to check against for this course.</p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Build a checklist from the real official specification — ticked off automatically as you complete subtopics.
        </p>
        <button
          onClick={build}
          disabled={building}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
          {building ? "Building…" : "Build specification checklist"}
        </button>
      </div>
    );
  }

  const total = items.length;
  const done = items.filter((i) => i.ticked).length;
  const byTopic = new Map<string, SpecItem[]>();
  for (const item of items) {
    const key = item.topic_id || "unassigned";
    byTopic.set(key, [...(byTopic.get(key) || []), item]);
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">Specification coverage</p>
          <p className="text-xs font-medium text-foreground">{done}/{total}</p>
        </div>
        <div className="w-full h-2 rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>

      {topics.map((topic) => {
        const topicItems = byTopic.get(topic.id);
        if (!topicItems || topicItems.length === 0) return null;
        return (
          <div key={topic.id} className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">{topic.title}</h3>
            <div className="space-y-3">
              {topicItems.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5">
                  {item.ticked
                    ? <CheckCircle2 className="h-4 w-4 text-status-green shrink-0 mt-0.5" />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${item.ticked ? "text-foreground" : "text-muted-foreground"}`}>
                      {item.code && <span className="text-xs font-mono text-muted-foreground mr-1.5">{item.code}</span>}
                      {item.text}
                    </p>
                    {item.rigor === "complex" && item.evidence_requirements.length > 0 && !item.ticked && (
                      <ul className="mt-1.5 space-y-0.5">
                        {item.evidence_requirements.map((req, i) => (
                          <li key={i} className="text-xs text-muted-foreground/80 flex items-start gap-1.5">
                            <span className="shrink-0">·</span><span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {items[0]?.source_url && (
        <a
          href={items[0].source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ExternalLink className="h-3 w-3" /> View official specification source
        </a>
      )}
    </div>
  );
}
