import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LayoutGrid, Brain, CalendarDays, Loader2, CalendarClock, GraduationCap, Search, Network } from "lucide-react";
import ConceptGraph from "@/components/ConceptGraph";

const HUB_TITLE: Record<"knowledge" | "map" | "calendar", string> = {
  knowledge: "Concepts",
  map: "Competence",
  calendar: "Reviews",
};

type TrackRow = { id: string; title: string; emoji: string | null; exam_date: string | null; subject: string };
type KnownConcept = { name: string; type: string; known_at: string };
type ReviewRow = { subtopic_id: string; next_review_due_at: string; interval_days: number };
type SubtopicTitle = { id: string; title: string };

export type HubTab = "knowledge" | "map" | "calendar";

interface HubSidebarProps {
  /** Controlled open state. Omit to keep the component's own icon trigger and internal state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Which tab to land on. The app shell links straight to a tab so each Hub surface is a named
   *  destination in the sidebar rather than something you have to know is behind an icon. */
  tab?: HubTab;
  onTabChange?: (tab: HubTab) => void;
}

export default function HubSidebar({ open: openProp, onOpenChange, tab: tabProp, onTabChange }: HubSidebarProps = {}) {
  const { user } = useAuth();
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const setOpen = (v: boolean) => {
    if (!controlled) setOpenState(v);
    onOpenChange?.(v);
  };
  const [tabState, setTabState] = useState<HubTab>("knowledge");
  const tab = tabProp ?? tabState;
  const setTab = (v: HubTab) => {
    setTabState(v);
    onTabChange?.(v);
  };
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [knownConcepts, setKnownConcepts] = useState<KnownConcept[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [subtopicTitles, setSubtopicTitles] = useState<SubtopicTitle[]>([]);

  // Load only once the panel is actually opened. The shell mounts this on every page now, and the
  // badge count comes from useDueReviewCount, so eagerly running four queries per page load would
  // be pure waste.
  useEffect(() => {
    if (open && !loaded && user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

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
      {!controlled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <button
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Knowledge hub"
              >
                <LayoutGrid className="h-[17px] w-[17px]" />
                {dueReviewCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" title={`${dueReviewCount} review${dueReviewCount === 1 ? "" : "s"} due`} />
                )}
              </button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Hub</TooltipContent>
        </Tooltip>
      )}
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          {/* Titled by what you came for, not by the container. The sidebar entry that opened this
              says "Competence"; landing on a panel called "Hub" would make you re-orient. */}
          <SheetTitle>{HUB_TITLE[tab]}</SheetTitle>
        </SheetHeader>

        {loading && !loaded ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
          {/* The Resources / Analytics shortcuts that used to sit here are gone: they're permanent
              sidebar destinations now, and repeating them inside the panel was one more thing to
              read on a surface whose whole job is to be scannable. */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as HubTab)} className="flex-1 flex flex-col min-h-0 mt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="knowledge"><Brain className="h-3.5 w-3.5 mr-1.5" />Knowledge</TabsTrigger>
              <TabsTrigger value="map"><Network className="h-3.5 w-3.5 mr-1.5" />Map</TabsTrigger>
              <TabsTrigger value="calendar"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Calendar</TabsTrigger>
            </TabsList>

            <TabsContent value="knowledge" className="flex-1 overflow-y-auto">
              <KnowledgeTab tracks={tracks} knownConcepts={knownConcepts} />
            </TabsContent>
            <TabsContent value="map" className="flex-1 overflow-y-auto">
              <ConceptGraph />
            </TabsContent>
            <TabsContent value="calendar" className="flex-1 overflow-y-auto">
              <CalendarTab tracks={tracks} reviews={reviews} subtopicTitles={subtopicTitles} />
            </TabsContent>
          </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const CONCEPT_TYPE_LABEL: Record<string, string> = { notation: "notation", terminology: "term", skill: "skill" };

function KnowledgeTab({ tracks, knownConcepts }: { tracks: TrackRow[]; knownConcepts: KnownConcept[] }) {
  const [query, setQuery] = useState("");

  const typeCounts = knownConcepts.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});

  const q = query.trim().toLowerCase();
  const filtered = q ? knownConcepts.filter((c) => c.name.toLowerCase().includes(q)) : knownConcepts;

  return (
    <div className="space-y-4 py-2">
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-foreground">Concepts known</span>
          <span className="text-2xl font-semibold text-primary readout">{knownConcepts.length}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Atomic concepts (notation, terminology, skills) you've locked in by completing sessions. These are
          global — learn one in any track and it counts everywhere.
        </p>
        <div className="flex gap-1.5">
          {(["notation", "terminology", "skill"] as const).map((t) => (
            <div key={t} className="flex-1 rounded-lg bg-secondary/60 px-2 py-1.5 text-center">
              <div className="text-base font-semibold text-foreground readout leading-none">{typeCounts[t] || 0}</div>
              <div className="micro-label mt-0.5">{CONCEPT_TYPE_LABEL[t]}</div>
            </div>
          ))}
        </div>
      </div>

      {knownConcepts.length > 0 ? (
        <>
          <div className="flex items-center gap-2 glass-card rounded-lg px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search everything you know…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-hidden"
            />
          </div>

          <div>
            <h4 className="micro-label mb-2">
              {q ? `${filtered.length} match${filtered.length === 1 ? "" : "es"}` : "All concepts"}
            </h4>
            {filtered.length > 0 ? (
              <div className="space-y-1.5">
                {filtered.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-foreground glass-card rounded-lg px-3 py-2">
                    <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate flex-1">{c.name}</span>
                    <span className="shrink-0 micro-label bg-secondary rounded px-1.5 py-0.5">
                      {CONCEPT_TYPE_LABEL[c.type] || c.type}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No concepts match “{query}”.</p>
            )}
          </div>
        </>
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
      // No emoji prefix: the row already carries a colour-coded CalendarClock, so a 📚 in front of
      // the title was a second, less precise icon competing with it.
      if (!isNaN(d.getTime())) events.push({ date: d, label: `${t.title} exam`, kind: "exam" });
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
        <h4 className="micro-label mb-2">Upcoming</h4>
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
                  className="w-full flex items-center gap-2 text-sm glass-card glass-card-hover rounded-lg px-3 py-2"
                >
                  {row}
                </button>
              ) : (
                <div key={i} className="flex items-center gap-2 text-sm glass-card rounded-lg px-3 py-2">
                  {row}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground bg-accent/50 rounded-lg p-3 leading-relaxed">
        Reviews use expanding intervals: the first lands one week after you complete a subtopic, then each
        review pushes the next one further out based on how solidly you recalled it — the stronger the recall,
        the longer the gap. Struggle with one and it comes back sooner. Start a review from the list above.
      </p>
    </div>
  );
}
