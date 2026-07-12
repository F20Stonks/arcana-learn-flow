import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LayoutGrid, Brain, MessageCircle, CalendarDays, Send, Loader2, CalendarClock, GraduationCap } from "lucide-react";
import MathRenderer from "./MathRenderer";

type TrackRow = { id: string; title: string; emoji: string | null; exam_date: string | null; subject: string };
type SubtopicRow = { id: string; title: string; status: string; completed_at: string | null; topic_id: string };
type ChatMessage = { role: "user" | "assistant"; content: string };

const REVIEW_INTERVAL_DAYS = 7; // placeholder fixed first-stage interval, per docs/knowledge-tracker-framework.md §6

export default function HubSidebar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [subtopics, setSubtopics] = useState<SubtopicRow[]>([]);

  useEffect(() => {
    if (!loaded && user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const dueReviewCount = subtopics.filter((s) => {
    if (s.status !== "complete" || !s.completed_at) return false;
    const due = new Date(s.completed_at);
    due.setDate(due.getDate() + REVIEW_INTERVAL_DAYS);
    return due <= new Date();
  }).length;

  const loadData = async () => {
    setLoading(true);
    const { data: trackRows } = await supabase
      .from("learning_tracks")
      .select("id, title, emoji, exam_date, subject")
      .eq("user_id", user!.id);
    setTracks(trackRows || []);

    const trackIds = (trackRows || []).map((t) => t.id);
    if (trackIds.length > 0) {
      const { data: topicRows } = await supabase.from("topics").select("id, track_id").in("track_id", trackIds);
      const topicIds = (topicRows || []).map((t) => t.id);
      if (topicIds.length > 0) {
        const { data: subRows } = await supabase
          .from("subtopics")
          .select("id, title, status, completed_at, topic_id")
          .in("topic_id", topicIds);
        setSubtopics(subRows || []);
      }
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
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="knowledge"><Brain className="h-3.5 w-3.5 mr-1.5" />Knowledge</TabsTrigger>
              <TabsTrigger value="chat"><MessageCircle className="h-3.5 w-3.5 mr-1.5" />Chat</TabsTrigger>
              <TabsTrigger value="calendar"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Calendar</TabsTrigger>
            </TabsList>

            <TabsContent value="knowledge" className="flex-1 overflow-y-auto">
              <KnowledgeTab tracks={tracks} subtopics={subtopics} />
            </TabsContent>
            <TabsContent value="chat" className="flex-1 flex flex-col min-h-0">
              <ChatTab />
            </TabsContent>
            <TabsContent value="calendar" className="flex-1 overflow-y-auto">
              <CalendarTab tracks={tracks} subtopics={subtopics} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function KnowledgeTab({ tracks, subtopics }: { tracks: TrackRow[]; subtopics: SubtopicRow[] }) {
  const completed = subtopics.filter((s) => s.status === "complete");
  const pct = subtopics.length > 0 ? Math.round((completed.length / subtopics.length) * 100) : 0;
  const recent = [...completed]
    .filter((s) => s.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-5 py-2">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Subtopics mastered</span>
          <span className="text-sm text-muted-foreground">{completed.length} / {subtopics.length}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-accent/50 rounded-lg p-3 leading-relaxed">
        This shows subtopic completion as a stand-in for real concept-level knowledge tracking.
        The full per-concept tracker (prerequisite checks, notation/skill-level mastery) is designed
        but not wired in yet — it needs a database migration that hasn't been applied to the live
        project. Once that's in, this tab will show actual known concepts instead of this proxy.
      </div>

      {recent.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recently completed</h4>
          <div className="space-y-1.5">
            {recent.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2">
                <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tracks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Create a learning track to start tracking progress.</p>
      )}
    </div>
  );
}

type CalendarEvent = { date: Date; label: string; kind: "exam" | "review"; subtopicId?: string };

function CalendarTab({ tracks, subtopics }: { tracks: TrackRow[]; subtopics: SubtopicRow[] }) {
  const navigate = useNavigate();
  const events: CalendarEvent[] = [];

  for (const t of tracks) {
    if (t.exam_date) {
      const d = new Date(t.exam_date);
      if (!isNaN(d.getTime())) events.push({ date: d, label: `${t.emoji || "📚"} ${t.title} exam`, kind: "exam" });
    }
  }
  for (const s of subtopics) {
    if (s.status === "complete" && s.completed_at) {
      const due = new Date(s.completed_at);
      due.setDate(due.getDate() + REVIEW_INTERVAL_DAYS);
      events.push({ date: due, label: `Review: ${s.title}`, kind: "review", subtopicId: s.id });
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
        Review reminders show only the first review (one week after completion, per the fixed-doubling
        schedule). Completing or skipping a review, and later intervals doubling, needs a small backend
        table that hasn't been created yet — see the Knowledge tab for details.
      </p>
    </div>
  );
}

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me anything — about a specific topic, general study strategy, or what to focus on next." },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setStreaming(true);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          systemOverride: `You are Jarvis, the student's general-purpose learning assistant, available outside of a specific tutoring session. Answer questions about their subjects, study strategy, or what to focus on next. Be concise (max 4 sentences unless the student asks for more detail). Use $...$ for inline math and $$...$$ for block math where relevant.`,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ") || line.trim() === "") continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > allMessages.length) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            break;
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Try again." }]);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 py-2">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"
            }`}>
              <MathRenderer content={msg.content} />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="pt-3">
        <div className="flex items-center gap-2 bg-accent rounded-lg px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask a question..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={streaming}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30"
          >
            {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
