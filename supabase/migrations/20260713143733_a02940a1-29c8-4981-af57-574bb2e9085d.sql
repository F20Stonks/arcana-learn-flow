CREATE POLICY "Anyone can read past paper files" ON storage.objects
  FOR SELECT USING (bucket_id = 'past-papers');

CREATE TABLE public.past_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board TEXT NOT NULL,
  subject TEXT NOT NULL,
  level TEXT,
  title TEXT NOT NULL,
  year TEXT,
  paper_label TEXT,
  source_url TEXT NOT NULL,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.past_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read past papers" ON public.past_papers FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.past_papers FROM anon;
GRANT SELECT ON public.past_papers TO authenticated;
CREATE INDEX idx_past_papers_lookup ON public.past_papers(board, subject, level);

CREATE TABLE public.generated_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'exam')),
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions JSONB NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
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

CREATE TABLE public.spec_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  code TEXT,
  text TEXT NOT NULL,
  rigor TEXT NOT NULL DEFAULT 'simple' CHECK (rigor IN ('simple', 'complex')),
  evidence_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtopic_ids UUID[] NOT NULL DEFAULT '{}',
  source_url TEXT,
  ticked BOOLEAN NOT NULL DEFAULT false,
  ticked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spec_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own spec checklist items" ON public.spec_checklist_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.learning_tracks lt WHERE lt.id = spec_checklist_items.track_id AND lt.user_id = auth.uid())
);
REVOKE ALL ON public.spec_checklist_items FROM anon;
GRANT SELECT ON public.spec_checklist_items TO authenticated;
CREATE INDEX idx_spec_checklist_items_track ON public.spec_checklist_items(track_id);
CREATE INDEX idx_spec_checklist_items_topic ON public.spec_checklist_items(topic_id);