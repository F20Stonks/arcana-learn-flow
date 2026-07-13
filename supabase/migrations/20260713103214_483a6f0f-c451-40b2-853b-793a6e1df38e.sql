ALTER TABLE public.learning_tracks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_learning_tracks_user_archived ON public.learning_tracks(user_id, archived_at);