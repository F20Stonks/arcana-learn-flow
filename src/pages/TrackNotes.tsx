import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, BookOpen, Search, Box } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import MathRenderer from "@/components/MathRenderer";
import InsightPreview from "@/components/workspace/InsightPreview";
import MathSymbolPalette from "@/components/MathSymbolPalette";
import RichMathField, { type RichMathFieldHandle } from "@/components/RichMathField";
import type { SimulationPayload } from "@/lib/simulationPayload";
import type { SceneSpec } from "@/lib/sceneSpec";

type TopicWithSubs = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

// `insights.payload` isn't in the generated types yet — see
// supabase/migrations/20260727180000_insights_payload.sql.
interface InsightRow {
  id: string;
  subtopic_id: string | null;
  title: string;
  payload: (SimulationPayload | SceneSpec) | null;
  created_at: string;
}

/**
 * Notes page — one living document per subtopic.
 * Groups all note fragments for a subtopic into a single scrollable, EDITABLE document, plus
 * any visualizations the student chose to save alongside it.
 */
export default function TrackNotes() {
  const { trackId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [topics, setTopics] = useState<TopicWithSubs[]>([]);
  const [notes, setNotes] = useState<Tables<"notes">[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deletingInsightId, setDeletingInsightId] = useState<string | null>(null);

  useEffect(() => {
    if (!trackId || !user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, user]);

  const loadData = async () => {
    const { data: t } = await supabase.from("learning_tracks").select("*").eq("id", trackId!).single();
    setTrack(t);

    // .is("archived_at", null): an archived option's topics shouldn't appear in the notes topic list.
    const { data: rawTopics } = await (supabase.from("topics" as never) as any)
      .select("*").eq("track_id", trackId!).is("archived_at", null).order("order_index");
    if (!rawTopics) { setLoading(false); return; }

    const enriched: TopicWithSubs[] = [];
    const allSubIds: string[] = [];
    for (const topic of rawTopics) {
      const { data: subs } = await supabase.from("subtopics").select("*").eq("topic_id", topic.id).order("order_index");
      enriched.push({ ...topic, subtopics: subs || [] });
      subs?.forEach(s => allSubIds.push(s.id));
    }
    setTopics(enriched);

    let fetchedNotes: Tables<"notes">[] = [];
    let fetchedInsights: InsightRow[] = [];
    if (allSubIds.length > 0) {
      const { data: n } = await supabase.from("notes").select("*").eq("user_id", user!.id).in("subtopic_id", allSubIds).order("created_at");
      fetchedNotes = n || [];
      setNotes(fetchedNotes);

      const { data: ins } = await (supabase.from("insights") as any)
        .select("*").eq("user_id", user!.id).in("subtopic_id", allSubIds).order("created_at");
      fetchedInsights = (ins || []) as InsightRow[];
      setInsights(fetchedInsights);
    }

    // Auto-select the first subtopic with content. Reads the freshly-fetched arrays directly
    // (not the `notes`/`insights` state, which wouldn't have committed yet on this same tick).
    const firstWithContent = allSubIds.find(
      id => fetchedNotes.some(n => n.subtopic_id === id) || fetchedInsights.some(i => i.subtopic_id === id),
    );
    if (firstWithContent) setSelectedSubtopicId(firstWithContent);

    setLoading(false);
  };

  const saveNotePatch = async (noteId: string, patch: { title?: string; content?: string }) => {
    setNotes(prev => prev.map(n => (n.id === noteId ? { ...n, ...patch } : n)));
    const { error } = await supabase.from("notes").update(patch).eq("id", noteId);
    if (error) console.error("Couldn't save note:", error);
  };

  const deleteInsight = async (id: string) => {
    setDeletingInsightId(id);
    await (supabase.from("insights") as any).delete().eq("id", id);
    setInsights(prev => prev.filter(i => i.id !== id));
    setDeletingInsightId(null);
  };

  const subtopicNotes = selectedSubtopicId ? notes.filter(n => n.subtopic_id === selectedSubtopicId) : [];
  const subtopicInsights = selectedSubtopicId ? insights.filter(i => i.subtopic_id === selectedSubtopicId) : [];

  const getSubtopicTitle = (subId: string) => {
    for (const t of topics) {
      const s = t.subtopics.find(s => s.id === subId);
      if (s) return s.title;
    }
    return "Unknown";
  };

  const subtopicsWithContent = new Set([...notes.map(n => n.subtopic_id), ...insights.map(i => i.subtopic_id)]);
  const insightCountBySubtopic = new Map<string, number>();
  insights.forEach(i => { if (i.subtopic_id) insightCountBySubtopic.set(i.subtopic_id, (insightCountBySubtopic.get(i.subtopic_id) || 0) + 1); });

  // Search matches a subtopic's own title, or any of its notes' title/content — same
  // "find the thing even if you don't remember which subtopic it lives under" as the topic
  // search built for Question Attack / Papers.
  const q = query.trim().toLowerCase();
  const subtopicMatchesQuery = (sub: Tables<"subtopics">) =>
    !q ||
    sub.title.toLowerCase().includes(q) ||
    notes.some(n => n.subtopic_id === sub.id && (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)));

  const visibleTopics = topics
    .map(t => ({ ...t, subtopics: t.subtopics.filter(s => subtopicsWithContent.has(s.id) && subtopicMatchesQuery(s)) }))
    .filter(t => t.subtopics.length > 0);

  // If a search narrows the list past the currently-open subtopic, jump to the first match
  // instead of leaving the reader staring at a document that no longer matches what they typed.
  useEffect(() => {
    if (!q) return;
    const stillVisible = visibleTopics.some(t => t.subtopics.some(s => s.id === selectedSubtopicId));
    if (!stillVisible) setSelectedSubtopicId(visibleTopics[0]?.subtopics[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (loading) return <AppShell><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppShell>;

  return (
    <AppShell>
    <div className="flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto md:sticky md:top-14 md:h-[calc(100vh-3.5rem)]">
        <div className="p-4 border-b border-border">
          <button onClick={() => navigate(`/track/${trackId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to track
          </button>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Notes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{track?.title}</p>
        </div>

        {subtopicsWithContent.size > 0 && (
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 bg-accent rounded-lg px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your notes…"
                className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-hidden"
              />
            </div>
          </div>
        )}

        <div className="p-2">
          {visibleTopics.map(topic => (
            <div key={topic.id} className="mb-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{topic.title}</p>
              {topic.subtopics.map(sub => {
                const noteCount = notes.filter(n => n.subtopic_id === sub.id).length;
                const vizCount = insightCountBySubtopic.get(sub.id) || 0;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubtopicId(sub.id)}
                    className={`w-full flex items-center gap-1.5 text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedSubtopicId === sub.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className="truncate flex-1">{sub.title}</span>
                    {noteCount > 0 && <span className="shrink-0 text-muted-foreground/50">{noteCount}</span>}
                    {vizCount > 0 && <Box className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                  </button>
                );
              })}
            </div>
          ))}

          {subtopicsWithContent.size === 0 && (
            <div className="p-6 text-center">
              <BookOpen className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No notes yet. Complete sessions to generate notes.</p>
            </div>
          )}
          {subtopicsWithContent.size > 0 && visibleTopics.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No notes match "{query}".</p>
          )}
        </div>
      </aside>

      {/* Document view */}
      <main className="flex-1 overflow-y-auto">
        {selectedSubtopicId && (subtopicNotes.length > 0 || subtopicInsights.length > 0) ? (
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Document title */}
            <div className="mb-6">
              <h1 className="text-lg font-bold text-foreground">
                {getSubtopicTitle(selectedSubtopicId)}
              </h1>
              {subtopicNotes.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {subtopicNotes.length} section{subtopicNotes.length !== 1 ? "s" : ""} · Last updated {new Date(subtopicNotes[subtopicNotes.length - 1].created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  · click any line to edit
                </p>
              )}
            </div>

            {/* Merged document */}
            {subtopicNotes.length > 0 && (
              <div className="space-y-6">
                {subtopicNotes.map((note, i) => (
                  <EditableNoteSection
                    key={note.id}
                    note={note}
                    onSave={(patch) => saveNotePatch(note.id, patch)}
                    isLast={i === subtopicNotes.length - 1}
                  />
                ))}
              </div>
            )}

            {subtopicInsights.length > 0 && (
              <div className={subtopicNotes.length > 0 ? "mt-10" : ""}>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Visualizations</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {subtopicInsights.map((ins) => (
                    <InsightPreview
                      key={ins.id}
                      title={ins.title}
                      payload={ins.payload}
                      onDelete={() => deleteInsight(ins.id)}
                      deleting={deletingInsightId === ins.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {subtopicsWithContent.size > 0 ? "Select a subtopic to view its notes" : "No notes yet"}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
    </AppShell>
  );
}

/**
 * Click-to-edit note: shows the rendered (MathRenderer/KaTeX) view by default so notes stay
 * readable at a glance, and swaps to a raw-text field on click — Escape reverts without saving,
 * blur commits. Edits overwrite the AI's version directly (this is a personal study tool, not a
 * shared record — there's no second reader who needs the original preserved).
 */
function EditableNoteSection({
  note,
  onSave,
  isLast,
}: {
  note: Tables<"notes">;
  onSave: (patch: { title?: string; content?: string }) => void;
  isLast: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [contentDraft, setContentDraft] = useState(note.content);
  const contentFieldRef = useRef<RichMathFieldHandle>(null);

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== note.title) onSave({ title: trimmed });
    else setTitleDraft(note.title);
  };
  const commitContent = () => {
    setEditingContent(false);
    if (contentDraft !== note.content) onSave({ content: contentDraft });
  };

  return (
    <section>
      {editingTitle ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setTitleDraft(note.title); setEditingTitle(false); }
          }}
          className="w-full mb-2 bg-transparent text-sm font-semibold text-foreground outline-hidden border-b border-primary/40 pb-0.5"
        />
      ) : (
        <h2
          onClick={() => setEditingTitle(true)}
          className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2 cursor-text rounded px-1 -mx-1 hover:bg-accent/40 transition-colors"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          {note.title}
        </h2>
      )}

      <div className="pl-4 border-l border-border/50">
        {editingContent ? (
          <div
            className="space-y-2"
            // Blur-commits only when focus leaves this whole group, not just the field —
            // opening the math composer (new insertion or re-editing an existing chip) moves
            // focus onto its <math-field>, which lives inside this same div, so that no longer
            // looks like "the student clicked away."
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitContent();
            }}
            onKeyDown={(e) => { if (e.key === "Escape") { setContentDraft(note.content); setEditingContent(false); } }}
          >
            <MathSymbolPalette onInsert={(latex) => contentFieldRef.current?.insertLatex(latex)} />
            <RichMathField
              ref={contentFieldRef}
              autoFocus
              value={contentDraft}
              onChange={setContentDraft}
              className="w-full bg-transparent outline-hidden text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words"
            />
          </div>
        ) : (
          <div
            onClick={() => setEditingContent(true)}
            className="cursor-text rounded px-1 -mx-1 hover:bg-accent/40 transition-colors"
          >
            <MathRenderer content={note.content} />
          </div>
        )}
      </div>
      {!isLast && <div className="mt-6" />}
    </section>
  );
}
