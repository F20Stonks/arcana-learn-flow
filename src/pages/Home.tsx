import { useNavigate } from "react-router-dom";
import { StickyNote, GitBranch, Settings, Flame, Zap, Trophy, ChevronRight } from "lucide-react";
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

// Mock streak/XP data
const streakDays = 7;
const totalXP = 2450;
const dailyGoalPct = 65;

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 arc-border flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display text-lg font-bold tracking-wider text-gradient-jarvis">JARVIS</span>
          </div>

          <div className="flex items-center gap-5">
            {/* Streak */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary arc-border">
              <Flame className="h-4 w-4 text-streak" />
              <span className="text-sm font-semibold text-foreground">{streakDays}</span>
              <span className="text-xs text-muted-foreground">day streak</span>
            </div>

            {/* XP */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary arc-border">
              <Trophy className="h-4 w-4 text-xp" />
              <span className="text-sm font-semibold text-foreground">{totalXP.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">XP</span>
            </div>

            {/* Settings */}
            <button
              onClick={() => navigate("/settings")}
              className="h-9 w-9 rounded-lg bg-secondary arc-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* Avatar */}
            <div className="h-9 w-9 rounded-full bg-primary/20 arc-border flex items-center justify-center text-sm font-bold text-primary">
              A
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-10">
        {/* Hero / Daily Progress */}
        <div className="mb-10 p-6 rounded-2xl bg-card arc-glow arc-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back, Alex</h1>
              <p className="text-sm text-muted-foreground">You're on a <span className="text-streak font-semibold">{streakDays}-day streak</span>. Keep it going!</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Daily Goal</p>
              <p className="text-2xl font-bold text-foreground">{dailyGoalPct}%</p>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(260,80%,60%)] transition-all"
              style={{ width: `${dailyGoalPct}%` }}
            />
          </div>
        </div>

        {/* Section Title */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Your Learning Tracks</h2>
          <span className="text-xs text-muted-foreground">{learningTracks.length} tracks</span>
        </div>

        {/* Track Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {learningTracks.map((track) => {
            const { done, total } = getTrackProgress(track);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div
                key={track.id}
                className="group rounded-2xl bg-card arc-border overflow-hidden hover:arc-glow transition-all duration-300"
              >
                {/* Card body */}
                <button
                  onClick={() => navigate(`/track/${track.id}`)}
                  className="w-full text-left p-6 pb-4"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 arc-border flex items-center justify-center text-2xl">
                      {track.emoji}
                    </div>
                    <StatusDot status={overallStatus(track)} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {track.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {track.topics.length} topics · {total} subtopics
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(260,80%,60%)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] text-muted-foreground">{pct}% complete</p>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>

                {/* Action row */}
                <div className="px-6 pb-5 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/track/${track.id}/notes`);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-muted-foreground bg-secondary hover:bg-accent hover:text-accent-foreground transition-colors arc-border"
                  >
                    <StickyNote className="h-3 w-3" />
                    Notes
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/track/${track.id}/tracker`);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-muted-foreground bg-secondary hover:bg-accent hover:text-accent-foreground transition-colors arc-border"
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
