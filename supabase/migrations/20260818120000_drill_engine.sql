-- Drill Engine: shared timed-practice infrastructure for Zetamac++ and the retention-game roster
-- (Modular Rush, Factor Sprint, Sieve Race, Venn Blitz, Cayley Fill, ...). One pair of tables for
-- every drill rather than one table per game — drill identity is a string key
-- (drill_sessions.drill_key), not a new relation.
--
-- Weak-spot targeting reads drill_attempts directly rather than the concepts/user_concept_knowledge
-- tracker: that tracker has zero rows in production today (assess-session's completion gate has
-- never opened — see project memory), so a feature that depended on it would be permanently empty.
-- drill_attempts starts populating from a user's very first run, so it's the only data source that
-- actually exists for this to work on day one. concept_id stays off attempts entirely for the same
-- reason; problem_tag (a drill-owned string like 'mul_2digit' or 'mod') is the real join key.

CREATE TABLE public.drill_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drill_key TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'classic',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  problems_seen INTEGER NOT NULL DEFAULT 0,
  problems_correct INTEGER NOT NULL DEFAULT 0,
  score NUMERIC NOT NULL DEFAULT 0,
  duration_s INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drill_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own drill sessions" ON public.drill_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own drill sessions" ON public.drill_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.drill_sessions FROM anon;
GRANT SELECT, INSERT ON public.drill_sessions TO authenticated;

-- One row per problem. user_id and drill_key are denormalized off drill_sessions so the weak-spot
-- query (group by user + drill + problem_tag) never needs a join on its hot path.
CREATE TABLE public.drill_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.drill_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drill_key TEXT NOT NULL,
  problem_tag TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drill_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own drill attempts" ON public.drill_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own drill attempts" ON public.drill_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.drill_attempts FROM anon;
GRANT SELECT, INSERT ON public.drill_attempts TO authenticated;

CREATE INDEX idx_drill_sessions_user ON public.drill_sessions(user_id, drill_key, created_at DESC);
CREATE INDEX idx_drill_attempts_session ON public.drill_attempts(session_id);
CREATE INDEX idx_drill_attempts_weak_spot ON public.drill_attempts(user_id, drill_key, problem_tag);

-- Live aggregation, not a maintained table (same reasoning as user_resource_analytics in
-- 20260810120000_resource_bank_analytics.sql) — no separate writer to keep in sync, and it's
-- correctly empty until a user's first drill_attempts rows land.
CREATE OR REPLACE VIEW public.drill_weak_spots WITH (security_invoker = true) AS
SELECT
  user_id,
  drill_key,
  problem_tag,
  COUNT(*) AS attempts,
  SUM(CASE WHEN correct THEN 1 ELSE 0 END) AS correct_count,
  ROUND(AVG(CASE WHEN correct THEN 1 ELSE 0 END)::numeric, 3) AS accuracy,
  ROUND(AVG(latency_ms)) AS avg_latency_ms,
  MAX(created_at) AS last_seen
FROM public.drill_attempts
GROUP BY user_id, drill_key, problem_tag;

GRANT SELECT ON public.drill_weak_spots TO authenticated;
