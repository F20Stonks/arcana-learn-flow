-- Question Attack quiz persistence — mirrors the existing generated_papers pattern (see
-- 20260713143000_past_papers.sql) so a quiz survives navigation/exit instead of being thrown away,
-- same per-user ownership/RLS shape, adapted fields for Question Attack's own config.
CREATE TABLE public.generated_question_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'exam')),
  question_type TEXT NOT NULL DEFAULT 'mixed' CHECK (question_type IN ('mixed', 'mcq', 'open')),
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions JSONB NOT NULL, -- [{question, options?, correct_answer, explanation, difficulty, topic, scene?, option_scenes?}]
  answers JSONB NOT NULL DEFAULT '[]'::jsonb, -- student's answers as they progress, same length/order as questions
  score INTEGER,
  total_questions INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_question_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generated question sets" ON public.generated_question_sets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own generated question sets" ON public.generated_question_sets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own generated question sets" ON public.generated_question_sets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own generated question sets" ON public.generated_question_sets FOR DELETE USING (auth.uid() = user_id);
REVOKE ALL ON public.generated_question_sets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_question_sets TO authenticated;
CREATE INDEX idx_generated_question_sets_user_track ON public.generated_question_sets(user_id, track_id);
