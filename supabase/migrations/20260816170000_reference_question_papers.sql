-- Papers as a browsable unit.
--
-- The Question Bank presented 2,037 questions as one flat list under four stacked rows of filter chips.
-- But the corpus is really ~178 PAPERS — Putnam 1985-2025, STEP I/II/III 1986-2018, IMO 1976-2025 — and
-- "STEP II 2013" is a thing a student sits, times themselves against and finishes. The UI had no concept
-- of it, so the only way to work a paper was to set two filters and trust the ordering.
--
-- A paper is (source_competition, year). There is no `paper` column and none is needed: STEP I/II/III are
-- already separate competitions, and Putnam's A/B sessions live in question_number.
--
-- SECURITY INVOKER with an explicit p_user_id, matching reference_question_progress: attempts are joined
-- per caller, and RLS on user_question_attempts is what stops one student seeing another's progress.

CREATE OR REPLACE FUNCTION public.reference_question_papers(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  competition text, year integer, question_count integer,
  solved integer, attempted integer, with_solutions integer, with_diagram integer
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT q.source_competition,
         q.year,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE a.is_completed)::int,
         COUNT(*) FILTER (WHERE a.id IS NOT NULL AND NOT a.is_completed)::int,
         COUNT(*) FILTER (WHERE q.solution_text IS NOT NULL)::int,
         COUNT(*) FILTER (WHERE q.has_diagram)::int
  FROM reference_questions q
  -- LATERAL: one attempt row per question (the best one), so a student who attempted the same question
  -- three times counts once rather than inflating the paper's totals past its question count.
  LEFT JOIN LATERAL (
    SELECT ua.id, ua.is_completed
    FROM user_question_attempts ua
    WHERE ua.reference_question_id = q.id
      AND p_user_id IS NOT NULL AND ua.user_id = p_user_id
    ORDER BY ua.is_completed DESC, ua.updated_at DESC
    LIMIT 1
  ) a ON true
  WHERE q.year IS NOT NULL
  GROUP BY q.source_competition, q.year
  ORDER BY q.source_competition, q.year DESC;
$function$;
