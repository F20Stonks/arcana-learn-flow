-- Add new metadata columns to reference_questions
ALTER TABLE public.reference_questions
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English',
ADD COLUMN IF NOT EXISTS source_country TEXT,
ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT 'past_paper', -- e.g., 'past_paper', 'mock', 'handout'
ADD COLUMN IF NOT EXISTS learning_track TEXT,                     -- e.g., 'ESAT', 'TMUA', 'A-Level', 'Olympiad'
ADD COLUMN IF NOT EXISTS full_pdf_storage_path TEXT;              -- Path to the complete PDF resource

-- Track individual attempts on reference questions. No writer exists yet — the current
-- ReferenceQuestions.tsx / StepQuestions.tsx surfaces are read-only viewers with a reveal-solution
-- toggle, not an answer-submission flow. This table is forward infrastructure for that flow (part of
-- the "general question engine" rebuild), not something populated by anything shipped today.
CREATE TABLE IF NOT EXISTS public.user_question_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reference_question_id UUID NOT NULL REFERENCES public.reference_questions(id) ON DELETE CASCADE,
    attempt_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempt_end TIMESTAMPTZ,
    time_spent_seconds INTEGER,
    score FLOAT,             -- e.g., percentage or raw score depending on question
    is_completed BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,              -- User's notes or scratchpad for this attempt
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_question_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own attempts" ON public.user_question_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own attempts" ON public.user_question_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own attempts" ON public.user_question_attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.user_question_attempts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_question_attempts TO authenticated;

CREATE INDEX idx_user_attempts_user_id ON public.user_question_attempts(user_id);
CREATE INDEX idx_user_attempts_question_id ON public.user_question_attempts(reference_question_id);


-- Which concepts a reference question exercises or assumes — the reference-question equivalent of
-- subtopic_concepts (see 20260709120000_knowledge_tracker_v1.sql). Deliberately NOT a path to writing
-- user_concept_knowledge: per docs/knowledge-tracker-framework.md §4, "known" is earned by completing
-- a full teaching session ("enforced by session design... not by the tracker"), not by answering a
-- practice question correctly — a lucky guess on a hard olympiad question must not permanently flip a
-- concept to known. This table exists so attempt data can be CORRELATED against what's already known
-- (surfacing "you got this right without having formally learned X yet" or feeding a future
-- "recommend questions relevant to what you know" feature) without polluting the tracker itself.
CREATE TABLE IF NOT EXISTS public.reference_question_concepts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reference_question_id UUID NOT NULL REFERENCES public.reference_questions(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'tests' CHECK (role IN ('tests', 'requires')),
    UNIQUE (reference_question_id, concept_id, role)
);

ALTER TABLE public.reference_question_concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reference question concepts" ON public.reference_question_concepts FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.reference_question_concepts FROM anon;
GRANT SELECT ON public.reference_question_concepts TO authenticated;
GRANT ALL ON public.reference_question_concepts TO service_role;

CREATE INDEX idx_reference_question_concepts_question ON public.reference_question_concepts(reference_question_id);
CREATE INDEX idx_reference_question_concepts_concept ON public.reference_question_concepts(concept_id);

-- Live aggregation over real attempt data — a VIEW rather than a maintained table, so there is no
-- separate "who updates this" problem (the earlier draft of this migration had a user_topic_mastery
-- TABLE with no writer specified anywhere, table or trigger — it would have sat empty forever even
-- once attempts existed). Empty until the answer-submission flow ships and starts writing attempts;
-- that's a correct, honest empty state, not a bug.
CREATE OR REPLACE VIEW public.user_resource_analytics WITH (security_invoker = true) AS
SELECT
    uqa.user_id,
    rq.learning_track,
    rq.subject,
    rq.difficulty,
    COUNT(uqa.id) as total_attempts,
    SUM(CASE WHEN uqa.is_completed THEN 1 ELSE 0 END) as completed_attempts,
    AVG(uqa.score) as average_score,
    SUM(uqa.time_spent_seconds) as total_time_spent
FROM
    public.user_question_attempts uqa
JOIN
    public.reference_questions rq ON uqa.reference_question_id = rq.id
GROUP BY
    uqa.user_id, rq.learning_track, rq.subject, rq.difficulty;

GRANT SELECT ON public.user_resource_analytics TO authenticated;
