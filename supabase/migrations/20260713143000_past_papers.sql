-- "Papers" feature: real official past papers (mirrored, cached globally by board+subject+level so
-- multiple students/tracks share one resolution instead of re-searching every time) and AI-generated
-- practice papers (per-user, saved so a paper can be resumed/reviewed rather than lost on navigation).

-- Storage bucket for mirrored past-paper PDFs. Public bucket: only ever populated with sources already
-- confirmed freely, publicly downloadable from the exam board's own site (never anything paywalled) —
-- see resolve-past-papers/index.ts and _shared/pastPaperResolver.ts for the accessibility check.
INSERT INTO storage.buckets (id, name, public)
VALUES ('past-papers', 'past-papers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read past paper files" ON storage.objects
  FOR SELECT USING (bucket_id = 'past-papers');

-- Global cache: one row per real past paper found, keyed loosely by (board, subject, level). Populated
-- server-side only (service role via resolve-past-papers) — mirrors the concepts-table pattern of
-- "search-before-create, server-only writes" so results accumulate and get reused, never duplicated
-- per-user.
CREATE TABLE public.past_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board TEXT NOT NULL,
  subject TEXT NOT NULL,
  level TEXT,
  title TEXT NOT NULL,
  year TEXT,
  paper_label TEXT,
  source_url TEXT NOT NULL,
  storage_path TEXT, -- set when the PDF was successfully mirrored into the past-papers bucket; NULL means link out to source_url instead (mirroring failed or was skipped, e.g. file too large)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.past_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read past papers" ON public.past_papers FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.past_papers FROM anon;
GRANT SELECT ON public.past_papers TO authenticated;
CREATE INDEX idx_past_papers_lookup ON public.past_papers(board, subject, level);

-- Per-user AI-generated practice papers. Saved (not ephemeral like Question Attack's quizzes) so a
-- student can resume an in-progress paper or review a past one, matching this app's existing pattern of
-- persisting session transcripts/notes rather than discarding them.
CREATE TABLE public.generated_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'exam')),
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions JSONB NOT NULL, -- [{question, options?, correct_answer, explanation, difficulty, topic, marks}]
  answers JSONB NOT NULL DEFAULT '[]'::jsonb, -- student's answers as they progress, same length/order as questions
  score INTEGER,
  total_marks INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generated papers" ON public.generated_papers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own generated papers" ON public.generated_papers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own generated papers" ON public.generated_papers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own generated papers" ON public.generated_papers FOR DELETE USING (auth.uid() = user_id);
REVOKE ALL ON public.generated_papers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_papers TO authenticated;
CREATE INDEX idx_generated_papers_user_track ON public.generated_papers(user_id, track_id);
