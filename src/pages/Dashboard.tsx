import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Flame, Trophy, Plus, BookOpen, Map, LogOut, Loader2, Target } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Track = Tables<"learning_tracks"> & { topicCount: number; subtopicCount: number; completedCount: number };

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadTracks();
  }, [user]);

  const loadTracks = async () => {
    const { data: rawTracks } = await supabase
      .from("learning_tracks")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (!rawTracks) { setLoading(false); return; }

    const enriched: Track[] = [];
    for (const t of rawTracks) {
      const { data: topics } = await supabase.from("topics").select("id").eq("track_id", t.id);
      const topicIds = topics?.map((tp) => tp.id) || [];
      let subtopicCount = 0;
      let completedCount = 0;
      if (topicIds.length > 0) {
        const { data: subs } = await supabase.from("subtopics").select("id, status").in("topic_id", topicIds);
        subtopicCount = subs?.length || 0;
        completedCount = subs?.filter((s) => s.status === "complete").length || 0;
      }
      enriched.push({ ...t, topicCount: topicIds.length, subtopicCount, completedCount });
    }
    setTracks(enriched);
    setLoading(false);
  };

  const pct = (t: Track) => (t.subtopicCount > 0 ? Math.round((t.completedCount / t.subtopicCount) * 100) : 0);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Jarvis</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm"><Flame className="h-4 w-4 text-streak" /><span className="font-semibold text-foreground">{profile?.weekly_streak || 0}</span></div>
            <div className="flex items-center gap-1.5 text-sm"><Trophy className="h-4 w-4 text-xp" /><span className="font-semibold text-foreground">{profile?.total_xp || 0}</span></div>
            <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground transition-colors"><Settings className="h-5 w-5" /></button>
            <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-1">Welcome back, {profile?.display_name || "learner"}</h2>
          <p className="text-sm text-muted-foreground mb-4">{tracks.length > 0 ? "Keep up the momentum." : "Create your first learning track to get started."}</p>
          {tracks.length > 0 && (
            <button
              onClick={() => navigate(`/track/${tracks[0].id}`)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Continue learning
            </button>
          )}
        </div>

        {/* Tracks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Learning Tracks</h3>
            <button
              onClick={() => navigate("/onboarding")}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> New track
            </button>
          </div>

          {tracks.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm mb-4">No tracks yet. Let Jarvis build one for you.</p>
              <button onClick={() => navigate("/onboarding")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                Create a track
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tracks.map((t) => (
                <div key={t.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all cursor-pointer group" onClick={() => navigate(`/track/${t.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{t.emoji}</span>
                    <span className="text-xs text-muted-foreground">{pct(t)}%</span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{t.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{t.topicCount} topics · {t.subtopicCount} subtopics</p>
                  <div className="w-full h-1.5 rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct(t)}%` }} />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/track/${t.id}/notes`); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <BookOpen className="h-3 w-3" /> Notes
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/track/${t.id}/questions`); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Target className="h-3 w-3" /> Questions
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
