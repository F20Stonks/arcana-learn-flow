-- Reference question corpus: real, freely-available questions (STEP, BMO, BPhO, and further afield)
-- used as (1) authentic content students can practise on directly and (2) grounding/reference material
-- for AI question generation. Global, non-personal content — same shape as past_papers: mirrored once,
-- read by every user, written only by the service-role ingestion function.
--
-- The ORIGINAL PDF is always kept (mirrored into storage), never just the AI-extracted text: extraction
-- covers the wording, but diagrams are shown from the real source page rather than AI-reconstructed, to
-- avoid any risk of a misrepresented figure. See ingest-reference-paper/index.ts.

INSERT INTO storage.buckets (id, name, public)
VALUES ('reference-papers', 'reference-papers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read reference paper files" ON storage.objects
  FOR SELECT USING (bucket_id = 'reference-papers');

CREATE TABLE public.reference_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_competition TEXT NOT NULL, -- e.g. "STEP II"
  year INTEGER,
  question_number TEXT,             -- e.g. "3" or "3(ii)"
  subject TEXT NOT NULL,
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  difficulty TEXT,                  -- AI-estimated, coarse (e.g. "hard")
  question_text TEXT NOT NULL,      -- LaTeX-embedded, rendered via MathRenderer — never shown as an image
  solution_text TEXT,               -- optional, same rendering; only set when the source includes one
  has_diagram BOOLEAN NOT NULL DEFAULT false, -- AI-flagged during segmentation; when true the UI must
                                     -- show the original page (via storage_path), never an AI redraw
  storage_path TEXT,                -- path into the reference-papers bucket for the ORIGINAL paper PDF;
                                     -- used to show the real page for any question with a diagram, since
                                     -- diagrams are deliberately never AI-reconstructed (see ingest fn)
  source_url TEXT NOT NULL,         -- the paper URL ingestion started from — the cache-check key
  license_note TEXT,                -- provenance, e.g. "publicly available past paper"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reference_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view reference questions" ON public.reference_questions FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.reference_questions FROM anon;
GRANT SELECT ON public.reference_questions TO authenticated;

-- The ingestion function's cache check (skip re-running AI on a paper already ingested) looks up by
-- source_url before writing anything — this is the index that check depends on.
CREATE INDEX idx_reference_questions_source_url ON public.reference_questions(source_url);
CREATE INDEX idx_reference_questions_lookup ON public.reference_questions(source_competition, subject);
