CREATE POLICY "Authenticated can read reference paper files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'reference-papers');

CREATE TABLE public.reference_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_competition TEXT NOT NULL,
  year INTEGER,
  question_number TEXT,
  subject TEXT NOT NULL,
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  difficulty TEXT,
  question_text TEXT NOT NULL,
  solution_text TEXT,
  has_diagram BOOLEAN NOT NULL DEFAULT false,
  storage_path TEXT,
  source_url TEXT NOT NULL,
  license_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON public.reference_questions FROM anon;
GRANT SELECT ON public.reference_questions TO authenticated;
GRANT ALL ON public.reference_questions TO service_role;

ALTER TABLE public.reference_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reference questions" ON public.reference_questions FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_reference_questions_source_url ON public.reference_questions(source_url);
CREATE INDEX idx_reference_questions_lookup ON public.reference_questions(source_competition, subject);