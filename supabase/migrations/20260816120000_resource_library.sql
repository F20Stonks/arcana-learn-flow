-- Documents you can actually open: books, problem sets, notes — global or private.
--
-- WHY A NEW TABLE AND NOT reference_questions: the Resource Bank page reads reference_questions, which
-- is a QUESTION table — one row per question, keyed on competition/year/number. A book is not a question,
-- and forcing one into that shape is why the page's "PDF" button reads a column that is null on all 2,037
-- rows. Documents get their own table.
--
-- WHY visibility IS A COLUMN AND NOT TWO TABLES: the licence review is deferred, not skipped. Access is
-- currently restricted to the owner and a handful of test accounts, and the intent is to audit what may be
-- shared before the app moves from waitlist to allowlist. Keeping global and private in one table with a
-- visibility flag means that audit is an UPDATE over a filtered set, not a migration between tables.
-- license_status exists for exactly that pass: every row lands 'unreviewed' and the review flips it.
--
-- WHY ADMIN GATES GLOBAL WRITES: while the tester set is the owner plus friends, "anyone can publish
-- globally" is indistinguishable from "the owner publishes globally". The moment the allowlist opens it
-- stops being indistinguishable, and a resource bank that any signed-up account can write into is both a
-- copyright liability and an abuse vector. Gating it now costs one table and one function; retrofitting it
-- after strangers have write access costs a cleanup.

-- ---------------------------------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Readable so the UI can show or hide admin affordances. Deliberately NO insert/update/delete policy:
-- roles are granted by SQL or service role only, never by a client. A self-service admin grant would
-- defeat the point of the gate.
DROP POLICY IF EXISTS "own roles readable" ON public.user_roles;
CREATE POLICY "own roles readable" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- SECURITY DEFINER so policies on other tables can call it without those tables' readers needing select
-- on user_roles, and so the call can't recurse back through RLS.
CREATE OR REPLACE FUNCTION public.is_admin(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'admin');
$function$;

-- ---------------------------------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------------------------------

-- PRIVATE, like every other bucket in this project actually is. Note that
-- 20260809140000_spec_documents.sql declares spec-documents as public:true, but the live bucket is
-- private — the INSERT ... ON CONFLICT DO NOTHING no-opped against a bucket that already existed. So
-- reads go through createSignedUrl everywhere; getPublicUrl silently yields a URL that 404s.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-resources', 'user-resources', false, 104857600,
        ARRAY['application/pdf','image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Ownership is the first path segment: "<user_id>/<uuid>.pdf". storage.foldername() splits the path, so
-- [1] is that segment. This is what keeps one user's uploads out of another's, independent of whatever
-- the resources row claims.
DROP POLICY IF EXISTS "own resource files readable" ON storage.objects;
CREATE POLICY "own resource files readable" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user-resources' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "own resource files writable" ON storage.objects;
CREATE POLICY "own resource files writable" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-resources' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "own resource files deletable" ON storage.objects;
CREATE POLICY "own resource files deletable" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-resources' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Global documents live in reference-papers, which has no authenticated read policy of its own (it was
-- only ever read by service-role ingest). Signed URLs are minted server-side for those; this policy lets
-- a signed-in reader fetch one directly, which is what the viewer does for global rows.
DROP POLICY IF EXISTS "reference papers readable by members" ON storage.objects;
CREATE POLICY "reference papers readable by members" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'reference-papers');

-- ---------------------------------------------------------------------------------------------------
-- Resources
-- ---------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.resources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  author          text,
  kind            text NOT NULL DEFAULT 'book'
                    CHECK (kind IN ('book','past_paper','mark_scheme','notes','handout','problem_set','other')),
  subject         text,
  level           text,
  description     text,

  visibility      text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','global')),
  owner_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  storage_bucket  text NOT NULL DEFAULT 'user-resources',
  storage_path    text NOT NULL,
  content_type    text NOT NULL DEFAULT 'application/pdf',
  byte_size       bigint,
  page_count      integer,

  -- Provenance for the deferred licence audit. source_id points at the registry that already encodes
  -- mirror_allowed per source; license_status is the human verdict on THIS row.
  source_id       uuid REFERENCES public.resource_sources(id) ON DELETE SET NULL,
  license_note    text,
  license_status  text NOT NULL DEFAULT 'unreviewed'
                    CHECK (license_status IN ('unreviewed','cleared','restricted')),

  -- Whether the text layer has been chunked into resource_chunks for grounded AI answers. A scanned PDF
  -- has no text to extract and lands 'no_text_layer' — the viewer still opens it, the AI just can't quote
  -- it without an OCR pass.
  text_status     text NOT NULL DEFAULT 'pending'
                    CHECK (text_status IN ('pending','indexed','no_text_layer','failed')),
  chunk_count     integer NOT NULL DEFAULT 0,

  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- A private row with no owner would be visible to nobody and deletable by nobody.
  CONSTRAINT resources_private_needs_owner CHECK (visibility <> 'private' OR owner_id IS NOT NULL)
);

-- One row per stored file: re-running an import must not fork a document into duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS resources_storage_idx
  ON public.resources (storage_bucket, storage_path);
CREATE INDEX IF NOT EXISTS resources_visibility_idx ON public.resources (visibility, subject);
CREATE INDEX IF NOT EXISTS resources_owner_idx ON public.resources (owner_id);
CREATE INDEX IF NOT EXISTS resources_search_idx
  ON public.resources USING gin (to_tsvector('english', title || ' ' || COALESCE(author,'') || ' ' || COALESCE(description,'')));

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resources readable" ON public.resources;
CREATE POLICY "resources readable" ON public.resources
  FOR SELECT TO authenticated
  USING (visibility = 'global' OR owner_id = auth.uid());

-- A user may create their OWN private documents. Publishing to the global bank is admin-only.
DROP POLICY IF EXISTS "resources insertable" ON public.resources;
CREATE POLICY "resources insertable" ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (visibility = 'private' AND owner_id = auth.uid())
      OR (visibility = 'global' AND public.is_admin())
    )
  );

-- USING picks which rows may be touched; WITH CHECK re-validates the row AFTER the edit, which is what
-- stops a user flipping their own private upload to global.
DROP POLICY IF EXISTS "resources updatable" ON public.resources;
CREATE POLICY "resources updatable" ON public.resources
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (
    (visibility = 'private' AND owner_id = auth.uid())
    OR (visibility = 'global' AND public.is_admin())
  );

DROP POLICY IF EXISTS "resources deletable" ON public.resources;
CREATE POLICY "resources deletable" ON public.resources
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------------------------------
-- Reading state
-- ---------------------------------------------------------------------------------------------------

-- "Where am I in this book" — the thing that makes a 600-page PDF resumable instead of a scroll bar you
-- re-find every session. furthest_page is tracked separately from last_page so flicking back to check a
-- definition doesn't destroy the progress reading.
CREATE TABLE IF NOT EXISTS public.resource_progress (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id   uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  last_page     integer NOT NULL DEFAULT 1 CHECK (last_page >= 1),
  furthest_page integer NOT NULL DEFAULT 1 CHECK (furthest_page >= 1),
  opened_count  integer NOT NULL DEFAULT 1,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

ALTER TABLE public.resource_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own progress" ON public.resource_progress;
CREATE POLICY "own progress" ON public.resource_progress
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Bookmarks double as the anchor for "help me with this bit": a saved page plus the selected text is
-- exactly the context an AI answer needs, so the note and the quote live together rather than the quote
-- being re-derived at ask time.
CREATE TABLE IF NOT EXISTS public.resource_bookmarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  page        integer NOT NULL CHECK (page >= 1),
  label       text,
  quote       text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resource_bookmarks_lookup_idx
  ON public.resource_bookmarks (user_id, resource_id, page);

ALTER TABLE public.resource_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own bookmarks" ON public.resource_bookmarks;
CREATE POLICY "own bookmarks" ON public.resource_bookmarks
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------------
-- Wire the RAG store to documents
-- ---------------------------------------------------------------------------------------------------

-- resource_chunks was built content-agnostic and has never held a row. Linking it to resources gives
-- retrieval two things it can't otherwise have: the ability to scope an answer to the document open on
-- screen, and an owner to check — without owner_id, chunks from one user's private upload would be
-- retrievable by every other user, since the table is read by service-role edge functions that bypass RLS.
ALTER TABLE public.resource_chunks
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.resources(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS page        integer;

CREATE INDEX IF NOT EXISTS resource_chunks_resource_idx ON public.resource_chunks (resource_id);
-- Partial index: the common retrieval is "global chunks, plus mine", and global chunks have no owner.
CREATE INDEX IF NOT EXISTS resource_chunks_owner_idx ON public.resource_chunks (owner_id)
  WHERE owner_id IS NOT NULL;

-- The dedupe key must include the document. Two different books legitimately contain the same sentence
-- ("Let f be continuous on [a,b]."), and the old key would have silently dropped the second one.
DROP INDEX IF EXISTS public.resource_chunks_dedupe_idx;
CREATE UNIQUE INDEX IF NOT EXISTS resource_chunks_dedupe_idx
  ON public.resource_chunks (COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::uuid),
                             book, COALESCE(section, ''), md5(content));

-- DROP, not CREATE OR REPLACE. Postgres keys functions on their argument list, so adding parameters
-- would create an OVERLOAD alongside the 5-arg original. Every argument on both has a default, which
-- makes any call with fewer than 6 arguments ambiguous and a hard error at call time rather than a
-- silently-wrong result. The old signature has to go.
DROP FUNCTION IF EXISTS public.match_resource_chunks(vector, text, text, text, integer);

/**
 * Hybrid retrieval, now document- and owner-aware.
 *
 * p_owner_id is the CALLER's id, not a filter on someone else's content: a row is returned when it is
 * global (owner_id IS NULL) or owned by the caller. Passing NULL therefore searches global content only,
 * which is the correct default for an unauthenticated or system caller.
 */
CREATE OR REPLACE FUNCTION public.match_resource_chunks(
  p_query_embedding vector(768) DEFAULT NULL,
  p_query_text      text        DEFAULT NULL,
  p_subject         text        DEFAULT NULL,
  p_book            text        DEFAULT NULL,
  p_match_count     integer     DEFAULT 6,
  p_resource_id     uuid        DEFAULT NULL,
  p_owner_id        uuid        DEFAULT NULL
)
RETURNS TABLE (
  id uuid, book text, subject text, chapter text, section text, heading text,
  content text, source_url text, license_note text, resource_id uuid, page integer, score double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.book, c.subject, c.chapter, c.section, c.heading,
         c.content, c.source_url, c.license_note, c.resource_id, c.page,
         CASE
           WHEN p_query_embedding IS NOT NULL THEN 1 - (c.embedding <=> p_query_embedding)
           WHEN p_query_text IS NOT NULL
             THEN ts_rank(to_tsvector('english', c.content), websearch_to_tsquery('english', p_query_text))::double precision
           ELSE 0
         END AS score
  FROM resource_chunks c
  WHERE (c.owner_id IS NULL OR c.owner_id = p_owner_id)
    AND (p_resource_id IS NULL OR c.resource_id = p_resource_id)
    AND (p_subject IS NULL OR c.subject = p_subject)
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
