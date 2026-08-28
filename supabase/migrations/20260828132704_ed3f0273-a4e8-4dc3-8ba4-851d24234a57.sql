-- 1. Pin search_path on remaining functions
ALTER FUNCTION public.integral_current_puzzle_number() SET search_path = public;
ALTER FUNCTION public.integral_check_puzzle_window() SET search_path = public;

-- 2. Lock privileged profile columns on insert as well as update
REVOKE INSERT (waitlist_status, subscription_tier) ON public.profiles FROM authenticated;
REVOKE UPDATE (waitlist_status, subscription_tier) ON public.profiles FROM authenticated;
REVOKE INSERT, UPDATE ON public.profiles FROM anon;

-- 3. Leaderboards: replace SECURITY DEFINER views with security_invoker views
--    Public-safe name lookup (only display name + avatar, nothing else)
CREATE OR REPLACE FUNCTION public.leaderboard_profile(p_user_id uuid)
RETURNS TABLE(display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(p.display_name), ''), 'Anonymous'), p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = p_user_id
$$;
REVOKE ALL ON FUNCTION public.leaderboard_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard_profile(uuid) TO authenticated;

-- score rows are competitive data, readable by signed-in players
CREATE POLICY "Leaderboard reads of integral results"
  ON public.integral_daily_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leaderboard reads of drill sessions"
  ON public.drill_sessions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE VIEW public.integral_arena_leaderboard
WITH (security_invoker = true) AS
SELECT r.user_id,
       COALESCE(lp.display_name, 'Anonymous') AS display_name,
       lp.avatar_url,
       (sum(r.score))::integer AS total_score,
       (count(*))::integer AS days_played,
       (count(*) FILTER (WHERE r.solved))::integer AS days_solved,
       max(r.score) AS best_score,
       (round(avg(r.seconds) FILTER (WHERE r.solved)))::integer AS avg_seconds,
       rank() OVER (ORDER BY (sum(r.score)) DESC, (count(*) FILTER (WHERE r.solved)) DESC, (min(r.created_at))) AS rank
FROM public.integral_daily_results r
LEFT JOIN LATERAL public.leaderboard_profile(r.user_id) lp ON true
GROUP BY r.user_id, lp.display_name, lp.avatar_url;

CREATE OR REPLACE VIEW public.integral_daily_leaderboard
WITH (security_invoker = true) AS
SELECT r.puzzle_number, r.user_id,
       COALESCE(lp.display_name, 'Anonymous') AS display_name,
       lp.avatar_url, r.score, r.seconds, r.hints_used, r.wrong_attempts,
       rank() OVER (PARTITION BY r.puzzle_number ORDER BY r.score DESC, r.seconds, r.created_at) AS rank
FROM public.integral_daily_results r
LEFT JOIN LATERAL public.leaderboard_profile(r.user_id) lp ON true
WHERE r.solved;

CREATE OR REPLACE VIEW public.integral_daily_turnout
WITH (security_invoker = true) AS
SELECT puzzle_number, count(*) AS players,
       count(*) FILTER (WHERE solved) AS solvers,
       (round(avg(score) FILTER (WHERE solved)))::integer AS average_score,
       max(score) AS top_score
FROM public.integral_daily_results
GROUP BY puzzle_number;

CREATE OR REPLACE VIEW public.drill_leaderboard
WITH (security_invoker = true) AS
WITH agg AS (
  SELECT s.user_id, s.drill_key, s.mode, max(s.score) AS best_score, count(*) AS runs,
         sum(s.problems_seen) AS problems_seen, sum(s.problems_correct) AS problems_correct,
         max(s.created_at) AS last_played
  FROM public.drill_sessions s
  GROUP BY s.user_id, s.drill_key, s.mode
)
SELECT a.user_id, a.drill_key, a.mode,
       COALESCE(lp.display_name, 'Anonymous') AS display_name,
       lp.avatar_url, a.best_score,
       (a.runs)::integer AS runs,
       (a.problems_seen)::integer AS problems_seen,
       (a.problems_correct)::integer AS problems_correct,
       CASE WHEN a.problems_seen > 0 THEN (round((100.0 * a.problems_correct::numeric) / a.problems_seen::numeric))::integer ELSE 0 END AS accuracy,
       a.last_played,
       rank() OVER (PARTITION BY a.drill_key, a.mode ORDER BY a.best_score DESC, a.problems_correct DESC) AS rank
FROM agg a
LEFT JOIN LATERAL public.leaderboard_profile(a.user_id) lp ON true;

CREATE OR REPLACE VIEW public.drill_leaderboard_overall
WITH (security_invoker = true) AS
WITH agg AS (
  SELECT s.user_id, sum(s.xp_earned) AS xp, count(*) AS runs,
         count(DISTINCT s.drill_key) AS games_played,
         sum(s.problems_seen) AS problems_seen, sum(s.problems_correct) AS problems_correct,
         max(s.created_at) AS last_played
  FROM public.drill_sessions s
  GROUP BY s.user_id
)
SELECT a.user_id,
       COALESCE(lp.display_name, 'Anonymous') AS display_name,
       lp.avatar_url,
       (a.xp)::integer AS xp,
       (a.runs)::integer AS runs,
       (a.games_played)::integer AS games_played,
       (a.problems_seen)::integer AS problems_seen,
       (a.problems_correct)::integer AS problems_correct,
       CASE WHEN a.problems_seen > 0 THEN (round((100.0 * a.problems_correct::numeric) / a.problems_seen::numeric))::integer ELSE 0 END AS accuracy,
       a.last_played,
       rank() OVER (ORDER BY a.xp DESC, a.problems_correct DESC, a.last_played) AS rank
FROM agg a
LEFT JOIN LATERAL public.leaderboard_profile(a.user_id) lp ON true;

GRANT SELECT ON public.integral_arena_leaderboard, public.integral_daily_leaderboard,
  public.integral_daily_turnout, public.drill_leaderboard, public.drill_leaderboard_overall TO authenticated;