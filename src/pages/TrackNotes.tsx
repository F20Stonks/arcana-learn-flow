import { useMemo } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, BookOpen, StickyNote, Trash2 } from "lucide-react";
import { learningTracks } from "@/data/learningTracks";
import { useNotes } from "@/stores/NotesContext";
import { format } from "date-fns";

const TrackNotes = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { getTrackNotes, removeNote } = useNotes();

  const track = useMemo(() => learningTracks.find((t) => t.id === trackId), [trackId]);
  const notes = useMemo(() => (track ? getTrackNotes(track.id) : []), [track, getTrackNotes]);

  // Group notes by topic -> subtopic
  const grouped = useMemo(() => {
    if (!track) return new Map();
    const map = new Map<string, { topicTitle: string; subtopics: Map<string, { subtopicTitle: string; notes: typeof notes }> }>();
    for (const note of notes) {
      const topic = track.topics.find((t) => t.id === note.topicId);
      const subtopic = topic?.subtopics.find((s) => s.id === note.subtopicId);
      if (!map.has(note.topicId)) {
        map.set(note.topicId, { topicTitle: topic?.title ?? "Unknown", subtopics: new Map() });
      }
      const topicGroup = map.get(note.topicId)!;
      if (!topicGroup.subtopics.has(note.subtopicId)) {
        topicGroup.subtopics.set(note.subtopicId, { subtopicTitle: subtopic?.title ?? "Unknown", notes: [] });
      }
      topicGroup.subtopics.get(note.subtopicId)!.notes.push(note);
    }
    return map;
  }, [notes, track]);

  if (!track) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-8 py-5">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            All Tracks
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-lg">{track.emoji}</span>
          <span className="text-sm font-semibold text-foreground">{track.title}</span>
          <span className="text-muted-foreground">/</span>
          <StickyNote className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Notes</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-8">
        {notes.length === 0 ? (
          <div className="text-center py-20">
            <StickyNote className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h2 className="text-lg font-semibold text-foreground mb-1">No notes yet</h2>
            <p className="text-sm text-muted-foreground">Save notes from your subtopic conversations and they'll appear here.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([topicId, topicGroup]) => (
              <div key={topicId}>
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {topicGroup.topicTitle}
                </h2>
                <div className="space-y-4 ml-3">
                  {Array.from(topicGroup.subtopics.entries()).map(([subId, subGroup]) => (
                    <div key={subId}>
                      <h3 className="text-xs font-medium text-muted-foreground mb-2">{subGroup.subtopicTitle}</h3>
                      <div className="space-y-2">
                        {subGroup.notes.map((note) => (
                          <div key={note.id} className="group flex items-start gap-3 bg-card border border-border rounded-lg px-4 py-3">
                            <p className="flex-1 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{note.content}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-muted-foreground">{format(note.timestamp, "MMM d, h:mm a")}</span>
                              <button
                                onClick={() => removeNote(note.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TrackNotes;
