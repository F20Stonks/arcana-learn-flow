-- 1) Server-side scoring RPC for drill runs
CREATE OR REPLACE FUNCTION public.record_drill_run(
  p_drill_key text,
  p_mode text,
  p_config jsonb,
  p_attempts jsonb,
  p_duration_s integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_seen integer;
  v_correct integer;
  v_incorrect integer;
  v_duration integer;
  v_score numeric;
  v_xp integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_drill_key IS NULL OR length(p_drill_key) = 0 OR length(p_drill_key) > 80 THEN
    RAISE EXCEPTION 'invalid drill_key' USING ERRCODE = '22023';
  END IF;
  IF p_mode IS NULL OR length(p_mode) = 0 OR length(p_mode) > 40 THEN
    RAISE EXCEPTION 'invalid mode' USING ERRCODE = '22023';
  END IF;
  IF p_attempts IS NULL OR jsonb_typeof(p_attempts) <> 'array' THEN
    RAISE EXCEPTION 'invalid attempts' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_attempts) > 2000 THEN
    RAISE EXCEPTION 'too many attempts' USING ERRCODE = '22023';
  END IF;

  v_duration := LEAST(GREATEST(COALESCE(p_duration_s, 0), 0), 86400);

  SELECT count(*)::int,
         count(*) FILTER (WHERE COALESCE((a->>'correct')::boolean, false))::int
    INTO v_seen, v_correct
  FROM jsonb_array_elements(p_attempts) a;

  v_incorrect := v_seen - v_correct;
  v_score := round((CASE WHEN v_duration > 0 THEN v_correct / (v_duration / 60.0) ELSE v_correct END)::numeric, 1);
  v_xp := GREATEST(0, v_correct * 2 - LEAST(v_incorrect, v_correct));

  INSERT INTO public.drill_sessions (
    user_id, drill_key, mode, config, problems_seen, problems_correct, score, duration_s, xp_earned
  ) VALUES (
    v_uid, p_drill_key, p_mode, COALESCE(p_config, '{}'::jsonb), v_seen, v_correct, v_score, v_duration, v_xp
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.drill_attempts (session_id, user_id, drill_key, problem_tag, correct, latency_ms)
  SELECT v_session_id, v_uid, p_drill_key,
         left(COALESCE(a->>'tag', 'unknown'), 120),
         COALESCE((a->>'correct')::boolean, false),
         LEAST(GREATEST(COALESCE((a->>'latencyMs')::numeric, 0), 0), 3600000)::int
  FROM jsonb_array_elements(p_attempts) a;

  IF v_xp > 0 THEN
    UPDATE public.profiles SET total_xp = COALESCE(total_xp, 0) + v_xp WHERE user_id = v_uid;
  END IF;

  RETURN json_build_object(
    'sessionId', v_session_id,
    'correctCount', v_correct,
    'incorrectCount', v_incorrect,
    'score', v_score,
    'xpEarned', v_xp
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_drill_run(text, text, jsonb, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_drill_run(text, text, jsonb, jsonb, integer) TO authenticated;

-- 2) Stop clients writing scores directly
DROP POLICY IF EXISTS "Users can insert own drill sessions" ON public.drill_sessions;
DROP POLICY IF EXISTS "Users can insert own drill attempts" ON public.drill_attempts;
REVOKE INSERT, UPDATE, DELETE ON public.drill_sessions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.drill_attempts FROM authenticated, anon;

-- 3) XP is server-owned
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.waitlist_status := OLD.waitlist_status;
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.total_xp := OLD.total_xp;
  END IF;
  RETURN NEW;
END;
$$;