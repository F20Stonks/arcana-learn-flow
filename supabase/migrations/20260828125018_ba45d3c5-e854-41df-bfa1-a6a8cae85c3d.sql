-- Integral Arena: all-time board across every daily played.
CREATE OR REPLACE VIEW public.integral_arena_leaderboard AS
SELECT
  r.user_id,
  COALESCE(NULLIF(TRIM(p.display_name), ''), 'Anonymous') AS display_name,
  p.avatar_url,
  SUM(r.score)::integer AS total_score,
  COUNT(*)::integer AS days_played,
  COUNT(*) FILTER (WHERE r.solved)::integer AS days_solved,
  MAX(r.score)::integer AS best_score,
  ROUND(AVG(r.seconds) FILTER (WHERE r.solved))::integer AS avg_seconds,
  RANK() OVER (ORDER BY SUM(r.score) DESC, COUNT(*) FILTER (WHERE r.solved) DESC, MIN(r.created_at) ASC) AS rank
FROM public.integral_daily_results r
LEFT JOIN public.profiles p ON p.user_id = r.user_id
GROUP BY r.user_id, p.display_name, p.avatar_url;

REVOKE ALL ON public.integral_arena_leaderboard FROM anon;
GRANT SELECT ON public.integral_arena_leaderboard TO authenticated;

-- Drills: best run per player, per game and mode.
CREATE OR REPLACE VIEW public.drill_leaderboard AS
WITH agg AS (
  SELECT
    s.user_id,
    s.drill_key,
    s.mode,
    MAX(s.score) AS best_score,
    COUNT(*) AS runs,
    SUM(s.problems_seen) AS problems_seen,
    SUM(s.problems_correct) AS problems_correct,
    MAX(s.created_at) AS last_played
  FROM public.drill_sessions s
  GROUP BY s.user_id, s.drill_key, s.mode
)
SELECT
  a.user_id,
  a.drill_key,
  a.mode,
  COALESCE(NULLIF(TRIM(p.display_name), ''), 'Anonymous') AS display_name,
  p.avatar_url,
  a.best_score::numeric AS best_score,
  a.runs::integer AS runs,
  a.problems_seen::integer AS problems_seen,
  a.problems_correct::integer AS problems_correct,
  CASE WHEN a.problems_seen > 0
    THEN ROUND(100.0 * a.problems_correct / a.problems_seen)::integer
    ELSE 0 END AS accuracy,
  a.last_played,
  RANK() OVER (PARTITION BY a.drill_key, a.mode ORDER BY a.best_score DESC, a.problems_correct DESC) AS rank
FROM agg a
LEFT JOIN public.profiles p ON p.user_id = a.user_id;

REVOKE ALL ON public.drill_leaderboard FROM anon;
GRANT SELECT ON public.drill_leaderboard TO authenticated;

-- Drills: overall board across every game.
CREATE OR REPLACE VIEW public.drill_leaderboard_overall AS
WITH agg AS (
  SELECT
    s.user_id,
    SUM(s.xp_earned) AS xp,
    COUNT(*) AS runs,
    COUNT(DISTINCT s.drill_key) AS games_played,
    SUM(s.problems_seen) AS problems_seen,
    SUM(s.problems_correct) AS problems_correct,
    MAX(s.created_at) AS last_played
  FROM public.drill_sessions s
  GROUP BY s.user_id
)
SELECT
  a.user_id,
  COALESCE(NULLIF(TRIM(p.display_name), ''), 'Anonymous') AS display_name,
  p.avatar_url,
  a.xp::integer AS xp,
  a.runs::integer AS runs,
  a.games_played::integer AS games_played,
  a.problems_seen::integer AS problems_seen,
  a.problems_correct::integer AS problems_correct,
  CASE WHEN a.problems_seen > 0
    THEN ROUND(100.0 * a.problems_correct / a.problems_seen)::integer
    ELSE 0 END AS accuracy,
  a.last_played,
  RANK() OVER (ORDER BY a.xp DESC, a.problems_correct DESC, a.last_played ASC) AS rank
FROM agg a
LEFT JOIN public.profiles p ON p.user_id = a.user_id;

REVOKE ALL ON public.drill_leaderboard_overall FROM anon;
GRANT SELECT ON public.drill_leaderboard_overall TO authenticated;