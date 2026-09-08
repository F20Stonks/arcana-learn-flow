-- All-time board, computed from each player's synced progress blob.
CREATE OR REPLACE FUNCTION public.integral_alltime_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, xp integer, solved integer, longest_streak integer, rank bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT ip.user_id,
           COALESCE((ip.progress->>'xp')::int, 0) AS xp,
           COALESCE((SELECT count(*) FROM jsonb_object_keys(COALESCE(ip.progress->'solves', '{}'::jsonb))), 0)::int AS solved,
           COALESCE((ip.progress->'streak'->>'longest')::int, 0) AS longest_streak
    FROM public.integral_progress ip
  ), ranked AS (
    SELECT b.*, row_number() OVER (ORDER BY b.xp DESC, b.solved DESC, b.user_id) AS rank
    FROM base b
    WHERE b.xp > 0 OR b.solved > 0
  )
  SELECT r.user_id,
         COALESCE(NULLIF(btrim(p.display_name), ''), 'Anonymous'),
         p.avatar_url,
         r.xp, r.solved, r.longest_streak, r.rank
  FROM ranked r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  ORDER BY r.rank
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;

-- Season board for a calendar month, e.g. '2026-09'.
CREATE OR REPLACE FUNCTION public.integral_season_leaderboard(p_season text, p_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, points integer, solves integer, daily_score integer, rank bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_solves AS (
    SELECT ip.user_id,
           COALESCE(SUM((d.value)::int), 0)::int AS solves
    FROM public.integral_progress ip
    LEFT JOIN LATERAL jsonb_each_text(COALESCE(ip.progress->'solveDays', '{}'::jsonb)) AS d(key, value)
      ON d.key LIKE p_season || '%'
    GROUP BY ip.user_id
  ), month_daily AS (
    SELECT r.user_id, COALESCE(SUM(r.score), 0)::int AS daily_score
    FROM public.integral_daily_results r
    WHERE to_char(r.created_at, 'YYYY-MM') = p_season
    GROUP BY r.user_id
  ), combined AS (
    SELECT COALESCE(s.user_id, d.user_id) AS user_id,
           COALESCE(s.solves, 0) AS solves,
           COALESCE(d.daily_score, 0) AS daily_score,
           (COALESCE(s.solves, 0) * 10 + COALESCE(d.daily_score, 0)) AS points
    FROM month_solves s
    FULL OUTER JOIN month_daily d ON d.user_id = s.user_id
  ), ranked AS (
    SELECT c.*, row_number() OVER (ORDER BY c.points DESC, c.solves DESC, c.user_id) AS rank
    FROM combined c
    WHERE c.points > 0
  )
  SELECT r.user_id,
         COALESCE(NULLIF(btrim(p.display_name), ''), 'Anonymous'),
         p.avatar_url,
         r.points, r.solves, r.daily_score, r.rank
  FROM ranked r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  ORDER BY r.rank
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;

-- Your own standing, so a player outside the top of a board still sees where they are.
CREATE OR REPLACE FUNCTION public.integral_my_standing(p_season text)
RETURNS TABLE(alltime_rank bigint, alltime_xp integer, alltime_solved integer, alltime_players bigint,
              season_rank bigint, season_points integer, season_players bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH a AS (SELECT * FROM public.integral_alltime_leaderboard(200)),
       s AS (SELECT * FROM public.integral_season_leaderboard(p_season, 200))
  SELECT (SELECT rank FROM a WHERE a.user_id = auth.uid()),
         (SELECT xp FROM a WHERE a.user_id = auth.uid()),
         (SELECT solved FROM a WHERE a.user_id = auth.uid()),
         (SELECT count(*) FROM a),
         (SELECT rank FROM s WHERE s.user_id = auth.uid()),
         (SELECT points FROM s WHERE s.user_id = auth.uid()),
         (SELECT count(*) FROM s);
$$;

REVOKE EXECUTE ON FUNCTION public.integral_alltime_leaderboard(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.integral_season_leaderboard(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.integral_my_standing(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.integral_alltime_leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.integral_season_leaderboard(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.integral_my_standing(text) TO authenticated;