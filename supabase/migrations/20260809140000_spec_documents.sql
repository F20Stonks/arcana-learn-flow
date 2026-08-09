-- Pins the resolved specification document per (board, subject, level) so grounding stops re-rolling
-- the search dice on every run. See supabase/functions/_shared/specSearch.ts's resolveSpecDocument —
-- until now every call re-searched Tavily and re-parsed whatever it found, so two grounding runs on
-- the identical syllabus could legitimately ground against two different documents, which undermines
-- the whole point of an auditable cache sitting on top of it (syllabus_trees.coverage.source_url is
-- meant to be a stable thing a human can spot-check, not a coin flip). This table makes the resolved
-- document itself a cached, reusable artifact — same economic argument as syllabus_trees one level up:
-- author (here, RESOLVE) the expensive thing once, serve it to every future grounding run.
--
-- Scoped to the TEXT specifically, not a full mirror-the-raw-file-for-students-to-read feature (that's
-- a real fast-follow, not done in this pass — see the storage bucket comment below). What's cached here
-- is exactly what author-syllabus-tree's groundTree() actually consumes: the extracted text and where
-- it came from.

-- Storage bucket for the raw mirrored file, when a later pass adds that (not populated yet — storage_path
-- stays NULL until then). Created now so the schema doesn't need a second migration when it is. Public,
-- matching past-papers' own reasoning: a real exam board's published specification is meant to be
-- freely readable, same as a past paper — there's nothing here to gate behind auth.
INSERT INTO storage.buckets (id, name, public)
VALUES ('spec-documents', 'spec-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read spec document files" ON storage.objects
  FOR SELECT USING (bucket_id = 'spec-documents');

CREATE TABLE public.spec_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board TEXT NOT NULL,
  subject TEXT NOT NULL,
  level TEXT,
  source_url TEXT NOT NULL,       -- where resolveSpecDocument found this
  extracted_text TEXT NOT NULL,   -- what groundTree actually chunks and grounds against
  storage_path TEXT,              -- raw mirrored file, NULL until the mirroring fast-follow lands
  relevance_score INTEGER,        -- resolveSpecDocument's own match score, kept so a human can sanity-
                                   -- check why THIS document was picked, not just that one was
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spec_documents ENABLE ROW LEVEL SECURITY;
-- Same shape as past_papers: any authenticated user may read (the content is meant to be freely public
-- anyway, so no rate-limiting/mediation is needed the way reference_questions' curated corpus needed —
-- see 20260809120000_close_direct_table_reads.sql for why that one was different). Writes are
-- service-role only, from author-syllabus-tree's grounding path.
CREATE POLICY "Authenticated users can read spec documents" ON public.spec_documents FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.spec_documents FROM anon;
GRANT SELECT ON public.spec_documents TO authenticated;

-- The only hot query: exact (board, subject, level) lookup before a live resolve is attempted.
CREATE INDEX idx_spec_documents_lookup ON public.spec_documents(board, subject, level);
