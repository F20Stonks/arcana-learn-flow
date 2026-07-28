import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, Loader2, BookOpen, Target, Map, Circle, Trash2, FileText, ClipboardList, MoreHorizontal } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import KnowledgeMap from "@/components/KnowledgeMap";
import SpecChecklist from "@/components/SpecChecklist";
import SafeBoundary from "@/components/SafeBoundary";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { SubjectIcon } from "@/lib/subjectIcons";

type Topic = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

type View = "overview" | "map" | "spec";

/**
 * Replaces the old chevron + static status-dot pair with one signal: a ring showing REAL
 * completion (topics.status is set once at track creation and never updated again — see
 * OnboardingPage.tsx — so it was always the same color regardless of actual progress). Filled
 * solid green once every subtopic is done, otherwise an arc proportional to completed/total,
 * colored to flag whether a subtopic in this topic is actively in progress.
 */
function TopicProgressRing({ pct, active }: { pct: number; active: boolean }) {
  const size = 18;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  if (pct >= 1) {
    return (
      <div className="h-[18px] w-[18px] shrink-0 rounded-full bg-status-green flex items-center justify-center">
        <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />
      </div>
    );
  }
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-secondary" />
      {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          className={active ? "stroke-status-yellow" : "stroke-primary"}
        />
      )}
    </svg>
  );
}

export default function TrackOverview() {
  const { trackId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!trackId || !user) return;
    loadTrack();
  }, [trackId, user]);

  const loadTrack = async () => {
    if (!trackId) return;
    setLoading(true);
    setLoadError("");
    try {
      const { data: t, error: trackError } = await supabase.from("learning_tracks").select("*").eq("id", trackId).single();
      if (trackError) throw trackError;
      setTrack(t);

      const { data: rawTopics, error: topicsError } = await supabase.from("topics").select("*").eq("track_id", trackId).order("order_index");
      if (topicsError) throw topicsError;

      const enriched: Topic[] = await Promise.all(
        (rawTopics || []).map(async (topic) => {
          const { data: subs } = await supabase.from("subtopics").select("*").eq("topic_id", topic.id).order("order_index");
          return { ...topic, subtopics: subs || [] };
        }),
      );
      setTopics(enriched);
      if (enriched.length > 0) {
        // Resume where the student actually left off, not always the first topic — a subtopic
        // stuck mid-session (see SessionPage.tsx's status write) is a much stronger signal of
        // "where to look" than track order.
        const resumeTopic = enriched.find((t) => t.subtopics.some((s) => s.status === "in_progress"));
        setExpanded(new Set([(resumeTopic ?? enriched[0]).id]));
      }
    } catch (error) {
      console.error("Track load failed:", error);
      setLoadError("This track couldn't load. Go back to the dashboard or retry.");
    } finally {
      setLoading(false);
    }
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

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Opening track…</p>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6">
        <h1 className="text-lg font-semibold text-foreground">Track unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => navigate("/dashboard")} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80">Dashboard</button>
          <button onClick={loadTrack} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Retry</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto md:min-h-screen">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-1 transition-colors" title="Track options" aria-label="Track options">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    // Opening the AlertDialog in the SAME tick as the dropdown's own close/focus-
                    // return fights over Radix's focus-scope/body-lock, leaving the dropdown's
                    // overlay stuck intercepting clicks underneath the new dialog. Deferring a tick
                    // lets the dropdown fully unmount first — the standard fix for this combination.
                    e.preventDefault();
                    setTimeout(() => setConfirmingDelete(true), 0);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete track
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <h2 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug" title={track?.title}>{track?.title}</h2>
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
          {topics.map((topic) => {
            const total = topic.subtopics.length;
            const done = topic.subtopics.filter((s) => s.status === "complete").length;
            const active = topic.subtopics.some((s) => s.status === "in_progress");
            const pct = total > 0 ? done / total : 0;
            return (
            <div key={topic.id}>
              <button
                onClick={() => toggle(topic.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <TopicProgressRing pct={pct} active={active} />
                <span className="text-sm text-foreground line-clamp-2 leading-snug" title={topic.title}>{topic.title}</span>
              </button>

              {expanded.has(topic.id) && (
                <div className="ml-6 pl-3 border-l border-border space-y-0.5 mb-1">
                  {topic.subtopics.map((sub) => {
                    const isResuming = sub.status === "in_progress";
                    return (
                    <div
                      key={sub.id}
                      className={`group flex items-center gap-1 pr-2 rounded-lg border-l-2 transition-colors ${isResuming ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"}`}
                    >
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
                        className="flex-1 text-left py-2 text-xs text-muted-foreground hover:text-foreground transition-colors line-clamp-2 leading-snug"
                        title={sub.title}
                      >
                        {sub.title}
                      </button>
                      {isResuming && (
                        <span className="shrink-0 text-[10px] font-medium text-primary px-1.5 py-0.5 rounded bg-primary/10">
                          Resume
                        </span>
                      )}
                    </div>
                  );})}
                </div>
              )}
            </div>
          );})}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
        <div className={view === "map" ? "max-w-none" : "max-w-3xl"}>
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
            <button
              onClick={() => setView("spec")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${view === "spec" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ClipboardList className="h-3 w-3" /> Specification
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
            </>
          ) : view === "map" ? (
            <SafeBoundary label="Knowledge map">
              <KnowledgeMap
                topics={topics}
                trackTitle={track?.title}
                onSubtopicClick={(id) => navigate(`/session/${id}`)}
                onVerifyClick={(id) => navigate(`/track/${trackId}/questions?subtopic=${id}&mode=verify`)}
              />
            </SafeBoundary>
          ) : (
            trackId ? (
              <SafeBoundary label="Specification checklist">
                <SpecChecklist trackId={trackId} topics={topics} hasExamBoard={!!track?.exam_board} />
              </SafeBoundary>
            ) : null
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
