-- Backs the reference-questions edge function, which now mediates ALL reads of reference_questions
-- (the client no longer queries the table directly — see src/pages/QuestionBank.tsx). Two goals: (1)
-- stop shipping the whole corpus to the browser just to compute filter-chip counts, (2) make bulk
-- scraping through an authenticated account rate-limited and loggable instead of an unlimited RLS read.

-- Per-user request log. Service-role only (the edge function's client) — not exposed to
-- authenticated/anon, so a user can't read or tamper with their own rate-limit history.
CREATE TABLE public.reference_question_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight INTEGER NOT NULL DEFAULT 1, -- list/facets = 1, detail (full question_text) = 5, see the function
  blocked BOOLEAN NOT NULL DEFAULT false -- true = this request was rejected, not counted toward future windows
);
ALTER TABLE public.reference_question_requests ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies for authenticated/anon — only the service role (bypasses RLS) touches this.

CREATE INDEX idx_refq_requests_user_time ON public.reference_question_requests(user_id, requested_at);
CREATE INDEX idx_refq_requests_user_blocked_time ON public.reference_question_requests(user_id, blocked, requested_at);

-- Server-side facet aggregation for the question bank's filter chips (competition/area/year/tag counts)
-- via GROUP BY, so the aggregate counts leave the database instead of the raw rows needed to compute
-- them client-side. WITH ORDINALITY is used instead of array slicing (topic_tags[2:n]) to avoid a
-- Postgres edge case where array_length() is NULL for a 0- or 1-element array.
CREATE OR REPLACE FUNCTION public.reference_question_facets(p_competition TEXT DEFAULT NULL, p_area TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'competitions', (
      SELECT COALESCE(json_agg(json_build_array(source_competition, cnt)), '[]'::json)
      FROM (
        SELECT source_competition, count(*) AS cnt
        FROM reference_questions
        WHERE subject = 'Mathematics'
        GROUP BY source_competition
        ORDER BY cnt DESC
      ) c
    ),
    'areas', (
      SELECT COALESCE(json_agg(json_build_array(area, cnt)), '[]'::json)
      FROM (
        SELECT COALESCE(topic_tags[1], 'Other') AS area, count(*) AS cnt
        FROM reference_questions
        WHERE subject = 'Mathematics'
          AND (p_competition IS NULL OR source_competition = p_competition)
        GROUP BY area
        ORDER BY cnt DESC
      ) a
    ),
    'years', (
      SELECT COALESCE(json_agg(DISTINCT year ORDER BY year DESC), '[]'::json)
      FROM reference_questions
      WHERE subject = 'Mathematics' AND year IS NOT NULL
        AND (p_competition IS NULL OR source_competition = p_competition)
    ),
    'tagsInArea', (
      SELECT COALESCE(json_agg(json_build_array(tag, cnt)), '[]'::json)
      FROM (
        SELECT t.tag, count(*) AS cnt
        FROM reference_questions rq
        CROSS JOIN LATERAL unnest(rq.topic_tags) WITH ORDINALITY AS t(tag, ord)
        WHERE rq.subject = 'Mathematics'
          AND p_area IS NOT NULL
          AND COALESCE(rq.topic_tags[1], 'Other') = p_area
          AND (p_competition IS NULL OR rq.source_competition = p_competition)
          AND t.ord > 1
        GROUP BY t.tag
        ORDER BY cnt DESC, t.tag ASC
      ) g
    )
  );
$$;
REVOKE ALL ON FUNCTION public.reference_question_facets(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reference_question_facets(TEXT, TEXT) TO service_role;

-- Server-side filtered, paginated list — same reasoning as the facets function: the client sends
-- filters, gets back one page of summary rows (never question_text) plus a total match count via a
-- window function, instead of fetching everything and filtering/paginating in the browser.
CREATE OR REPLACE FUNCTION public.reference_question_list(
  p_competition TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_year INTEGER DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_cursor INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  source_competition TEXT,
  year INTEGER,
  question_number TEXT,
  topic_tags TEXT[],
  has_diagram BOOLEAN,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT rq.id, rq.source_competition, rq.year, rq.question_number, rq.topic_tags, rq.has_diagram,
         count(*) OVER() AS total_count
  FROM reference_questions rq
  WHERE rq.subject = 'Mathematics'
    AND (p_competition IS NULL OR rq.source_competition = p_competition)
    AND (p_area IS NULL OR COALESCE(rq.topic_tags[1], 'Other') = p_area)
    AND (p_tag IS NULL OR EXISTS (
      SELECT 1 FROM unnest(rq.topic_tags) WITH ORDINALITY AS t(tag, ord)
      WHERE t.ord > 1 AND t.tag = p_tag
    ))
    AND (p_year IS NULL OR rq.year = p_year)
    AND (p_search IS NULL OR p_search = '' OR EXISTS (
      SELECT 1 FROM unnest(rq.topic_tags) AS tag WHERE tag ILIKE '%' || p_search || '%'
    ))
  ORDER BY rq.year DESC NULLS LAST, rq.source_competition ASC, rq.question_number ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_cursor, 0);
$$;
REVOKE ALL ON FUNCTION public.reference_question_list(TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reference_question_list(TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER) TO service_role;
