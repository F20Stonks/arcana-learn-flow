-- Two things a document library needs once real books are in it.
--
-- 1. PACKS. A problem booklet and its solutions are two files but one resource — and the pairing is the
--    whole point: "check my working against the solutions" is impossible if the two are unrelated rows a
--    student has to find separately. Modelled as parent + role rather than a packs table, because there
--    is always one document you actually read and the others hang off it. Deleting the parent takes the
--    companions with it, which is what "one resource" means.
--
-- 2. BOOK-SHAPED TRACKS. A subtopic can now point at a page range in a document. That is what makes
--    "where am I in this book" and "where am I in this course" the same question instead of two
--    unrelated progress bars — and it means a session can open at the pages it is teaching.

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.resources(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'primary'
    CHECK (role IN ('primary','solutions','mark_scheme','appendix','companion'));

-- A companion must name a parent, and a parent must not name itself.
ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_pack_shape;
ALTER TABLE public.resources ADD CONSTRAINT resources_pack_shape
  CHECK ((role = 'primary' AND parent_id IS NULL) OR (role <> 'primary' AND parent_id IS NOT NULL));

-- Deliberately NOT enforcing one-level nesting in a constraint (it would need a subquery). The UI only
-- ever attaches companions to primaries, and a chain would still render — just oddly.
CREATE INDEX IF NOT EXISTS resources_parent_idx ON public.resources (parent_id) WHERE parent_id IS NOT NULL;

-- Page ranges on subtopics. NULL everywhere for tracks that did not come from a book, which is all of
-- them today — so every existing query is unaffected.
ALTER TABLE public.subtopics
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS page_start integer,
  ADD COLUMN IF NOT EXISTS page_end integer;

CREATE INDEX IF NOT EXISTS subtopics_resource_idx ON public.subtopics (resource_id) WHERE resource_id IS NOT NULL;

/**
 * How far through a book-derived track the reader has actually got.
 *
 * Reading position and course progress are the same fact viewed two ways, so this derives one from the
 * other rather than storing a second copy that can drift: a subtopic whose pages sit behind the furthest
 * page reached has been read, whether or not the student ever pressed a button.
 *
 * SECURITY DEFINER with an explicit ownership check — same shape as match_track_resource_chunks.
 */
CREATE OR REPLACE FUNCTION public.book_track_progress(p_track_id uuid, p_user_id uuid)
RETURNS TABLE (
  subtopic_id uuid, title text, page_start integer, page_end integer,
  completed boolean, pages_read boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM learning_tracks t WHERE t.id = p_track_id AND t.user_id = p_user_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id, s.title, s.page_start, s.page_end,
         (s.status = 'complete') AS completed,
         COALESCE(rp.furthest_page >= s.page_end, false) AS pages_read
  FROM subtopics s
  JOIN topics tp ON tp.id = s.topic_id
  LEFT JOIN resource_progress rp
    ON rp.resource_id = s.resource_id AND rp.user_id = p_user_id
  WHERE tp.track_id = p_track_id
    AND tp.archived_at IS NULL
    AND s.page_start IS NOT NULL
  ORDER BY s.page_start;
END;
$function$;
