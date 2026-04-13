import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, BookOpen, Loader2, Plus, X } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

type TopicWithSubs = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

function renderNoteContent(content: string) {
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let key = 0;

  while (remaining.includes("$$")) {
    const start = remaining.indexOf("$$");
    const end = remaining.indexOf("$$", start + 2);
    if (end === -1) break;
    if (start > 0) parts.push(<ReactMarkdown key={key++}>{remaining.slice(0, start)}</ReactMarkdown>);
    try { parts.push(<BlockMath key={key++} math={remaining.slice(start + 2, end)} />); } catch { parts.push(<code key={key++}>{remaining.slice(start + 2, end)}</code>); }
    remaining = remaining.slice(end + 2);
  }

  if (remaining.includes("$")) {
    const regex = /\$([^$]+)\$/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) parts.push(<ReactMarkdown key={key++}>{remaining.slice(lastIndex, match.index)}</ReactMarkdown>);
      try { parts.push(<InlineMath key={key++} math={match[1]} />); } catch { parts.push(<code key={key++}>{match[1]}</code>); }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < remaining.length) parts.push(<ReactMarkdown key={key++}>{remaining.slice(lastIndex)}</ReactMarkdown>);
  } else if (remaining) {
    parts.push(<ReactMarkdown key={key++}>{remaining}</ReactMarkdown>);
  }
  return parts;
}

export default function TrackNotes() {
  const { trackId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [topics, setTopics] = useState<TopicWithSubs[]>([]);
  const [notes, setNotes] = useState<Tables<"notes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<Tables<"notes"> | null>(null);
  const [filterSubtopicId, setFilterSubtopicId] = useState<string | null>(null);

  useEffect(() => {
    if (!trackId || !user) return;
    loadData();
  }, [trackId, user]);

  const loadData = async () => {
    const { data: t } = await supabase.from("learning_tracks").select("*").eq("id", trackId!).single();
    setTrack(t);

    const { data: rawTopics } = await supabase.from("topics").select("*").eq("track_id", trackId!).order("order_index");
    if (!rawTopics) { setLoading(false); return; }

    const enriched: TopicWithSubs[] = [];
    const allSubIds: string[] = [];
    for (const topic of rawTopics) {
      const { data: subs } = await supabase.from("subtopics").select("*").eq("topic_id", topic.id).order("order_index");
      enriched.push({ ...topic, subtopics: subs || [] });
      subs?.forEach(s => allSubIds.push(s.id));
    }
    setTopics(enriched);

    if (allSubIds.length > 0) {
      const { data: n } = await supabase.from("notes").select("*").eq("user_id", user!.id).in("subtopic_id", allSubIds).order("created_at", { ascending: false });
      setNotes(n || []);
    }
    setLoading(false);
  };

  const filtered = notes.filter(n => {
    if (filterSubtopicId && n.subtopic_id !== filterSubtopicId) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getSubtopicTitle = (subId: string | null) => {
    if (!subId) return "General";
    for (const t of topics) {
      const s = t.subtopics.find(s => s.id === subId);
      if (s) return s.title;
    }
    return "Unknown";
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar - Topic/Subtopic filter */}
      <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto md:min-h-screen">
        <div className="p-4 border-b border-border">
          <button onClick={() => navigate(`/track/${trackId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to track
          </button>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Notes — {track?.title}
          </h2>
        </div>

        <div className="p-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-accent text-sm text-foreground placeholder:text-muted-foreground outline-none border border-transparent focus:border-primary/30"
            />
          </div>

          <button
            onClick={() => setFilterSubtopicId(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${!filterSubtopicId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}
          >
            All notes ({notes.length})
          </button>

          {topics.map(topic => (
            <div key={topic.id} className="mt-2">
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">{topic.title}</p>
              {topic.subtopics.map(sub => {
                const count = notes.filter(n => n.subtopic_id === sub.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setFilterSubtopicId(sub.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${filterSubtopicId === sub.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}
                  >
                    {sub.title} ({count})
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex min-h-0">
        {/* Notes list */}
        <div className={`${selectedNote ? "hidden md:block" : ""} w-full md:w-80 border-r border-border overflow-y-auto`}>
          <div className="p-4 border-b border-border">
            <p className="text-xs text-muted-foreground">{filtered.length} note{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="p-6 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notes yet. Complete sessions to generate notes automatically.</p>
              </div>
            ) : (
              filtered.map(note => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full text-left p-4 hover:bg-accent transition-colors ${selectedNote?.id === note.id ? "bg-accent" : ""}`}
                >
                  <h4 className="text-sm font-medium text-foreground mb-1 truncate">{note.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{note.content}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{getSubtopicTitle(note.subtopic_id)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Note detail */}
        <div className={`${selectedNote ? "" : "hidden md:flex"} flex-1 overflow-y-auto`}>
          {selectedNote ? (
            <div className="p-6 max-w-2xl">
              <button onClick={() => setSelectedNote(null)} className="md:hidden flex items-center gap-1 text-sm text-muted-foreground mb-4">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <div className="mb-1">
                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">{getSubtopicTitle(selectedNote.subtopic_id)}</span>
              </div>
              <h2 className="text-lg font-semibold text-foreground mt-2 mb-4">{selectedNote.title}</h2>
              <div className="prose prose-sm prose-invert max-w-none">
                {renderNoteContent(selectedNote.content)}
              </div>
              <p className="text-xs text-muted-foreground mt-6">{new Date(selectedNote.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a note to view</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
