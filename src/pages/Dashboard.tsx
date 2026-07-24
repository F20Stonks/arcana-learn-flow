import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Flame, Trophy, Plus, BookOpen, Map as MapIcon, LogOut, Loader2, Target, Trash2, MessageCircle, ChevronUp, ChevronDown, Archive, ArchiveRestore, FileText } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import CustomizeMenu, { applyStoredAccent } from "@/components/CustomizeMenu";
import BrandLogo from "@/components/BrandLogo";
import HubSidebar from "@/components/HubSidebar";
import GeneralChat from "@/components/GeneralChat";
import NextActionCard from "@/components/NextActionCard";
import SafeBoundary from "@/components/SafeBoundary";
import { SubtopicLite, TrackLite } from "@/lib/nextAction";
import { SubjectIcon } from "@/lib/subjectIcons";
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

type Track = Tables<"learning_tracks"> & { topicCount: number; subtopicCount: number; completedCount: number; subtopicsDetail: SubtopicLite[]; archived_at?: string | null };

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Track | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadTracks();
  }, [user]);

  useEffect(() => { applyStoredAccent(); }, []);

  const loadTracks = async () => {
    if (!user) return;
    const userId = user.id;
    setLoading(true);
    setLoadError("");

    try {
      const { data: rawTracks, error } = await supabase
        .from("learning_tracks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched: Track[] = await Promise.all(
        (rawTracks || []).map(async (t) => {
          try {
            const { data: topics } = await supabase.from("topics").select("id, order_index").eq("track_id", t.id);
            const topicIds = topics?.map((tp) => tp.id) || [];
            const topicOrderById = new Map((topics || []).map((tp) => [tp.id, tp.order_index]));
            let subtopicCount = 0;
            let completedCount = 0;
            let subtopicsDetail: SubtopicLite[] = [];

            if (topicIds.length > 0) {
              const { data: subs } = await supabase.from("subtopics").select("id, title, status, order_index, topic_id").in("topic_id", topicIds);
              subtopicCount = subs?.length || 0;
              completedCount = subs?.filter((s) => s.status === "complete").length || 0;
              subtopicsDetail = (subs || []).map((s) => ({
                id: s.id,
                title: s.title,
                status: s.status,
                topicOrder: topicOrderById.get(s.topic_id) ?? 0,
                order: s.order_index,
              }));
            }

            return { ...t, topicCount: topicIds.length, subtopicCount, completedCount, subtopicsDetail };
          } catch (error) {
            console.warn("Track enrichment failed:", error);
            return { ...t, topicCount: 0, subtopicCount: 0, completedCount: 0, subtopicsDetail: [] };
          }
        }),
      );

      setTracks(enriched);
    } catch (error) {
      console.error("Dashboard track load failed:", error);
      setTracks([]);
      setLoadError("Jarvis couldn't load your tracks. You can retry or create a new one.");
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => (
    <header className="border-b border-border bg-background sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <BrandLogo className="text-lg" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm"><Flame className="h-4 w-4 text-streak" /><span className="font-semibold text-foreground">{profile?.weekly_streak || 0}</span></div>
          <div className="flex items-center gap-1.5 text-sm"><Trophy className="h-4 w-4 text-xp" /><span className="font-semibold text-foreground">{profile?.total_xp || 0}</span></div>
          <CustomizeMenu />
          <SafeBoundary label="Hub" compact>
            <HubSidebar />
          </SafeBoundary>
          <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground transition-colors"><Settings className="h-5 w-5" /></button>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors"><LogOut className="h-5 w-5" /></button>
        </div>
      </div>
    </header>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {renderHeader()}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <div>
                <h1 className="text-lg font-semibold text-foreground">Opening your workspace</h1>
                <p className="mt-1 text-sm text-muted-foreground">If one data source is slow, Jarvis will still show the dashboard.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const pct = (t: Track) => (t.subtopicCount > 0 ? Math.round((t.completedCount / t.subtopicCount) * 100) : 0);

  const activeTracks = tracks.filter((t) => !t.archived_at);
  const archivedTracks = tracks.filter((t) => t.archived_at);

  // Stable inputs for the "what to do next" card — memoized so its data
  // effect doesn't re-run on unrelated re-renders (chat toggle, dialogs...).
  const nextActionTracks = useMemo<TrackLite[]>(
    () =>
      tracks
        .filter((t) => !t.archived_at)
        .map((t) => ({
          id: t.id,
          title: t.title,
          examDate: t.exam_date,
          createdAt: t.created_at,
          subtopics: t.subtopicsDetail,
        })),
    [tracks],
  );

  // Soft archive/restore. Reversible, so no confirm dialog — just an optimistic update + an undo toast.
  const setArchived = async (track: Track, archived: boolean) => {
    const archived_at = archived ? new Date().toISOString() : null;
    const { error } = await supabase.from("learning_tracks").update({ archived_at } as never).eq("id", track.id);
    if (error) {
      toast.error(archived ? "Couldn't archive track" : "Couldn't restore track");
      return;
    }
    setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, archived_at } : t)));
    if (archived) {
      toast.success("Track archived", { action: { label: "Undo", onClick: () => setArchived(track, false) } });
    } else {
      toast.success("Track restored");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("learning_tracks").delete().eq("id", pendingDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("Couldn't delete track");
      return;
    }
    setTracks((prev) => prev.filter((t) => t.id !== pendingDelete.id));
    setPendingDelete(null);
    toast.success("Track deleted");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {renderHeader()}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {loadError && (
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-medium text-foreground">{loadError}</p>
            <button onClick={loadTracks} className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Retry loading tracks
            </button>
          </div>
        )}

        {/* What to do next — deterministic recommendation (renders nothing when there's nothing to say) */}
        <SafeBoundary label="Next action">
          <NextActionCard tracks={nextActionTracks} />
        </SafeBoundary>

        {/* Hero */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-1">Welcome back, {profile?.display_name || "learner"}</h2>
          <p className="text-sm text-muted-foreground mb-4">{activeTracks.length > 0 ? "Keep up the momentum." : "Create your first learning track to get started."}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {activeTracks.length > 0 && (
              <button
                onClick={() => navigate(`/track/${activeTracks[0].id}`)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Continue learning
              </button>
            )}
            <button
              onClick={() => setChatOpen((v) => !v)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-foreground text-sm font-medium hover:bg-accent/70 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Ask Jarvis
              <ChevronUp className={`h-3.5 w-3.5 transition-transform ${chatOpen ? "" : "rotate-180"}`} />
            </button>
          </div>

          {chatOpen && (
            <div className="mt-5 pt-5 border-t border-border">
              <SafeBoundary label="Jarvis chat">
                <GeneralChat />
              </SafeBoundary>
            </div>
          )}
        </div>

        {/* Tracks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Learning Tracks</h3>
            <button
              onClick={() => navigate("/onboarding?new=1")}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> New track
            </button>
          </div>

          {activeTracks.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm mb-4">
                {archivedTracks.length > 0 ? "No active tracks — restore one below, or let Jarvis build a new one." : "No tracks yet. Let Jarvis build one for you."}
              </p>
              <button onClick={() => navigate("/onboarding?new=1")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                Create a track
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTracks.map((t) => (
                <div key={t.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all cursor-pointer group" onClick={() => navigate(`/track/${t.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <SubjectIcon subject={t.subject} />
                    <span className="text-xs text-muted-foreground">{pct(t)}%</span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{t.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{t.topicCount} topics · {t.subtopicCount} subtopics</p>
                  <div className="w-full h-1.5 rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct(t)}%` }} />
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/track/${t.id}/notes`); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <BookOpen className="h-3 w-3" /> Notes
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/track/${t.id}/questions`); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Target className="h-3 w-3" /> Questions
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/track/${t.id}/papers`); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <FileText className="h-3 w-3" /> Papers
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setArchived(t, true); }}
                      className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title="Archive track"
                    >
                      <Archive className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(t); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete track"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Archived tracks — collapsed by default */}
        {archivedTracks.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              {showArchived ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5 rotate-180" />}
              Archived ({archivedTracks.length})
            </button>

            {showArchived && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {archivedTracks.map((t) => (
                  <div key={t.id} className="bg-card/60 border border-border rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <SubjectIcon subject={t.subject} className="opacity-70" />
                      <span className="text-xs text-muted-foreground">{pct(t)}%</span>
                    </div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t.title}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{t.topicCount} topics · {t.subtopicCount} subtopics</p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => setArchived(t, false)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline transition-colors"
                        title="Restore track"
                      >
                        <ArchiveRestore className="h-3 w-3" /> Restore
                      </button>
                      <button
                        onClick={() => setPendingDelete(t)}
                        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete track"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the track and everything in it — topics, subtopics, notes, and progress. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
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
