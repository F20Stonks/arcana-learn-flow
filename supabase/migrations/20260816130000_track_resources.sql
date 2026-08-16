-- Attach a document to a learning track, so the tutor teaches FROM the student's own book.
--
-- WHY THIS EXISTS SEPARATELY FROM THE LIBRARY: a library you browse is a filing cabinet. The thing that
-- makes an uploaded textbook worth uploading is that a session on "uniform continuity" quotes the actual
-- definition from the actual book the student is being examined on, in that book's notation. Without this
-- link the tutor has no way to know which of a student's documents is relevant to the track it is
-- teaching, and retrieving across everything they ever uploaded would be worse than retrieving nothing.
--
-- NOTE THE RETRIEVAL DEPENDENCY: page-text grounding (what the reader does) needs no index, because the
-- reader already has the page open. The tutor has no page open, so this path only produces grounded
-- teaching once the document's text is in resource_chunks. A linked document whose text_status is
-- 'no_text_layer' is a scan, and will contribute nothing until an OCR pass exists — the UI says so at
-- link time rather than silently teaching ungrounded.

CREATE TABLE IF NOT EXISTS public.track_resources (
  track_id    uuid NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  -- Free-text note on WHY this book is attached, e.g. "course text, ch.1-6 only". Passed to the tutor as
  -- part of the retrieval context, so a student can steer what the book is used for.
  note        text,
  added_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, resource_id)
);

CREATE INDEX IF NOT EXISTS track_resources_resource_idx ON public.track_resources (resource_id);

ALTER TABLE public.track_resources ENABLE ROW LEVEL SECURITY;

-- The link is only visible/editable to the owner of the TRACK. The resource side is enforced separately
-- on insert: you cannot attach a document you are not allowed to read.
DROP POLICY IF EXISTS "track resources readable" ON public.track_resources;
CREATE POLICY "track resources readable" ON public.track_resources
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_tracks t WHERE t.id = track_id AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS "track resources insertable" ON public.track_resources;
CREATE POLICY "track resources insertable" ON public.track_resources
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.learning_tracks t WHERE t.id = track_id AND t.user_id = auth.uid())
    -- Re-derives the resources read rule rather than trusting the client's claim about what it linked.
    AND EXISTS (SELECT 1 FROM public.resources r
                WHERE r.id = resource_id AND (r.visibility = 'global' OR r.owner_id = auth.uid()))
  );

DROP POLICY IF EXISTS "track resources updatable" ON public.track_resources;
CREATE POLICY "track resources updatable" ON public.track_resources
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_tracks t WHERE t.id = track_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.learning_tracks t WHERE t.id = track_id AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS "track resources deletable" ON public.track_resources;
CREATE POLICY "track resources deletable" ON public.track_resources
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_tracks t WHERE t.id = track_id AND t.user_id = auth.uid()));

/**
 * Retrieval across every document attached to one track.
 *
 * SECURITY DEFINER because resource_chunks is service-role-only by design (no client policies), but the
 * caller here is a signed-in student asking about their own track. p_user_id is checked against the
 * track's owner INSIDE the function, so a caller cannot read another student's attached books by passing
 * someone else's track id — which is the whole reason this isn't just a view.
 */
CREATE OR REPLACE FUNCTION public.match_track_resource_chunks(
  p_track_id    uuid,
  p_user_id     uuid,
  p_query_text  text,
  p_match_count integer DEFAULT 6
)
RETURNS TABLE (
  book text, chapter text, section text, heading text,
  content text, page integer, license_note text, score double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM learning_tracks t WHERE t.id = p_track_id AND t.user_id = p_user_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.book, c.chapter, c.section, c.heading, c.content, c.page, c.license_note,
         ts_rank(to_tsvector('english', c.content), websearch_to_tsquery('english', p_query_text))::double precision AS score
  FROM resource_chunks c
  JOIN track_resources tr ON tr.resource_id = c.resource_id
  WHERE tr.track_id = p_track_id
    -- Defence in depth: even inside a definer function, never surface another user's private chunks.
    AND (c.owner_id IS NULL OR c.owner_id = p_user_id)
    AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', p_query_text)
  ORDER BY score DESC
  LIMIT LEAST(GREATEST(p_match_count, 1), 24);
END;
$function$;
