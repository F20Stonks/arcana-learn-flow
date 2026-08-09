CREATE POLICY "Anyone can read spec document files" ON storage.objects
  FOR SELECT USING (bucket_id = 'spec-documents');

CREATE TABLE public.spec_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board TEXT NOT NULL,
  subject TEXT NOT NULL,
  level TEXT,
  source_url TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  storage_path TEXT,
  relevance_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spec_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read spec documents" ON public.spec_documents FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.spec_documents FROM anon;
GRANT SELECT ON public.spec_documents TO authenticated;
GRANT ALL ON public.spec_documents TO service_role;

CREATE INDEX idx_spec_documents_lookup ON public.spec_documents(board, subject, level);