import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Loader2, BookOpen, Target, Map, Circle, Trash2, FileText } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import KnowledgeMap from "@/components/KnowledgeMap";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { SubjectIcon } from "@/lib/subjectIcons";

type Topic = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

const STATUS_COLORS: Record<string, string> = {
  complete: "bg-status-green",
  in_progress: "bg-status-yellow",
  review_due: "bg-status-red",
  unlocked: "bg-primary",
  locked: "bg-muted",
};

type View = "overview" | "map";

export default function TrackOverview() {
  const { trackId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("overview");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    if (enriched.length > 0) setExpanded(new Set([enriched[0].id]));
    setLoading(false);
  };

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleComplete = async (sub: Tables<"subtopics">) => {
    const nextStatus = sub.status === "complete" ? "unlocked" : "complete";
    // Optimistic update
    setTopics((prev) =>
      prev.map((t) => ({
        ...t,
        subtopics: t.subtopics.map((s) => (s.id === sub.id ? { ...s, status: nextStatus } : s)),
      }))
    );
    await supabase.from("subtopics").update({ status: nextStatus }).eq("id", sub.id);
  };

  const confirmDeleteTrack = async () => {
    if (!trackId) return;
    setDeleting(true);
    const { error } = await supabase.from("learning_tracks").delete().eq("id", trackId);
    setDeleting(false);
    if (error) {
      toast.error("Couldn't delete track");
      return;
    }
    toast.success("Track deleted");
    navigate("/dashboard");
  };

  const totalSubs = topics.reduce((a, t) => a + t.subtopics.length, 0);
  const completedSubs = topics.reduce((a, t) => a + t.subtopics.filter((s) => s.status === "complete").length, 0);
  const pct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto md:min-h-screen">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </button>
            <button onClick={() => setConfirmingDelete(true)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete track">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <h2 className="text-sm font-semibold text-foreground">{track?.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">{track?.subject} {track?.level && `· ${track.level}`}</p>
        </div>

        {/* Quick actions */}
        <div className="p-3 border-b border-border flex gap-2">
          <button onClick={() => navigate(`/track/${trackId}/notes`)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors">
            <BookOpen className="h-3.5 w-3.5" /> Notes
          </button>
          <button onClick={() => navigate(`/track/${trackId}/questions`)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Target className="h-3.5 w-3.5" /> Questions
          </button>
          <button onClick={() => navigate(`/track/${trackId}/papers`)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors">
            <FileText className="h-3.5 w-3.5" /> Papers
          </button>
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
                    <div key={sub.id} className="group flex items-center gap-1 pr-2 rounded-lg hover:bg-accent transition-colors">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleComplete(sub); }}
                        className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
                        title={sub.status === "complete" ? "Mark incomplete" : "Mark complete"}
                      >
                        {sub.status === "complete" ? (
                          <div className="h-4 w-4 rounded-full bg-status-green flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />
                          </div>
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => navigate(`/session/${sub.id}`)}
                        className="flex-1 text-left py-2 text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
                      >
                        {sub.title}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <SubjectIcon subject={track?.subject} size="lg" />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{track?.title}</h1>
              <p className="text-sm text-muted-foreground">{track?.subject} {track?.exam_board && `· ${track.exam_board}`}</p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-1 bg-accent rounded-lg p-1 mb-6 w-fit">
            <button
              onClick={() => setView("overview")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "overview" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Overview
            </button>
            <button
              onClick={() => setView("map")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${view === "map" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Map className="h-3 w-3" /> Knowledge Map
            </button>
          </div>

          {view === "overview" ? (
            <>
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
            </>
          ) : (
            <KnowledgeMap
              topics={topics}
              trackTitle={track?.title}
              onSubtopicClick={(id) => navigate(`/session/${id}`)}
            />
          )}
        </div>
      </main>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{track?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the track and everything in it — topics, subtopics, notes, and progress. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteTrack(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
