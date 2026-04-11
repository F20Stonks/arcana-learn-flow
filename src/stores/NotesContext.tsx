import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface Note {
  id: string;
  trackId: string;
  topicId: string;
  subtopicId: string;
  content: string;
  timestamp: number;
}

interface NotesContextType {
  notes: Note[];
  addNote: (note: Omit<Note, "id" | "timestamp">) => void;
  removeNote: (id: string) => void;
  getTrackNotes: (trackId: string) => Note[];
}

const NotesContext = createContext<NotesContextType | null>(null);

function loadNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem("jarvis-notes") || "[]");
  } catch {
    return [];
  }
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(loadNotes);

  const persist = (next: Note[]) => {
    setNotes(next);
    localStorage.setItem("jarvis-notes", JSON.stringify(next));
  };

  const addNote = useCallback(
    (note: Omit<Note, "id" | "timestamp">) => {
      const newNote: Note = { ...note, id: crypto.randomUUID(), timestamp: Date.now() };
      persist([...notes, newNote]);
    },
    [notes]
  );

  const removeNote = useCallback(
    (id: string) => persist(notes.filter((n) => n.id !== id)),
    [notes]
  );

  const getTrackNotes = useCallback(
    (trackId: string) => notes.filter((n) => n.trackId === trackId),
    [notes]
  );

  return (
    <NotesContext.Provider value={{ notes, addNote, removeNote, getTrackNotes }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}
