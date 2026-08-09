/**
 * OBSIDIAN INSTRUMENT — Cortexed dashboard.
 * Near-black canvas, luminance hierarchy, cyan reserved for live elements,
 * hairline glass cards, calm staggered reveals. One idea per region.
 *
 * Shell ported from the Manus mockup (client/src/pages/Home.tsx). Manus's file rendered
 * fixed mock data with every interactive element a toast() stub; this wires it to the real
 * Supabase-backed tracks/profile/auth and adds what the mock didn't need to handle because
 * its data never changed shape:
 *  - loading and error states (loadTracks can fail or take a moment; Manus's fixed array
 *    never did either)
 *  - an empty state for a brand-new user with zero tracks (Manus always had 5)
 *  - real archive/delete, with the existing destructive-action confirmation dialog
 *  - the GeneralChat panel "Ask Cortexed" opens, and the Hub/Customize/Settings/Sign-out
 *    icons in CommandBar actually do something (see that file)
 * The tracks grid, ghost "new track" card, and archived toggle are otherwise Manus's exact
 * markup — only the data feeding them is real.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import CommandBar from "@/components/CommandBar";
import UpNextCard from "@/components/UpNextCard";
import TrackCard from "@/components/TrackCard";
import GeneralChat from "@/components/GeneralChat";
import SafeBoundary from "@/components/SafeBoundary";
import QuestionBankCard from "@/components/QuestionBankCard";
import { SubtopicLite, TrackLite } from "@/lib/nextAction";
import { useNextAction } from "@/hooks/useNextAction";
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

type Track = Tables<"learning_tracks"> & {
  topicCount: number;
  subtopicCount: number;
  completedCount: number;
  subtopicsDetail: SubtopicLite[];
  archived_at?: string | null;
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Track | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadTracks = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError("");
    try {
      const { data: rawTracks, error } = await supabase
        .from("learning_tracks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const enriched: Track[] = await Promise.all(
        (rawTracks || []).map(async (t) => {
          try {
            // .is("archived_at", null): an archived option's topics (see TrackOverview.tsx) shouldn't
            // count toward this track's progress ring or "what's next" — same reasoning as an archived
            // TRACK already being excluded from this dashboard entirely.
            const { data: topics } = await (supabase.from("topics" as never) as any)
              .select("id, order_index").eq("track_id", t.id).is("archived_at", null);
            const topicIds = topics?.map((tp) => tp.id) || [];
            const topicOrderById = new Map<string, number>(
              (topics || []).map((tp: { id: string; order_index: number }) => [tp.id, tp.order_index]),
            );
            let subtopicCount = 0;
            let completedCount = 0;
            let subtopicsDetail: SubtopicLite[] = [];
            if (topicIds.length > 0) {
              const { data: subs } = await supabase
                .from("subtopics")
                .select("id, title, status, order_index, topic_id, estimated_minutes")
                .in("topic_id", topicIds);
              subtopicCount = subs?.length || 0;
              completedCount = subs?.filter((s) => s.status === "complete").length || 0;
              subtopicsDetail = (subs || []).map((s) => ({
                id: s.id,
                title: s.title,
                status: s.status,
                topicOrder: topicOrderById.get(s.topic_id) ?? 0,
                order: s.order_index,
                estimatedMinutes: s.estimated_minutes,
              }));
            }
            return { ...t, topicCount: topicIds.length, subtopicCount, completedCount, subtopicsDetail };
          } catch (err) {
            console.warn("Track enrichment failed:", err);
            return { ...t, topicCount: 0, subtopicCount: 0, completedCount: 0, subtopicsDetail: [] };
          }
        }),
      );
      setTracks(enriched);
    } catch (err) {
      console.error("Dashboard track load failed:", err);
      setTracks([]);
      setLoadError("Cortexed couldn't load your tracks. You can retry or create a new one.");
    } finally {
      setLoading(false);
    }
  };

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

  const activeTracks = useMemo(() => tracks.filter((t) => !t.archived_at), [tracks]);
  const archivedTracks = useMemo(() => tracks.filter((t) => t.archived_at), [tracks]);

  const nextActionTracks = useMemo<TrackLite[]>(
    () =>
      activeTracks.map((t) => ({
        id: t.id,
        title: t.title,
        examDate: t.exam_date,
        createdAt: t.created_at,
        subtopics: t.subtopicsDetail,
      })),
    [activeTracks],
  );

  const plan = useNextAction(nextActionTracks);

  if (loading) {
    return (
      <div className="relative min-h-screen bg-background">
        <CommandBar />
        <main className="relative mx-auto flex max-w-6xl items-center gap-3 px-5 pb-24 pt-24 sm:px-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-[14px] text-muted-foreground">Opening your workspace…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Ambient canvas glow — depth without noise. color-mix against the live tokens so this
          re-tints per theme instead of a fixed cyan/violet blob (which reads oddly on light
          backgrounds like Light/Paper). */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -10%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 65%), radial-gradient(ellipse 45% 35% at 88% 68%, color-mix(in oklab, var(--foreground) 5%, transparent), transparent 70%)",
        }}
      />

      <CommandBar />

      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        {loadError && (
          <div className="glass-card reveal mb-8 rounded-2xl p-5">
            <p className="text-[14px] font-medium text-foreground">{loadError}</p>
            <button
              onClick={loadTracks}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Retry loading tracks
            </button>
          </div>
        )}

        {plan ? (
          <UpNextCard plan={plan} displayName={profile?.display_name || "learner"} onToggleChat={() => setChatOpen((v) => !v)} />
        ) : (
          <section className="reveal" style={{ animationDelay: "60ms" }}>
            <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground sm:text-[32px]">
              Welcome, <span className="font-serif-accent font-normal text-foreground/80">{profile?.display_name || "learner"}</span>
            </h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {activeTracks.length > 0 ? "Every session is complete — add something new whenever you're ready." : "Choose what you're studying and a complete path is built for you."}
            </p>
            <button
              onClick={() => navigate("/onboarding?new=1")}
              className="glow-cyan glow-cyan-hover mt-6 flex h-12 items-center gap-2.5 rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition-all hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New track
            </button>
          </section>
        )}

        {chatOpen && (
          <section className="glass-card reveal mt-6 rounded-2xl p-6">
            <SafeBoundary label="Cortexed chat">
              <GeneralChat />
            </SafeBoundary>
          </section>
        )}

        {/* Learning tracks */}
        <section className="mt-16">
          <div className="reveal mb-6 flex items-center justify-between" style={{ animationDelay: "180ms" }}>
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                Learning <span className="font-serif-accent font-normal">tracks</span>
              </h2>
              <span className="readout text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {activeTracks.length} active
              </span>
            </div>
            <button
              onClick={() => navigate("/onboarding?new=1")}
              className="flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary/80">
              <Plus className="h-3.5 w-3.5" />
              New track
            </button>
          </div>

          {activeTracks.length === 0 ? (
            <div className="glass-card reveal rounded-2xl p-10 text-center" style={{ animationDelay: "220ms" }}>
              <p className="text-[14px] text-muted-foreground">
                {archivedTracks.length > 0 ? "No active tracks — restore one below, or start a new one." : "No tracks yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeTracks.map((t, i) => (
                <TrackCard
                  key={t.id}
                  track={{
                    id: t.id,
                    title: t.title,
                    subject: t.subject,
                    topicCount: t.topicCount,
                    subtopicCount: t.subtopicCount,
                    completedCount: t.completedCount,
                  }}
                  delay={220 + i * 70}
                  onArchive={() => setArchived(t, true)}
                  onDelete={() => setPendingDelete(t)}
                />
              ))}

              {/* Ghost "new track" card */}
              <button
                onClick={() => navigate("/onboarding?new=1")}
                className="reveal group flex min-h-[210px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground/80"
                style={{ animationDelay: `${220 + activeTracks.length * 70}ms` }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-accent/40 transition-colors group-hover:border-primary/30 group-hover:text-primary">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="text-[14px] font-medium">Start a new track</span>
                <span className="px-8 text-center text-[12px] text-muted-foreground/70">
                  Name the goal. The path builds itself.
                </span>
              </button>
            </div>
          )}
        </section>

        {/* Practice — corpus-wide surfaces that aren't scoped to any one track. */}
        <section className="mt-12">
          <div className="reveal mb-4" style={{ animationDelay: "520ms" }}>
            <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">
              Practice <span className="font-serif-accent font-normal">papers</span>
            </h2>
          </div>
          <SafeBoundary label="STEP question bank" compact>
            <QuestionBankCard delay={560} />
          </SafeBoundary>
        </section>

        {/* Archived */}
        {archivedTracks.length > 0 && (
          <section className="reveal mt-12" style={{ animationDelay: "600ms" }}>
            <button
              onClick={() => setArchivedOpen((v) => !v)}
              aria-expanded={archivedOpen}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-accent/20 px-4 py-3 text-left transition-colors hover:bg-accent/30">
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  archivedOpen ? "rotate-90" : ""
                }`}
              />
              <span className="micro-label !text-muted-foreground">Archived</span>
              <span className="readout text-[12px] text-muted-foreground">({archivedTracks.length})</span>
            </button>
            {archivedOpen && (
              /* Manus's exact box (client/src/pages/Home.tsx) held static placeholder text —
                 there was no per-track markup to port, since the mockup never had real archived
                 tracks to render. Same container, same type scale; each row is plain text plus
                 two inline actions so it reads as one box, not a second component style. */
              <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-accent/10 px-5 py-2 text-[13px] text-muted-foreground">
                {archivedTracks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1 truncate text-left">{t.title}</span>
                    <button
                      onClick={() => setArchived(t, false)}
                      className="shrink-0 font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => setPendingDelete(t)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="mt-20 border-t border-border pt-6 text-center">
          <p className="text-[12px] text-muted-foreground/70">
            Cortexed — an instrument for mathematical &amp; physical understanding.
          </p>
        </footer>
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
