import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Lock, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Topic = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

const STATUS_COLORS: Record<string, string> = {
  complete: "bg-status-green",
  in_progress: "bg-status-yellow",
  review_due: "bg-status-red",
  unlocked: "bg-muted-foreground",
  locked: "bg-muted",
};

export default function TrackOverview() {
  const { trackId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackId || !user) return;
    loadTrack();
  }, [trackId, user]);

  const loadTrack = async () => {
    const { data: t } = await supabase.from("learning_tracks").select("*").eq("id", trackId!).single();
    setTrack(t);

    const { data: rawTopics } = await supabase.from("topics").select("*").eq("track_id", trackId!).order("order_index");
    if (!rawTopics) { setLoading(false); return; }

    const enriched: Topic[] = [];
    for (const topic of rawTopics) {
      const { data: subs } = await supabase.from("subtopics").select("*").eq("topic_id", topic.id).order("order_index");
      enriched.push({ ...topic, subtopics: subs || [] });
    }
    setTopics(enriched);
    // Auto-expand first topic
    if (enriched.length > 0) setExpanded(new Set([enriched[0].id]));
    setLoading(false);
  };

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const totalSubs = topics.reduce((a, t) => a + t.subtopics.length, 0);
  const completedSubs = topics.reduce((a, t) => a + t.subtopics.filter((s) => s.status === "complete").length, 0);
  const pct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto md:min-h-screen">
        <div className="p-4 border-b border-border">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <h2 className="text-sm font-semibold text-foreground">{track?.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">{track?.subject} {track?.level && `· ${track.level}`}</p>
        </div>

        <div className="p-2">
          {topics.map((topic) => (
            <div key={topic.id}>
              <button
                onClick={() => toggle(topic.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
              >
                {expanded.has(topic.id) ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[topic.status]}`} />
                <span className="text-sm text-foreground truncate">{topic.title}</span>
              </button>

              {expanded.has(topic.id) && (
                <div className="ml-6 pl-3 border-l border-border space-y-0.5 mb-1">
                  {topic.subtopics.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => sub.status !== "locked" && navigate(`/session/${sub.id}`)}
                      disabled={sub.status === "locked"}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sub.status === "locked" ? (
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[sub.status]}`} />
                      )}
                      <span className="text-xs text-muted-foreground">{sub.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 sm:p-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{track?.emoji}</span>
            <div>
              <h1 className="text-xl font-bold text-foreground">{track?.title}</h1>
              <p className="text-sm text-muted-foreground">{track?.subject} {track?.exam_board && `· ${track.exam_board}`}</p>
            </div>
          </div>

          {track?.exam_date && (
            <div className="bg-card border border-border rounded-xl p-4 mb-6">
              <p className="text-xs text-muted-foreground mb-1">Exam date</p>
              <p className="text-sm font-medium text-foreground">{new Date(track.exam_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="text-xs font-medium text-foreground">{pct}%</p>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{completedSubs} of {totalSubs} subtopics complete</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Topics</h3>
            <div className="space-y-2">
              {topics.map((t) => {
                const tc = t.subtopics.filter(s => s.status === "complete").length;
                const tp = t.subtopics.length > 0 ? Math.round((tc / t.subtopics.length) * 100) : 0;
                return (
                  <div key={t.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[t.status]}`} />
                      <span className="text-sm text-foreground">{t.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{tp}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
