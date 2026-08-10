-- Add new metadata columns to reference_questions
ALTER TABLE public.reference_questions
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English',
ADD COLUMN IF NOT EXISTS source_country TEXT,
ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT 'past_paper', -- e.g., 'past_paper', 'mock', 'handout'
ADD COLUMN IF NOT EXISTS learning_track TEXT,                     -- e.g., 'ESAT', 'TMUA', 'A-Level', 'Olympiad'
ADD COLUMN IF NOT EXISTS full_pdf_storage_path TEXT;              -- Path to the complete PDF resource

-- Track individual attempts on reference questions
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


-- Track overall topic mastery based on attempts
CREATE TABLE IF NOT EXISTS public.user_topic_mastery (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    mastery_level FLOAT NOT NULL DEFAULT 0.0, -- Range 0.0 to 1.0 or similar
    attempts_count INTEGER NOT NULL DEFAULT 0,
    successful_attempts INTEGER NOT NULL DEFAULT 0,
    total_time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, topic)
);

ALTER TABLE public.user_topic_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own topic mastery" ON public.user_topic_mastery FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own topic mastery" ON public.user_topic_mastery FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own topic mastery" ON public.user_topic_mastery FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.user_topic_mastery FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_topic_mastery TO authenticated;

CREATE INDEX idx_user_topic_mastery_user_id ON public.user_topic_mastery(user_id);

-- Create a view for easy analytics querying
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
