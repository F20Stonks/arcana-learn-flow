import { useNavigate } from "react-router-dom";
import { BookOpen, StickyNote, GitBranch } from "lucide-react";
import { learningTracks } from "@/data/learningTracks";
import { StatusDot } from "@/components/StatusDot";
import { JarvisChat } from "@/components/JarvisChat";

function getTrackProgress(track: (typeof learningTracks)[0]) {
  const all = track.topics.flatMap((t) => t.subtopics);
  const done = all.filter((s) => s.status === "completed").length;
  return { done, total: all.length };
}

function overallStatus(track: (typeof learningTracks)[0]) {
  const { done, total } = getTrackProgress(track);
  if (done === total) return "completed" as const;
  if (done > 0) return "in-progress" as const;
  return "not-started" as const;
}

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-8 py-6">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">Jarvis</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-1">Your Learning Tracks</h1>
        <p className="text-sm text-muted-foreground mb-8">Pick up where you left off or start something new.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {learningTracks.map((track) => {
            const { done, total } = getTrackProgress(track);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div
                key={track.id}
                className="group border border-border rounded-xl bg-card overflow-hidden hover:border-primary/40 transition-all"
              >
                {/* Clickable card body */}
                <button
                  onClick={() => navigate(`/track/${track.id}`)}
                  className="w-full text-left p-6 pb-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{track.emoji}</span>
                    <StatusDot status={overallStatus(track)} />
                  </div>
                  <h2 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {track.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    {track.topics.length} topics · {total} subtopics
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">{pct}% complete</p>
                </button>

                {/* Action buttons */}
                <div className="px-6 pb-4 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/track/${track.id}/notes`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-secondary hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <StickyNote className="h-3 w-3" />
                    Notes
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/track/${track.id}/tracker`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-secondary hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <GitBranch className="h-3 w-3" />
                    Tracker
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <JarvisChat />
    </div>
  );
};

export default Home;
