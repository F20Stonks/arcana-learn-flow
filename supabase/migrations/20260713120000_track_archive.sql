-- Soft-archive for learning tracks. An archived track drops off the main dashboard grid but keeps ALL
-- of its data (topics, subtopics, notes, progress, concept links) and can be restored at any time.
-- NULL = active; a timestamp = archived (and when). Reversible, unlike delete.
ALTER TABLE public.learning_tracks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Dashboard queries filter by (user_id, archived_at); index the pair.
CREATE INDEX IF NOT EXISTS idx_learning_tracks_user_archived ON public.learning_tracks(user_id, archived_at);
