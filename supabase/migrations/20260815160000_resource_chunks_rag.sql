-- Retrieval store for grounding teaching in real source text, rather than only in whatever the model
-- happens to know. Deliberately content-AGNOSTIC: the table, the indexes and the retrieval function say
-- nothing about where chunks come from, because the first intended source turned out to be unusable.
--
-- LICENCE FINDING, 2026-08-15 — read before pointing an ingest at this table.
-- The plan was OpenStax maths/physics via their GitHub source. Checked directly, three for three:
--   osbooks-calculus-bundle          CC BY-NC-SA
--   osbooks-college-algebra-bundle   CC BY-NC-SA
--   osbooks-university-physics-bundle CC BY-NC-SA
-- NonCommercial rules those out for a paid product, and ShareAlike is viral on top of that. OpenStax
-- licences vary per title, so a CC BY OpenStax book would be fine — but the maths and physics ones are
-- not. Anything ingested here needs its licence checked per source, and `license_note` is NOT NULL so a
-- chunk can never exist without one recorded.
--
-- Content that IS clear for this app: the user's own lawyer-cleared past papers and mark schemes (see
-- the ingest-reference-paper solutions mode), which are also far closer to what UK students actually sit
-- than a US college textbook.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.resource_chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Where this came from, e.g. 'openstax', 'aqa-mark-scheme', 'own-notes'.
  source       text NOT NULL,
  book         text NOT NULL,
  subject      text NOT NULL,
  chapter      text,
  section      text,
  heading      text,
  content      text NOT NULL,
  char_len     integer NOT NULL,
  -- 768 dims: matches Gemini's text-embedding models at their default output size, and keeps the index
  -- small. Changing this requires re-embedding everything, so it is a deliberate commitment.
  embedding    vector(768),
  source_url   text,
  -- NOT NULL on purpose: attribution and licence terms travel with the chunk, so a retrieval result can
  -- always say what it is quoting and under what terms.
  license_note text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Service-role only, matching reference_questions: retrieval happens inside an edge function, never from
-- the browser, so there are no client policies.
ALTER TABLE public.resource_chunks ENABLE ROW LEVEL SECURITY;

-- Re-running an ingest must not duplicate content. Keyed on the text itself rather than a source URL,
-- because the same section can legitimately be re-fetched from a moved URL.
CREATE UNIQUE INDEX IF NOT EXISTS resource_chunks_dedupe_idx
  ON public.resource_chunks (book, COALESCE(section, ''), md5(content));
CREATE INDEX IF NOT EXISTS resource_chunks_subject_idx ON public.resource_chunks (subject);
-- Full-text as well as vector, so the table is useful before any embeddings exist and still works if an
-- embedding call fails.
CREATE INDEX IF NOT EXISTS resource_chunks_fts_idx
  ON public.resource_chunks USING gin (to_tsvector('english', content));

-- NOTE: no HNSW/IVFFlat index yet, on purpose. pgvector builds a better index over populated data than
-- over an empty table, and with zero rows a sequential scan is faster anyway. Add one once there is real
-- content, sized to the row count:
--   CREATE INDEX resource_chunks_embedding_idx ON public.resource_chunks
--     USING hnsw (embedding vector_cosine_ops);

/**
 * Hybrid retrieval. Pass an embedding for semantic search, or just text for full-text — the latter means
 * the store is usable the moment content lands, without waiting on an embedding pass.
 */
CREATE OR REPLACE FUNCTION public.match_resource_chunks(
  p_query_embedding vector(768) DEFAULT NULL,
  p_query_text      text        DEFAULT NULL,
  p_subject         text        DEFAULT NULL,
  p_book            text        DEFAULT NULL,
  p_match_count     integer     DEFAULT 6
)
RETURNS TABLE (
  id uuid, book text, subject text, chapter text, section text, heading text,
  content text, source_url text, license_note text, score double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.book, c.subject, c.chapter, c.section, c.heading,
         c.content, c.source_url, c.license_note,
         CASE
           WHEN p_query_embedding IS NOT NULL THEN 1 - (c.embedding <=> p_query_embedding)
           WHEN p_query_text IS NOT NULL
             THEN ts_rank(to_tsvector('english', c.content), websearch_to_tsquery('english', p_query_text))::double precision
           ELSE 0
         END AS score
  FROM resource_chunks c
  WHERE (p_subject IS NULL OR c.subject = p_subject)
    AND (p_book IS NULL OR c.book = p_book)
    AND (p_query_embedding IS NULL OR c.embedding IS NOT NULL)
    AND (p_query_text IS NULL OR p_query_embedding IS NOT NULL
         OR to_tsvector('english', c.content) @@ websearch_to_tsquery('english', p_query_text))
  ORDER BY
    CASE WHEN p_query_embedding IS NOT NULL THEN c.embedding <=> p_query_embedding END ASC NULLS LAST,
    CASE WHEN p_query_embedding IS NULL AND p_query_text IS NOT NULL
      THEN ts_rank(to_tsvector('english', c.content), websearch_to_tsquery('english', p_query_text)) END DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_match_count, 1), 24);
$function$;
