CREATE TABLE public.concepts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('notation', 'terminology', 'skill')),
  definition TEXT,
  aliases TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view concepts" ON public.concepts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert concepts" ON public.concepts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.subtopic_concepts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtopic_id UUID NOT NULL REFERENCES public.subtopics(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('teaches', 'requires')),
  UNIQUE (subtopic_id, concept_id, role)
);
ALTER TABLE public.subtopic_concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subtopic_concepts" ON public.subtopic_concepts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.subtopics st JOIN public.topics t ON t.id = st.topic_id JOIN public.learning_tracks lt ON lt.id = t.track_id WHERE st.id = subtopic_concepts.subtopic_id AND lt.user_id = auth.uid())
);
CREATE POLICY "Users can insert own subtopic_concepts" ON public.subtopic_concepts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.subtopics st JOIN public.topics t ON t.id = st.topic_id JOIN public.learning_tracks lt ON lt.id = t.track_id WHERE st.id = subtopic_concepts.subtopic_id AND lt.user_id = auth.uid())
);

CREATE TABLE public.user_concept_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  known_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE SET NULL,
  UNIQUE (user_id, concept_id)
);
ALTER TABLE public.user_concept_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own concept knowledge" ON public.user_concept_knowledge FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own concept knowledge" ON public.user_concept_knowledge FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.subtopic_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subtopic_id UUID NOT NULL REFERENCES public.subtopics(id) ON DELETE CASCADE,
  interval_days INTEGER NOT NULL DEFAULT 7,
  next_review_due_at TIMESTAMPTZ NOT NULL,
  last_completed_at TIMESTAMPTZ,
  UNIQUE (user_id, subtopic_id)
);
ALTER TABLE public.subtopic_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reviews" ON public.subtopic_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews" ON public.subtopic_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.subtopic_reviews FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_subtopic_concepts_subtopic ON public.subtopic_concepts(subtopic_id);
CREATE INDEX idx_subtopic_concepts_concept ON public.subtopic_concepts(concept_id);
CREATE INDEX idx_user_concept_knowledge_user ON public.user_concept_knowledge(user_id);
CREATE INDEX idx_subtopic_reviews_user ON public.subtopic_reviews(user_id);
CREATE INDEX idx_subtopic_reviews_due ON public.subtopic_reviews(next_review_due_at);
