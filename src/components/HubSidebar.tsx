import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LayoutGrid, Brain, CalendarDays, Loader2, CalendarClock, GraduationCap } from "lucide-react";

type TrackRow = { id: string; title: string; emoji: string | null; exam_date: string | null; subject: string };
type KnownConcept = { name: string; type: string; known_at: string };
type ReviewRow = { subtopic_id: string; next_review_due_at: string; interval_days: number };
type SubtopicTitle = { id: string; title: string };

export default function HubSidebar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [knownConcepts, setKnownConcepts] = useState<KnownConcept[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [subtopicTitles, setSubtopicTitles] = useState<SubtopicTitle[]>([]);

  useEffect(() => {
    if (!loaded && user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const now = new Date();
  const dueReviewCount = reviews.filter((r) => new Date(r.next_review_due_at) <= now).length;

  const loadData = async () => {
    setLoading(true);
    const { data: trackRows } = await supabase
      .from("learning_tracks")
      .select("id, title, emoji, exam_date, subject")
      .eq("user_id", user!.id);
    setTracks(trackRows || []);

    // Real known-concept knowledge (permanent, one-way per framework §4), most-recent first.
    const { data: uck } = await supabase
      .from("user_concept_knowledge")
      .select("known_at, concepts(name, type)")
      .eq("user_id", user!.id)
      .order("known_at", { ascending: false });
    const uckRows = (uck || []) as unknown as { known_at: string; concepts: { name: string; type: string } | null }[];
    setKnownConcepts(
      uckRows
        .map((r) => ({ name: r.concepts?.name as string, type: r.concepts?.type || "terminology", known_at: r.known_at }))
        .filter((c) => !!c.name),
    );

    // Real spaced-review schedule (fixed-doubling, advanced server-side on each completed review, §6).
    const { data: rev } = await supabase
      .from("subtopic_reviews")
      .select("subtopic_id, next_review_due_at, interval_days")
      .eq("user_id", user!.id);
    setReviews(rev || []);

    const subIds = (rev || []).map((r) => r.subtopic_id);
    if (subIds.length > 0) {
      const { data: subs } = await supabase.from("subtopics").select("id, title").in("id", subIds);
      setSubtopicTitles(subs || []);
    }

    setLoaded(true);
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="relative text-muted-foreground hover:text-foreground transition-colors" title="Knowledge hub">
          <LayoutGrid className="h-5 w-5" />
          {dueReviewCount > 0 && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" title={`${dueReviewCount} review${dueReviewCount === 1 ? "" : "s"} due`} />
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Hub</SheetTitle>
        </SheetHeader>

        {loading && !loaded ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="knowledge" className="flex-1 flex flex-col min-h-0 mt-2">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="knowledge"><Brain className="h-3.5 w-3.5 mr-1.5" />Knowledge</TabsTrigger>
              <TabsTrigger value="calendar"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Calendar</TabsTrigger>
            </TabsList>

            <TabsContent value="knowledge" className="flex-1 overflow-y-auto">
              <KnowledgeTab tracks={tracks} knownConcepts={knownConcepts} />
            </TabsContent>
            <TabsContent value="calendar" className="flex-1 overflow-y-auto">
              <CalendarTab tracks={tracks} reviews={reviews} subtopicTitles={subtopicTitles} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

const CONCEPT_TYPE_LABEL: Record<string, string> = { notation: "notation", terminology: "term", skill: "skill" };

function KnowledgeTab({ tracks, knownConcepts }: { tracks: TrackRow[]; knownConcepts: KnownConcept[] }) {
  const recent = knownConcepts.slice(0, 10);

  return (
    <div className="space-y-5 py-2">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-foreground">Concepts known</span>
          <span className="text-2xl font-semibold text-primary tabular-nums">{knownConcepts.length}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Atomic concepts (notation, terminology, skills) you've locked in by completing sessions. These are
          global — learn one in any track and it counts everywhere.
        </p>
      </div>

      {recent.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recently learned</h4>
          <div className="space-y-1.5">
            {recent.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2">
                <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate flex-1">{c.name}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                  {CONCEPT_TYPE_LABEL[c.type] || c.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          {tracks.length === 0
            ? "Create a learning track to start banking concepts."
            : "Complete a session to start banking concepts here."}
        </p>
      )}
    </div>
  );
}

type CalendarEvent = { date: Date; label: string; kind: "exam" | "review"; subtopicId?: string };

function CalendarTab({ tracks, reviews, subtopicTitles }: { tracks: TrackRow[]; reviews: ReviewRow[]; subtopicTitles: SubtopicTitle[] }) {
  const navigate = useNavigate();
  const titleById = new Map(subtopicTitles.map((s) => [s.id, s.title]));
  const events: CalendarEvent[] = [];

  for (const t of tracks) {
    if (t.exam_date) {
      const d = new Date(t.exam_date);
      if (!isNaN(d.getTime())) events.push({ date: d, label: `${t.emoji || "📚"} ${t.title} exam`, kind: "exam" });
    }
  }
  for (const r of reviews) {
    const d = new Date(r.next_review_due_at);
    if (!isNaN(d.getTime())) {
      events.push({ date: d, label: `Review: ${titleById.get(r.subtopic_id) || "subtopic"}`, kind: "review", subtopicId: r.subtopic_id });
    }
  }
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = events.filter((e) => e.date >= today).slice(0, 10);

  return (
    <div className="space-y-4 py-2">
      <Calendar
        mode="single"
        className="mx-auto"
        modifiers={{
          exam: events.filter((e) => e.kind === "exam").map((e) => e.date),
          review: events.filter((e) => e.kind === "review").map((e) => e.date),
        }}
        modifiersClassNames={{
          exam: "bg-destructive/20 text-destructive font-semibold",
          review: "bg-warning/20 text-warning font-semibold",
        }}
      />

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upcoming</h4>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nothing scheduled yet.</p>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map((e, i) => {
              const clickable = e.kind === "review" && e.subtopicId;
              const row = (
                <>
                  <CalendarClock className={`h-3.5 w-3.5 shrink-0 ${e.kind === "exam" ? "text-destructive" : "text-warning"}`} />
                  <span className="flex-1 truncate text-foreground text-left">{e.label}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{e.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  {clickable && <span className="text-xs text-primary font-medium shrink-0">Start →</span>}
                </>
              );
              return clickable ? (
                <button
                  key={i}
                  onClick={() => navigate(`/session/${e.subtopicId}?mode=review`)}
                  className="w-full flex items-center gap-2 text-sm bg-card border border-border rounded-lg px-3 py-2 hover:border-primary/40 hover:bg-accent/40 transition-colors"
                >
                  {row}
                </button>
              ) : (
                <div key={i} className="flex items-center gap-2 text-sm bg-card border border-border rounded-lg px-3 py-2">
                  {row}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground bg-accent/50 rounded-lg p-3 leading-relaxed">
        Reviews use a fixed-doubling schedule: the first lands one week after you complete a subtopic, and each
        review you finish on time pushes the next one out twice as far (1 → 2 → 4 → 8 weeks…). Start a review from
        the list above.
      </p>
    </div>
  );
}
