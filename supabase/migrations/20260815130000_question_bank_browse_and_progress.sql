-- Rebuilds question-bank browsing on top of the canonical taxonomy, and adds the completion tracking the
-- bank has never had. Companion to 20260815120000_question_taxonomy.sql — read that file's header first.
--
-- Three defects in the previous RPCs, each measured against the live corpus before this was written:
--   1. `tagsInArea` returned 195 chips for "Pure Mathematics", rendered uncapped into one row. Topics now
--      come from the taxonomy: worst case 9 chips in a strand, 3.7 on average.
--   2. `areas` was built from `topic_tags[1]`, which is the SOURCE's own vocabulary — so "Putnam" and "IMO"
--      appeared as peer "areas" alongside "Pure Mathematics", and 82 STEP questions sat in the wrong area
--      because STEP tags by the paper SECTION a question was printed in. Area now derives from the topic.
--   3. `ORDER BY question_number ASC` sorted a text column, so STEP I 2016 listed as
--      Q1, Q10, Q11, Q12, Q13, Q2, Q3… Now sorted on an (alpha prefix, numeric) key, which also handles
--      Putnam's A1–B6 numbering.

-- Both RPCs gain parameters, so CREATE OR REPLACE would register an OVERLOAD rather than replace them —
-- and then a call using named arguments matches both candidates and fails as "function is not unique".
-- The old signatures have to go first.
DROP FUNCTION IF EXISTS public.reference_question_facets(text, text);
DROP FUNCTION IF EXISTS public.reference_question_list(text, text, text, integer, text, integer, integer);

-- BACKWARDS COMPATIBILITY, deliberately kept for one release.
-- Edge functions redeploy through Lovable on a different cadence from the frontend bundle, so for a window
-- the OLD deployed `reference-questions` function calls these RPCs while the new definitions are already
-- live. Two concrete breakages were found and closed rather than left to that window:
--   * the old function calls reference_question_list with `p_tag`, so `p_tag` is retained as a trailing
--     parameter that filters on the raw source tag. One function serves both callers; overloading them
--     instead would make the two-argument facets call ambiguous.
--   * the old QuestionBank.tsx reads `facets.tagsInArea` and calls `.length` on it, so dropping that key
--     would throw a TypeError in any browser still running the old bundle. It is emitted as a deprecated
--     alias of `topics`.
-- Both can be deleted once the new bundle and the redeployed edge function are confirmed live together.

/* ───────────────────────────── classification, materialised ───────────────────────────── */

-- reference_question_classified() recomputes an unnest + join over the whole corpus on every call. That is
-- cheap at 2k rows and will not be at the tens of thousands this bank is being seeded toward, and it is hit
-- by every list AND facet request. Materialised, with indexes matching the three filter shapes.
DROP MATERIALIZED VIEW IF EXISTS public.reference_question_classification;
CREATE MATERIALIZED VIEW public.reference_question_classification AS
  SELECT question_id, area, strands, topics FROM public.reference_question_classified();

CREATE UNIQUE INDEX reference_question_classification_pk
  ON public.reference_question_classification (question_id);
CREATE INDEX reference_question_classification_area_idx
  ON public.reference_question_classification (area);
CREATE INDEX reference_question_classification_strands_idx
  ON public.reference_question_classification USING gin (strands);
CREATE INDEX reference_question_classification_topics_idx
  ON public.reference_question_classification USING gin (topics);

-- Full-text index so the search box can find "Jensen" or "projectile" in the question itself, not only in
-- the sparse tag list (218 of the old tags occurred once, so tag-only search missed almost everything).
CREATE INDEX IF NOT EXISTS reference_questions_text_fts_idx
  ON public.reference_questions USING gin (to_tsvector('english', question_text));

-- MUST be called after every ingest, or newly seeded questions browse as unclassified. The taxonomy
-- coverage check (reference_topic_coverage()) and this refresh are the two post-ingest steps.
CREATE OR REPLACE FUNCTION public.refresh_reference_question_classification()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.reference_question_classification;
$function$;

REVOKE ALL ON FUNCTION public.refresh_reference_question_classification() FROM PUBLIC, anon, authenticated;

/* ─────────────────────────────────── sort helper ─────────────────────────────────── */

-- Splits '10' -> ('',10) and 'B4' -> ('B',4) so numbering sorts the way a human reads a paper.
-- IMMUTABLE so it can be indexed if ordering ever becomes a bottleneck.
CREATE OR REPLACE FUNCTION public.reference_question_sort_key(q text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT ARRAY[
    COALESCE(regexp_replace(COALESCE(q, ''), '[0-9]', '', 'g'), ''),
    lpad(COALESCE(NULLIF(regexp_replace(COALESCE(q, ''), '[^0-9]', '', 'g'), ''), '0'), 6, '0')
  ];
$function$;

/* ──────────────────────────────────── facets ──────────────────────────────────── */

-- `p_area = 'Unclassified'` is a documented sentinel meaning "rows the taxonomy could not classify" —
-- today that is exactly the 786 Putnam/IMO index-only rows, whose only tag is the competition name. It is a
-- real, countable bucket rather than a silent omission, and disappears on its own once those rows get
-- per-problem topic tags.
CREATE OR REPLACE FUNCTION public.reference_question_facets(
  p_competition text DEFAULT NULL,
  p_area        text DEFAULT NULL,
  p_strand      text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH scoped AS (
    SELECT rq.id, rq.source_competition, rq.year, c.area, c.strands, c.topics
    FROM reference_questions rq
    LEFT JOIN reference_question_classification c ON c.question_id = rq.id
    WHERE rq.subject = 'Mathematics'
  ),
  by_comp AS (
    SELECT * FROM scoped
    WHERE p_competition IS NULL OR source_competition = p_competition
  ),
  by_area AS (
    SELECT * FROM by_comp
    WHERE p_area IS NULL
       OR (p_area = 'Unclassified' AND area IS NULL)
       OR area = p_area
  ),
  -- Only topics belonging to the selected strand, so picking a strand genuinely narrows the row instead of
  -- listing every topic the matching questions happen to touch.
  topic_rows AS (
    SELECT t.topic, count(*) AS cnt
    FROM by_area q
    CROSS JOIN LATERAL unnest(q.topics) t(topic)
    WHERE p_area IS NOT NULL AND p_area <> 'Unclassified'
      AND (p_strand IS NULL OR q.strands @> ARRAY[p_strand])
      AND (p_strand IS NULL OR EXISTS (
        SELECT 1 FROM reference_topic_aliases a
        WHERE a.topic = t.topic AND a.strand = p_strand
      ))
    GROUP BY t.topic
  )
  SELECT json_build_object(
    -- Competition counts ignore the area/strand selection so the competition row never collapses under it.
    'competitions', (
      SELECT COALESCE(json_agg(json_build_array(source_competition, cnt) ORDER BY cnt DESC), '[]'::json)
      FROM (SELECT source_competition, count(*) AS cnt FROM scoped GROUP BY source_competition) c
    ),
    'areas', (
      SELECT COALESCE(json_agg(json_build_array(area, cnt) ORDER BY cnt DESC), '[]'::json)
      FROM (
        SELECT COALESCE(area, 'Unclassified') AS area, count(*) AS cnt
        FROM by_comp GROUP BY COALESCE(area, 'Unclassified')
      ) a
    ),
    -- Strands are ordered by their curriculum position, not by count: a stable reading order matters more
    -- than putting the biggest bucket first, and it stops chips reshuffling as the corpus grows.
    'strands', (
      SELECT COALESCE(json_agg(json_build_array(strand, cnt) ORDER BY pos, strand), '[]'::json)
      FROM (
        SELECT s.strand, count(*) AS cnt, COALESCE(min(ts.position), 999) AS pos
        FROM by_area q
        CROSS JOIN LATERAL unnest(q.strands) s(strand)
        LEFT JOIN reference_topic_strands ts ON ts.strand = s.strand AND ts.area = q.area
        WHERE p_area IS NOT NULL AND p_area <> 'Unclassified'
        GROUP BY s.strand
      ) g
    ),
    'topics', (
      SELECT COALESCE(json_agg(json_build_array(topic, cnt) ORDER BY cnt DESC, topic), '[]'::json)
      FROM topic_rows
    ),
    -- Deprecated alias of `topics` — see the compatibility note at the top of this file.
    'tagsInArea', (
      SELECT COALESCE(json_agg(json_build_array(topic, cnt) ORDER BY cnt DESC, topic), '[]'::json)
      FROM topic_rows
    ),
    'years', (
      SELECT COALESCE(json_agg(DISTINCT year ORDER BY year DESC), '[]'::json)
      FROM by_area WHERE year IS NOT NULL
    )
  );
$function$;

/* ───────────────────────────────────── list ───────────────────────────────────── */

-- p_status filters on the caller's own progress: 'unseen' | 'attempted' | 'solved'. Derived from
-- user_question_attempts rather than stored on the question, and computed with count(DISTINCT question)
-- because that table is an attempt LOG (user_resource_analytics counts its rows) — a question with three
-- attempts is one question, not three.
CREATE OR REPLACE FUNCTION public.reference_question_list(
  p_competition text    DEFAULT NULL,
  p_area        text    DEFAULT NULL,
  p_strand      text    DEFAULT NULL,
  p_topic       text    DEFAULT NULL,
  p_year        integer DEFAULT NULL,
  p_search      text    DEFAULT NULL,
  p_status      text    DEFAULT NULL,
  p_user_id     uuid    DEFAULT NULL,
  p_cursor      integer DEFAULT 0,
  p_limit       integer DEFAULT 60,
  -- Trailing, deprecated: filters on the RAW source tag. Only the previously deployed edge function passes
  -- it — see the compatibility note at the top of this file.
  p_tag         text    DEFAULT NULL
)
RETURNS TABLE (
  id uuid, source_competition text, year integer, question_number text,
  topic_tags text[], has_diagram boolean, difficulty text,
  area text, strands text[], topics text[],
  index_only boolean, attempts integer, solved boolean,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH progress AS (
    SELECT reference_question_id,
           count(*)::int AS attempts,
           bool_or(is_completed) AS solved
    FROM user_question_attempts
    WHERE p_user_id IS NOT NULL AND user_id = p_user_id
    GROUP BY reference_question_id
  ),
  filtered AS (
    SELECT rq.id, rq.source_competition, rq.year, rq.question_number, rq.topic_tags, rq.has_diagram,
           rq.difficulty, c.area, c.strands, c.topics,
           -- Deliberately a CONTENT test, not a licence-note test. QuestionBank.tsx's `isIndexOnly` keyed
           -- off `license_note LIKE '%not reproduced here%'`, which was measured to be wrong in both
           -- directions: it matched 24 IMO rows whose question_text IS fully present (avg 288 chars), so
           -- those questions were hidden behind a link-out and rendered as plain grey text instead of
           -- maths; and it matched none of Putnam's 492 rows, which the page's header comment describes as
           -- index-only. Every one of the 2,037 rows currently has real text, so this correctly returns
           -- false for all of them today, while still catching a genuinely text-less future ingest.
           COALESCE(rq.question_text IS NULL
                    OR length(btrim(rq.question_text)) < 40
                    OR rq.question_text LIKE '%not reproduced%', false) AS index_only,
           COALESCE(p.attempts, 0) AS attempts,
           COALESCE(p.solved, false) AS solved
    FROM reference_questions rq
    LEFT JOIN reference_question_classification c ON c.question_id = rq.id
    LEFT JOIN progress p ON p.reference_question_id = rq.id
    WHERE rq.subject = 'Mathematics'
      AND (p_competition IS NULL OR rq.source_competition = p_competition)
      AND (p_area IS NULL
           OR (p_area = 'Unclassified' AND c.area IS NULL)
           OR c.area = p_area)
      AND (p_strand IS NULL OR c.strands @> ARRAY[p_strand])
      AND (p_topic  IS NULL OR c.topics  @> ARRAY[p_topic])
      AND (p_tag IS NULL OR EXISTS (
        SELECT 1 FROM unnest(rq.topic_tags) WITH ORDINALITY AS t(tag, ord)
        WHERE t.ord > 1 AND t.tag = p_tag
      ))
      AND (p_year IS NULL OR rq.year = p_year)
      AND (p_search IS NULL OR p_search = ''
           OR to_tsvector('english', rq.question_text) @@ websearch_to_tsquery('english', p_search)
           OR EXISTS (SELECT 1 FROM unnest(rq.topic_tags) AS tag WHERE tag ILIKE '%' || p_search || '%')
           OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.topics, '{}')) AS t WHERE t ILIKE '%' || p_search || '%'))
      AND (p_status IS NULL
           OR (p_status = 'solved'    AND COALESCE(p.solved, false))
           OR (p_status = 'attempted' AND p.reference_question_id IS NOT NULL AND NOT COALESCE(p.solved, false))
           OR (p_status = 'unseen'    AND p.reference_question_id IS NULL))
  )
  SELECT f.id, f.source_competition, f.year, f.question_number, f.topic_tags, f.has_diagram, f.difficulty,
         f.area, f.strands, f.topics, f.index_only, f.attempts, f.solved,
         count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.year DESC NULLS LAST, f.source_competition ASC,
           reference_question_sort_key(f.question_number) ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_cursor, 0);
$function$;

/* ─────────────────────────────────── progress ─────────────────────────────────── */

-- Answers "how much of the bank have I done", overall and broken down both ways the UI groups it.
-- Deliberately counts DISTINCT questions, not attempt rows.
CREATE OR REPLACE FUNCTION public.reference_question_progress(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH mine AS (
    SELECT reference_question_id, bool_or(is_completed) AS solved
    FROM user_question_attempts
    WHERE user_id = p_user_id
    GROUP BY reference_question_id
  ),
  joined AS (
    SELECT rq.id, rq.source_competition, COALESCE(c.area, 'Unclassified') AS area,
           m.reference_question_id IS NOT NULL AS attempted,
           COALESCE(m.solved, false) AS solved
    FROM reference_questions rq
    LEFT JOIN reference_question_classification c ON c.question_id = rq.id
    LEFT JOIN mine m ON m.reference_question_id = rq.id
    WHERE rq.subject = 'Mathematics'
  )
  SELECT json_build_object(
    'total',     (SELECT count(*) FROM joined),
    'attempted', (SELECT count(*) FROM joined WHERE attempted),
    'solved',    (SELECT count(*) FROM joined WHERE solved),
    'byCompetition', (
      SELECT COALESCE(json_agg(json_build_object(
               'competition', source_competition, 'total', total, 'attempted', attempted, 'solved', solved
             ) ORDER BY total DESC), '[]'::json)
      FROM (
        SELECT source_competition, count(*) AS total,
               count(*) FILTER (WHERE attempted) AS attempted,
               count(*) FILTER (WHERE solved) AS solved
        FROM joined GROUP BY source_competition
      ) c
    ),
    'byArea', (
      SELECT COALESCE(json_agg(json_build_object(
               'area', area, 'total', total, 'attempted', attempted, 'solved', solved
             ) ORDER BY total DESC), '[]'::json)
      FROM (
        SELECT area, count(*) AS total,
               count(*) FILTER (WHERE attempted) AS attempted,
               count(*) FILTER (WHERE solved) AS solved
        FROM joined GROUP BY area
      ) a
    )
  );
$function$;

/* ──────────────────────────────── status writer ──────────────────────────────── */

-- Called by the `reference-questions` edge function for the caller's own row only.
--
-- `user_question_attempts` intentionally has NO unique constraint on (user_id, question) — it is an attempt
-- log and user_resource_analytics counts its rows. So marking a question solved UPDATES the most recent
-- attempt rather than inserting a duplicate every click, and only inserts when there is nothing to update.
-- SECURITY DEFINER with an explicit p_user_id that the edge function takes from the verified JWT.
CREATE OR REPLACE FUNCTION public.reference_question_set_status(
  p_user_id     uuid,
  p_question_id uuid,
  p_status      text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_latest uuid;
  v_exists boolean;
BEGIN
  IF p_status NOT IN ('unseen', 'attempted', 'solved') THEN
    RAISE EXCEPTION 'invalid status %', p_status;
  END IF;

  SELECT EXISTS (SELECT 1 FROM reference_questions WHERE id = p_question_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'unknown question %', p_question_id;
  END IF;

  SELECT id INTO v_latest
  FROM user_question_attempts
  WHERE user_id = p_user_id AND reference_question_id = p_question_id
  ORDER BY attempt_start DESC
  LIMIT 1;

  -- 'unseen' clears progress. There is no DELETE policy on the table and the attempt genuinely happened,
  -- so this un-completes the log entry rather than erasing history.
  IF p_status = 'unseen' THEN
    IF v_latest IS NOT NULL THEN
      UPDATE user_question_attempts
      SET is_completed = false, attempt_end = NULL, updated_at = now()
      WHERE id = v_latest;
    END IF;
  ELSIF v_latest IS NULL THEN
    INSERT INTO user_question_attempts (user_id, reference_question_id, is_completed, attempt_end)
    VALUES (p_user_id, p_question_id, p_status = 'solved',
            CASE WHEN p_status = 'solved' THEN now() ELSE NULL END);
  ELSE
    UPDATE user_question_attempts
    SET is_completed = (p_status = 'solved'),
        attempt_end  = CASE WHEN p_status = 'solved' THEN now() ELSE attempt_end END,
        updated_at   = now()
    WHERE id = v_latest;
  END IF;

  RETURN json_build_object('status', p_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.reference_question_set_status(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
