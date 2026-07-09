import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import MathRenderer from "@/components/MathRenderer";

type TopicWithSubs = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

/**
 * Notes page — one living document per subtopic.
 * Groups all note fragments for a subtopic into a single scrollable document.
 */
export default function TrackNotes() {
  const { trackId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [topics, setTopics] = useState<TopicWithSubs[]>([]);
  const [notes, setNotes] = useState<Tables<"notes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string | null>(null);

  useEffect(() => {
    if (!trackId || !user) return;
    loadData();
  }, [trackId, user]);

  const loadData = async () => {
    const { data: t } = await supabase.from("learning_tracks").select("*").eq("id", trackId!).single();
    setTrack(t);

    const { data: rawTopics } = await supabase.from("topics").select("*").eq("track_id", trackId!).order("order_index");
    if (!rawTopics) { setLoading(false); return; }

    const enriched: TopicWithSubs[] = [];
    const allSubIds: string[] = [];
    for (const topic of rawTopics) {
      const { data: subs } = await supabase.from("subtopics").select("*").eq("topic_id", topic.id).order("order_index");
      enriched.push({ ...topic, subtopics: subs || [] });
      subs?.forEach(s => allSubIds.push(s.id));
    }
    setTopics(enriched);

    if (allSubIds.length > 0) {
      const { data: n } = await supabase.from("notes").select("*").eq("user_id", user!.id).in("subtopic_id", allSubIds).order("created_at");
      setNotes(n || []);
    }

    // Auto-select first subtopic that has notes
    const firstWithNotes = allSubIds.find(id => (notes || []).some(n => n.subtopic_id === id));
    if (firstWithNotes) setSelectedSubtopicId(firstWithNotes);

    setLoading(false);
  };

  // Group notes by subtopic into "documents"
  const subtopicNotes = selectedSubtopicId
    ? notes.filter(n => n.subtopic_id === selectedSubtopicId)
    : [];

  const getSubtopicTitle = (subId: string) => {
    for (const t of topics) {
      const s = t.subtopics.find(s => s.id === subId);
      if (s) return s.title;
    }
    return "Unknown";
  };

  const subtopicsWithNotes = new Set(notes.map(n => n.subtopic_id));

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto md:min-h-screen">
        <div className="p-4 border-b border-border">
          <button onClick={() => navigate(`/track/${trackId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to track
          </button>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Notes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{track?.title}</p>
        </div>

        <div className="p-2">
          {topics.map(topic => {
            const hasSomeNotes = topic.subtopics.some(s => subtopicsWithNotes.has(s.id));
            if (!hasSomeNotes) return null;

            return (
              <div key={topic.id} className="mb-2">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{topic.title}</p>
                {topic.subtopics.map(sub => {
                  if (!subtopicsWithNotes.has(sub.id)) return null;
                  const count = notes.filter(n => n.subtopic_id === sub.id).length;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubtopicId(sub.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        selectedSubtopicId === sub.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {sub.title}
                      <span className="text-muted-foreground/50 ml-1">({count})</span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {subtopicsWithNotes.size === 0 && (
            <div className="p-6 text-center">
              <BookOpen className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No notes yet. Complete sessions to generate notes.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Document view */}
      <main className="flex-1 overflow-y-auto">
        {selectedSubtopicId && subtopicNotes.length > 0 ? (
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Document title */}
            <div className="mb-6">
              <h1 className="text-lg font-bold text-foreground">
                {getSubtopicTitle(selectedSubtopicId)}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {subtopicNotes.length} section{subtopicNotes.length !== 1 ? "s" : ""} · Last updated {new Date(subtopicNotes[subtopicNotes.length - 1].created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            </div>

            {/* Merged document */}
            <div className="space-y-6">
              {subtopicNotes.map((note, i) => (
                <section key={note.id}>
                  <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {note.title}
                  </h2>
                  <div className="pl-4 border-l border-border/50">
                    <MathRenderer content={note.content} />
                  </div>
                  {i < subtopicNotes.length - 1 && <div className="mt-6" />}
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {subtopicsWithNotes.size > 0 ? "Select a subtopic to view its notes" : "No notes yet"}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
