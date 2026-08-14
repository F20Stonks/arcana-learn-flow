/**
 * Review Calendar — exam dates and due reviews, as a real page.
 *
 * Was the "Calendar" tab inside HubSidebar's slide-over. Moved out for the same reason as the
 * other two Knowledge destinations: a sheet has no URL and no back button, and a month grid plus
 * an upcoming list wants more than a narrow column.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Loader2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type TrackRow = { id: string; title: string; exam_date: string | null };
type ReviewRow = { subtopic_id: string; next_review_due_at: string; interval_days: number };
type CalendarEvent = { date: Date; label: string; kind: "exam" | "review"; subtopicId?: string };

export default function ReviewCalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [titleById, setTitleById] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: trackRows }, { data: rev }] = await Promise.all([
        supabase.from("learning_tracks").select("id, title, exam_date").eq("user_id", user.id),
        supabase.from("subtopic_reviews").select("subtopic_id, next_review_due_at, interval_days").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setTracks((trackRows || []) as TrackRow[]);
      setReviews((rev || []) as ReviewRow[]);

      const subIds = (rev || []).map((r) => r.subtopic_id);
      if (subIds.length > 0) {
        const { data: subs } = await supabase.from("subtopics").select("id, title").in("id", subIds);
        if (!cancelled) setTitleById(new Map((subs || []).map((s) => [s.id, s.title])));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const events: CalendarEvent[] = [];
  for (const t of tracks) {
    if (t.exam_date) {
      const d = new Date(t.exam_date);
      // No emoji prefix: the row already carries a colour-coded CalendarClock.
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
  const upcoming = events.filter((e) => e.date >= today).slice(0, 20);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Review Calendar
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            What's due, and when your exams land.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center gap-3 py-16">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-[14px] text-muted-foreground">Loading your schedule…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div className="reveal glass-card rounded-2xl p-3" style={{ animationDelay: "60ms" }}>
              <Calendar
                mode="single"
                modifiers={{
                  exam: events.filter((e) => e.kind === "exam").map((e) => e.date),
                  review: events.filter((e) => e.kind === "review").map((e) => e.date),
                }}
                modifiersClassNames={{
                  exam: "bg-destructive/20 text-destructive font-semibold",
                  review: "bg-warning/20 text-warning font-semibold",
                }}
              />
            </div>

            <div className="reveal" style={{ animationDelay: "120ms" }}>
              <h2 className="micro-label mb-2">Upcoming</h2>
              {upcoming.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <p className="text-[14px] text-muted-foreground">
                    Nothing scheduled yet. Reviews are booked when you finish a session, and exam dates come from
                    your tracks.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {upcoming.map((e, i) => {
                    const clickable = e.kind === "review" && e.subtopicId;
                    const row = (
                      <>
                        <CalendarClock className={`h-4 w-4 shrink-0 ${e.kind === "exam" ? "text-destructive" : "text-warning"}`} />
                        <span className="flex-1 truncate text-left text-foreground">{e.label}</span>
                        <span className="shrink-0 text-[13px] text-muted-foreground">
                          {e.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        {clickable && <span className="shrink-0 text-[13px] font-medium text-primary">Start →</span>}
                      </>
                    );
                    return clickable ? (
                      <button
                        key={i}
                        onClick={() => navigate(`/session/${e.subtopicId}?mode=review`)}
                        className="glass-card glass-card-hover flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[14px]"
                      >
                        {row}
                      </button>
                    ) : (
                      <div key={i} className="glass-card flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[14px]">
                        {row}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-4 rounded-lg bg-accent/50 p-3.5 text-[13px] leading-relaxed text-muted-foreground">
                Reviews use expanding intervals: the first lands one week after you complete a subtopic, then each
                review pushes the next one further out based on how solidly you recalled it — the stronger the
                recall, the longer the gap. Struggle with one and it comes back sooner.
              </p>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
