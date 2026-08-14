import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Target, Clock, Trophy, Brain, BarChart3, Flame, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AppShell from "@/components/AppShell";

interface SessionRow {
  started_at: string;
  completed_at: string | null;
}
interface KnownConcept {
  name: string;
  type: string;
  known_at: string;
}
interface ResourceStat {
  subject: string | null;
  total_attempts: number;
  completed_attempts: number;
  average_score: number | null;
  total_time_spent: number | null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Last 7 calendar days, oldest first, as {name, sessions} — real completed-session counts, not
 *  demonstration data. Built from the caller's own session rows so there's exactly one query. */
function weeklyActivity(sessions: SessionRow[]): { name: string; sessions: number }[] {
  const days: { name: string; sessions: number; key: string }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ name: DAY_LABELS[d.getDay()], sessions: 0, key: d.toDateString() });
  }
  for (const s of sessions) {
    if (!s.completed_at) continue;
    const key = new Date(s.completed_at).toDateString();
    const day = days.find((d) => d.key === key);
    if (day) day.sessions += 1;
  }
  return days.map(({ name, sessions }) => ({ name, sessions }));
}

/**
 * The "how am I doing" surface. Two honest halves: real learning progress (concepts, sessions, XP —
 * all data this app already collects) and reference-question practice analytics, which stays an
 * explicit "not yet" state until the question-engine rebuild ships an actual answer-submission flow
 * (see docs/knowledge-tracker-framework.md and the reference_question_concepts / user_question_attempts
 * tables in 20260810120000_resource_bank_analytics.sql). Showing a fake weekly chart or a mastery bar
 * with nothing behind it would be worse than showing nothing — a student can't tell "no data" from
 * "the app is confused" if both look identical.
 */
export default function AnalyticsDashboard() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [conceptsKnown, setConceptsKnown] = useState(0);
  const [recentConcepts, setRecentConcepts] = useState<KnownConcept[]>([]);
  const [resourceStats, setResourceStats] = useState<ResourceStat[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [sessionRes, conceptRes, resourceRes] = await Promise.all([
        supabase.from("sessions").select("started_at, completed_at").eq("user_id", user.id),
        supabase
          .from("user_concept_knowledge")
          .select("known_at, concepts(name, type)")
          .eq("user_id", user.id)
          .order("known_at", { ascending: false }),
        // Not in generated types yet (migration not applied live) — same as-never/as-any pattern the
        // rest of this feature already uses for reference_questions.
        (supabase.from("user_resource_analytics" as never) as any)
          .select("subject, total_attempts, completed_attempts, average_score, total_time_spent")
          .eq("user_id", user.id),
      ]);
      if (cancelled) return;

      setSessions((sessionRes.data as SessionRow[] | null) ?? []);

      const conceptRows = (conceptRes.data ?? []) as unknown as {
        known_at: string;
        concepts: { name: string; type: string } | null;
      }[];
      const known = conceptRows
        .filter((r) => r.concepts)
        .map((r) => ({ name: r.concepts!.name, type: r.concepts!.type, known_at: r.known_at }));
      setConceptsKnown(known.length);
      setRecentConcepts(known.slice(0, 6));

      // A missing table (migration not yet live) and a real-but-empty result look the same here —
      // both just leave resourceStats at []. Correct: this section already handles zero rows as its
      // own state, it doesn't need to distinguish "not deployed" from "no attempts yet."
      if (!resourceRes.error) setResourceStats((resourceRes.data as ResourceStat[] | null) ?? []);

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const completedSessions = sessions.filter((s) => s.completed_at).length;
  const totalMinutes = sessions.reduce((acc, s) => {
    if (!s.completed_at) return acc;
    const mins = (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000;
    return acc + (Number.isFinite(mins) && mins > 0 ? mins : 0);
  }, 0);
  const activityData = weeklyActivity(sessions);
  const hasResourceActivity = resourceStats.some((r) => r.total_attempts > 0);

  return (
    <AppShell>
    <div className="container mx-auto max-w-7xl p-6 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="mt-2 text-muted-foreground">Your real learning progress, at a glance.</p>
      </div>

      {loading ? (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="text-2xl font-bold">{completedSessions}</div>
              <p className="text-sm text-muted-foreground">Sessions completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <Brain className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold">{conceptsKnown}</div>
              <p className="text-sm text-muted-foreground">Concepts known</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{Math.round(totalMinutes)}m</div>
              <p className="text-sm text-muted-foreground">Time spent learning</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                <Trophy className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-2xl font-bold">{profile?.total_xp ?? 0}</div>
              <p className="text-sm text-muted-foreground">Total XP · {profile?.weekly_streak ?? 0}-week streak</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Activity overview
            </CardTitle>
            <CardDescription>Sessions completed over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mt-4 h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "currentColor", opacity: 0.5 }} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "currentColor", opacity: 0.5 }} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--background)", borderColor: "var(--border)", borderRadius: "8px" }} itemStyle={{ color: "var(--foreground)" }} />
                  <Line type="monotone" dataKey="sessions" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--primary)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently mastered</CardTitle>
            <CardDescription>Concepts you've locked in by completing sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentConcepts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Complete a session to start building your concept list.
              </p>
            ) : (
              <div className="space-y-3">
                {recentConcepts.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Reference question practice
          </CardTitle>
          <CardDescription>From the Resource Bank's past papers and Olympiad questions</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasResourceActivity ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Flame className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No practice attempts yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                This fills in once you start answering questions from the Resource Bank — nothing to
                show here until then.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resourceStats.map((r, i) => (
                <div key={i} className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-sm font-semibold">{r.subject || "General"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.completed_attempts}/{r.total_attempts} completed
                    {r.average_score != null && ` · ${Math.round(r.average_score)}% avg`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
