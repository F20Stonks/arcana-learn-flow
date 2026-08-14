import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
// `Map as MapIcon`: importing lucide's `Map` under its own name shadows the global Map constructor
// for this whole module, so `new Map(...)` below throws "Only a void function can be called with
// the 'new' keyword". Dashboard.tsx hit exactly this before — alias it and the footgun is gone.
import { ArrowLeft, Check, Loader2, BookOpen, Target, Map as MapIcon, Circle, Trash2, FileText, ClipboardList, MoreHorizontal, Plus, ArchiveRestore, Archive, Zap, RotateCcw } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import KnowledgeMap from "@/components/KnowledgeMap";
import SpecChecklist from "@/components/SpecChecklist";
import SafeBoundary from "@/components/SafeBoundary";
import { addOptionToTrack, archiveOption, restoreOption } from "@/lib/syllabusTrack";
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

// archived_at / option_group aren't in the generated Tables<"topics"> type yet — new columns from
// 20260809130100_topic_archive_and_options.sql, same "written but not yet Lovable-run" situation
// TrackPapers.tsx already documents for other tables. Extended by hand until types are regenerated.
type Topic = Tables<"topics"> & {
  subtopics: Tables<"subtopics">[];
  archived_at: string | null;
  option_group: string | null;
};

type OptionState = "not_added" | "active" | "archived";

/** Two surfaces. The knowledge map used to be one of them, rendered inline beside a sidebar that
 *  already listed the same topics and subtopics — the same tree twice, in two visual languages.
 *  The sidebar won (it's always visible and reads well in a column); the map moved to a fullscreen
 *  overlay, which is the only width its horizontal layout was ever legible at. */
type View = "overview" | "spec";

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

/** What the single highlighted "do this next" row is. */
type NextKind = "resume" | "review" | "new";

const NEXT_LABEL: Record<NextKind, string> = { resume: "Resume", review: "Review", new: "Next" };

/**
 * The shiny frontier orb, ported from KnowledgeMap's SubtopicNode so the sidebar and the map speak
 * the same visual language. Recoloured from that component's hardcoded amber to the theme's own
 * accent, shifted toward violet — hardcoding a blue would break the Paper and Neon themes, and the
 * rest of this codebase deliberately builds colour by color-mix against the live tokens.
 *
 * Clicking the orb starts the session (same semantics as the map's orb), so it is NOT the
 * completion toggle — that stays a separate control on the row.
 */
function NextOrb({ kind, onClick, title }: { kind: NextKind; onClick: () => void; title: string }) {
  const Icon = kind === "review" ? RotateCcw : Zap;
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="relative shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
      style={{
        background:
          "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 35%, hsl(265 85% 62%)))",
        border: "1.5px solid color-mix(in oklab, var(--primary) 65%, white 35%)",
        boxShadow:
          "0 0 18px -2px color-mix(in oklab, var(--primary) 75%, transparent), 0 0 6px -1px color-mix(in oklab, hsl(265 85% 62%) 60%, transparent)",
      }}
    >
      <Icon className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
    </button>
  );
}

/**
 * Completed-subtopic marker. Same orb language as NextOrb (gradient + rim + glow) so the tree reads
 * as one family, just settled green instead of live violet — and deliberately the SAME 16px it was
 * as a flat disc, so turning it into an orb doesn't make "done" shout louder than "do this next".
 */
function CompleteOrb() {
  return (
    <span
      className="flex h-4 w-4 items-center justify-center rounded-full"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--status-green) 90%, white 10%), color-mix(in oklab, var(--status-green) 70%, black 30%))",
        border: "1px solid color-mix(in oklab, var(--status-green) 60%, white 40%)",
        boxShadow: "0 0 8px -1px color-mix(in oklab, var(--status-green) 65%, transparent)",
      }}
    >
      <Check className="h-2.5 w-2.5 text-background" strokeWidth={3.5} />
    </span>
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
  const [mapOpen, setMapOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [availableOptions, setAvailableOptions] = useState<string[]>([]);
  const [optionBusy, setOptionBusy] = useState<string | null>(null);
  /** subtopic_id -> due date, for reviews of THIS track that are due now. */
  const [dueReviews, setDueReviews] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!trackId || !user) return;
    loadTrack();
  }, [trackId, user]);

  const loadTrack = async () => {
    if (!trackId) return;
    setLoading(true);
    setLoadError("");
    try {
      const { data: t, error: trackError } = await (supabase.from("learning_tracks" as never) as any).select("*").eq("id", trackId).single();
      if (trackError) throw trackError;
      setTrack(t);
      setAvailableOptions(Array.isArray(t?.available_options) ? t.available_options : []);

      // Fetch ALL topics (active and archived) in one query — the main list below filters to active
      // only, but the options section needs to see archived rows too, to know what's addable vs.
      // restorable vs. already active.
      const { data: rawTopics, error: topicsError } = await (supabase.from("topics" as never) as any)
        .select("*").eq("track_id", trackId).order("order_index");
      if (topicsError) throw topicsError;

      const enriched: Topic[] = await Promise.all(
        (rawTopics || []).map(async (topic: Topic) => {
          const { data: subs } = await supabase.from("subtopics").select("*").eq("topic_id", topic.id).order("order_index");
          return { ...topic, subtopics: subs || [] };
        }),
      );
      setTopics(enriched);
      const active = enriched.filter((t) => !t.archived_at);

      // Reviews that have come due for this track's material. A subtopic you finished three weeks
      // ago and are about to forget is a real piece of work waiting for you, so it belongs in the
      // same "what's next" queue as unstarted material rather than only in a calendar you have to
      // remember to open.
      const subIds = active.flatMap((t) => t.subtopics.map((s) => s.id));
      if (subIds.length > 0 && user) {
        const { data: reviews } = await supabase
          .from("subtopic_reviews")
          .select("subtopic_id, next_review_due_at")
          .eq("user_id", user.id)
          .in("subtopic_id", subIds)
          .lte("next_review_due_at", new Date().toISOString());
        setDueReviews(new Map((reviews || []).map((r) => [r.subtopic_id, r.next_review_due_at])));
      }
      if (active.length > 0) {
        // Resume where the student actually left off, not always the first topic — a subtopic
        // stuck mid-session (see SessionPage.tsx's status write) is a much stronger signal of
        // "where to look" than track order.
        const resumeTopic = active.find((t) => t.subtopics.some((s) => s.status === "in_progress"));
        setExpanded(new Set([(resumeTopic ?? active[0]).id]));
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

  // Archived topics are hidden from the working track — the sidebar list, progress, and everything
  // below reads from this, not the raw fetch, so an archived option's material simply stops appearing
  // rather than needing to be filtered out at every use site individually.
  const activeTopics = topics.filter((t) => !t.archived_at);

  const totalSubs = activeTopics.reduce((a, t) => a + t.subtopics.length, 0);
  const completedSubs = activeTopics.reduce((a, t) => a + t.subtopics.filter((s) => s.status === "complete").length, 0);
  const pct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

  /**
   * The single "what do I do next" answer, shared by the sidebar's highlighted row and the Up-next
   * card. A half-finished session always wins over an unstarted one — resuming is cheaper than
   * starting, and leaving it unflagged is how sessions get abandoned. Otherwise it's the first
   * incomplete subtopic in track order, which is the map's "frontier" concept.
   */
  const nextUp = (() => {
    // 1. A half-finished session. Cheapest win on the board and its context is still warm.
    for (const t of activeTopics) {
      const resuming = t.subtopics.find((s) => s.status === "in_progress");
      if (resuming) return { topic: t, sub: resuming, kind: "resume" as NextKind };
    }
    // 2. The most overdue review. Time-sensitive in a way new material isn't — the whole point of
    //    spaced repetition is that late is worse than early.
    let oldest: { topic: Topic; sub: Tables<"subtopics">; due: string } | null = null;
    for (const t of activeTopics) {
      for (const s of t.subtopics) {
        const due = dueReviews.get(s.id);
        if (due && (!oldest || due < oldest.due)) oldest = { topic: t, sub: s, due };
      }
    }
    if (oldest) return { topic: oldest.topic, sub: oldest.sub, kind: "review" as NextKind };
    // 3. New ground, in track order.
    for (const t of activeTopics) {
      const next = t.subtopics.find((s) => s.status !== "complete");
      if (next) return { topic: t, sub: next, kind: "new" as NextKind };
    }
    return null;
  })();

  /** Where a row sends you — reviews re-enter the same subtopic in review mode. */
  const sessionHref = (subId: string, kind: NextKind) =>
    kind === "review" ? `/session/${subId}?mode=review` : `/session/${subId}`;

  /** Not-added / active / archived, per elective option this track's syllabus has. */
  const optionState = (option: string): OptionState => {
    const rows = topics.filter((t) => t.option_group === option);
    if (rows.length === 0) return "not_added";
    return rows.some((t) => !t.archived_at) ? "active" : "archived";
  };

  const handleAddOption = async (option: string) => {
    if (!track || optionBusy) return;
    setOptionBusy(option);
    const result = await addOptionToTrack(
      { id: track.id, subject: track.subject, level: track.level, exam_board: track.exam_board },
      option,
    );
    setOptionBusy(null);
    if (!result.ok) {
      toast.error(result.error || "Couldn't add that option");
      return;
    }
    toast.success(`${option} added`);
    await loadTrack();
  };

  const handleArchiveOption = async (option: string) => {
    if (!trackId || optionBusy) return;
    setOptionBusy(option);
    const result = await archiveOption(trackId, option);
    setOptionBusy(null);
    if (!result.ok) {
      toast.error("Couldn't archive that option");
      return;
    }
    toast.success(`${option} archived — add it back anytime`);
    await loadTrack();
  };

  const handleRestoreOption = async (option: string) => {
    if (!trackId || optionBusy) return;
    setOptionBusy(option);
    const result = await restoreOption(trackId, option);
    setOptionBusy(null);
    if (!result.ok) {
      toast.error("Couldn't restore that option");
      return;
    }
    toast.success(`${option} restored`);
    await loadTrack();
  };

  if (loading) return (
    <AppShell>
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Opening track…</p>
      </div>
    </div>
    </AppShell>
  );

  if (loadError) return (
    <AppShell>
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6">
        <h1 className="text-lg font-semibold text-foreground">Track unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => navigate("/dashboard")} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80">Dashboard</button>
          <button onClick={loadTrack} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Retry</button>
        </div>
      </div>
    </div>
    </AppShell>
  );

  return (
    <AppShell>
    {/* Track identity spans the full width and sits ABOVE both columns — the title heads everything
        that belongs to this track, rather than sitting alongside the tree as a sibling. */}
    <header className="border-b border-border px-6 py-5 sm:px-8">
      <div className="flex items-center gap-3">
        <SubjectIcon subject={track?.subject} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">{track?.title}</h1>
          <p className="text-sm text-muted-foreground">{track?.subject} {track?.exam_board && `· ${track.exam_board}`}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-1.5 transition-colors" title="Track options" aria-label="Track options">
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
    </header>

    <div className="flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto md:sticky md:top-14 md:h-[calc(100vh-3.5rem)]">
        {/* No track title/subject block here: the page header above states both. The sidebar is
            purely the navigator now — it opens straight onto the topic list, and the track-level
            actions (Notes/Questions/Papers, delete) live in the main column and header. */}
        <div className="p-2 pt-3">
          {activeTopics.map((topic) => {
            const total = topic.subtopics.length;
            const done = topic.subtopics.filter((s) => s.status === "complete").length;
            const active = topic.subtopics.some((s) => s.status === "in_progress");
            const pct = total > 0 ? done / total : 0;
            // Each topic is a contained card rather than a floating row, so the tree reads as a
            // stack of discrete units and an expanded topic visibly owns its subtopics.
            return (
            <div
              key={topic.id}
              className={`mb-2 overflow-hidden rounded-xl border transition-colors ${
                expanded.has(topic.id) ? "border-border bg-background/40" : "border-border/60 bg-background/20"
              }`}
            >
              <button
                onClick={() => toggle(topic.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent/60 transition-colors text-left"
              >
                <TopicProgressRing pct={pct} active={active} />
                <span
                  className={`min-w-0 flex-1 text-sm line-clamp-2 leading-snug ${
                    pct >= 1 ? "text-muted-foreground" : "text-foreground"
                  }`}
                  title={topic.title}
                >
                  {topic.title}
                </span>
                {/* done/total, borrowed from the map's topic header — the ring shows proportion, this
                    shows the actual counts, which is what you need to judge "can I finish this today". */}
                <span className="readout shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {done}/{total}
                </span>
              </button>

              {expanded.has(topic.id) && (
                <div className="ml-6 pl-3 border-l border-border space-y-0.5 pb-2">
                  {topic.subtopics.map((sub) => {
                    const isComplete = sub.status === "complete";
                    // Exactly one row in the whole track is "the next thing", and it wears the map's
                    // frontier orb. Everything else stays quiet — that's what makes it findable.
                    const isNextUp = nextUp?.sub.id === sub.id;
                    const kind = isNextUp ? nextUp!.kind : null;
                    const reviewDue = dueReviews.has(sub.id);
                    return (
                    <div
                      key={sub.id}
                      className={`group flex items-center gap-1.5 pr-2 rounded-lg border-l-2 transition-colors ${
                        isNextUp ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"
                      }`}
                    >
                      {isNextUp ? (
                        <div className="relative shrink-0 py-1.5 pl-0.5">
                          <NextOrb
                            kind={kind!}
                            title={`${NEXT_LABEL[kind!]} — ${sub.title}`}
                            onClick={() => navigate(sessionHref(sub.id, kind!))}
                          />
                          <span
                            className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded-sm px-1 py-px text-[7px] font-bold uppercase tracking-wider text-primary-foreground shadow"
                            style={{ background: "color-mix(in oklab, var(--primary) 55%, hsl(265 85% 62%))" }}
                          >
                            {NEXT_LABEL[kind!]}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleComplete(sub); }}
                          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
                          title={isComplete ? "Mark incomplete" : "Mark complete"}
                        >
                          {isComplete ? <CompleteOrb /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      )}
                      <button
                        onClick={() => navigate(sessionHref(sub.id, kind ?? "new"))}
                        className={`min-w-0 flex-1 text-left py-2 text-xs transition-colors hover:text-foreground ${
                          isNextUp ? "font-medium text-foreground" : "text-muted-foreground"
                        }`}
                        title={sub.title}
                      >
                        {/* The clamp MUST live on a padding-free inner element. `line-clamp-2` clips at
                            the padding box, so putting it on the padded button itself let a sliver of
                            line 3 bleed through the bottom padding and collide with the next row. */}
                        <span className="line-clamp-2 leading-snug">{sub.title}</span>
                      </button>
                      {/* Other due reviews stay visible in place, so you can see WHERE the decay is
                          in the tree rather than only as a count somewhere else. */}
                      {reviewDue && !isNextUp && (
                        <button
                          onClick={() => navigate(sessionHref(sub.id, "review"))}
                          className="shrink-0 flex items-center gap-1 rounded bg-status-yellow/15 px-1.5 py-0.5 text-[10px] font-medium text-status-yellow transition-colors hover:bg-status-yellow/25"
                          title="Review due"
                        >
                          <RotateCcw className="h-2.5 w-2.5" /> Due
                        </button>
                      )}
                      {/* The next-up row keeps its completion toggle — the orb starts the session,
                          so the tick has to live somewhere. */}
                      {isNextUp && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleComplete(sub); }}
                          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                          title={isComplete ? "Mark incomplete" : "Mark complete"}
                        >
                          {isComplete ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                        </button>
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
        <div className="max-w-3xl">
          {/* View toggle */}
          <div className="mb-6 flex items-center gap-3">
          <div className="flex gap-1 bg-accent rounded-lg p-1 w-fit">
            <button
              onClick={() => setView("overview")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${view === "overview" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ClipboardList className="h-3 w-3" /> Overview
            </button>
            <button
              onClick={() => setView("spec")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${view === "spec" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ClipboardList className="h-3 w-3" /> Specification
            </button>
          </div>
            {/* The map is a "shape of the whole course" view, not a navigator — the sidebar is the
                navigator. Opening it full-bleed keeps the two from competing on one screen. */}
            <button
              onClick={() => setMapOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <MapIcon className="h-3 w-3" /> Full map
            </button>
          </div>

          {view === "overview" ? (
            <>
              {/* The track's headline numbers, relocated here from the retired Overview tab. This is
                  now the ONLY progress meter on the page — the map's own HUD bar was removed so the
                  same fact isn't stated twice, two inches apart, in two different visual languages. */}
              <div className="bg-card border border-border rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <p className="text-xs text-muted-foreground">Progress</p>
                  <div className="flex items-center gap-4">
                    {track?.exam_date && (
                      <p className="text-xs text-muted-foreground">
                        Exam{" "}
                        <span className="font-medium text-foreground">
                          {new Date(track.exam_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      </p>
                    )}
                    <p className="text-xs font-medium text-foreground tabular-nums">{pct}%</p>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{completedSubs} of {totalSubs} subtopics complete</p>
              </div>

              {nextUp ? (
                <button
                  onClick={() => navigate(sessionHref(nextUp.sub.id, nextUp.kind))}
                  className="glass-card glass-card-hover mb-4 flex w-full items-center gap-4 rounded-xl p-4 text-left"
                >
                  {/* No orb here on purpose. The sidebar's orb is the one marker for "this is the
                      next thing"; repeating it two inches away halved its meaning. This card
                      carries the same action through its label and button instead. */}
                  <div className="min-w-0 flex-1">
                    <p className="micro-label mb-1.5">
                      {nextUp.kind === "resume" ? "Resume" : nextUp.kind === "review" ? "Review due" : "Next up"}
                    </p>
                    <p className="truncate text-[15px] font-semibold text-foreground">{nextUp.sub.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {nextUp.topic.title}
                      {nextUp.kind === "review" && " · you finished this a while ago"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground">
                    {nextUp.kind === "resume" ? "Resume" : nextUp.kind === "review" ? "Review" : "Start"}
                  </span>
                </button>
              ) : (
                <div className="glass-card mb-4 rounded-xl p-4">
                  <p className="text-sm text-foreground">Every subtopic in this track is complete.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reviews will keep it from fading — check the Reviews calendar in the sidebar.
                  </p>
                </div>
              )}

              {/* The track's three companion surfaces. These were three cramped icon buttons in the
                  sidebar; here they get room to say what they're actually for. */}
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: "Notes", icon: BookOpen, to: `/track/${trackId}/notes`, blurb: "What you've written down, per subtopic" },
                  { label: "Questions", icon: Target, to: `/track/${trackId}/questions`, blurb: "Drill this track under exam pressure" },
                  { label: "Papers", icon: FileText, to: `/track/${trackId}/papers`, blurb: "Past papers and generated mocks" },
                ].map((a) => (
                  <button
                    key={a.label}
                    onClick={() => navigate(a.to)}
                    className="glass-card glass-card-hover group flex flex-col items-start gap-1.5 rounded-xl p-4 text-left"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/60 text-muted-foreground transition-colors group-hover:text-primary">
                      <a.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[14px] font-semibold text-foreground">{a.label}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{a.blurb}</span>
                  </button>
                ))}
              </div>

              {/* Elective options — only rendered when this syllabus actually has any. No option here
                  is "official"; all are equally addable/archivable at any time, per the product
                  direction that this app isn't the exam board and doesn't gate on assigned modules. */}
              {availableOptions.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 mt-4 max-w-3xl">
                  <p className="text-xs text-muted-foreground mb-3">Options</p>
                  <div className="space-y-2">
                    {availableOptions.map((option) => {
                      const state = optionState(option);
                      const busy = optionBusy === option;
                      return (
                        <div key={option} className="flex items-center justify-between gap-3 py-1">
                          <span className="text-sm text-foreground">{option}</span>
                          {state === "not_added" && (
                            <button
                              onClick={() => handleAddOption(option)}
                              disabled={busy}
                              className="flex items-center gap-1.5 text-xs font-medium text-primary px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              Add
                            </button>
                          )}
                          {state === "active" && (
                            <button
                              onClick={() => handleArchiveOption(option)}
                              disabled={busy}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1.5 rounded-lg hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                              Archive
                            </button>
                          )}
                          {state === "archived" && (
                            <button
                              onClick={() => handleRestoreOption(option)}
                              disabled={busy}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1.5 rounded-lg hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArchiveRestore className="h-3 w-3" />}
                              Restore
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            trackId ? (
              <SafeBoundary label="Specification checklist">
                <SpecChecklist trackId={trackId} topics={activeTopics} hasExamBoard={!!track?.exam_board} />
              </SafeBoundary>
            ) : null
          )}
        </div>
      </main>

      {/* Fullscreen knowledge map — the whole-course view, opened deliberately rather than sharing
          a screen with the sidebar that lists the same tree. */}
      {mapOpen && (
        <SafeBoundary label="Knowledge map">
          <KnowledgeMap
            topics={activeTopics}
            trackTitle={track?.title}
            fullscreen
            onFullscreenChange={(open) => setMapOpen(open)}
            onSubtopicClick={(id) => navigate(`/session/${id}`)}
            onVerifyClick={(id) => navigate(`/track/${trackId}/questions?subtopic=${id}&mode=verify`)}
          />
        </SafeBoundary>
      )}

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
    </AppShell>
  );
}
