-- Quant OA Arena: timed replications of quant-firm online assessments (Optiver 80-in-8, the
-- Flow Traders math test, Citadel's probability screen, ...). See
-- docs/quant-assessment-arena-scope.md.
--
-- Three tables rather than the drill engine's two, because a battery is not a drill run:
--   * a battery has several sections with different scoring rules (+1/−1 on the speed test,
--     +1/0 on the sequences test that follows it), so section results cannot collapse into the
--     run row the way drill_sessions collapses a single drill;
--   * the debrief shows the item, the answer given and the expected answer, none of which
--     drill_attempts stores — it deliberately keeps only problem_tag, correct and latency_ms.
--
-- problem_tag keeps exactly the drill-engine semantics on purpose, so the existing weak-spot
-- aggregation pattern transfers unchanged.
--
-- spec_version is denormalised onto the run because these formats drift between recruiting
-- cycles (IMC swapped its 2026 trader screen; SIG has been issuing a 60-minute variant of a
-- 20-minute test). Without it, a 2026 result silently becomes incomparable the moment a firm
-- changes its format.

CREATE TABLE public.oa_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id TEXT NOT NULL,
  spec_version INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  abandoned BOOLEAN NOT NULL DEFAULT false,
  tab_blur_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.oa_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own OA runs" ON public.oa_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own OA runs" ON public.oa_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.oa_runs FROM anon;
GRANT SELECT, INSERT ON public.oa_runs TO authenticated;

-- user_id is denormalised off oa_runs so RLS on this table never needs a join, matching the
-- reasoning behind drill_attempts.user_id.
CREATE TABLE public.oa_section_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.oa_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  raw_score INTEGER NOT NULL DEFAULT 0,
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_correct INTEGER NOT NULL DEFAULT 0,
  items_wrong INTEGER NOT NULL DEFAULT 0,
  items_skipped INTEGER NOT NULL DEFAULT 0,
  duration_s INTEGER NOT NULL DEFAULT 0,
  pass_mark INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.oa_section_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own OA sections" ON public.oa_section_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own OA sections" ON public.oa_section_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.oa_section_results FROM anon;
GRANT SELECT, INSERT ON public.oa_section_results TO authenticated;

-- One row per ANSWERED item. Unreached questions are not written: an 80-question test where the
-- candidate reached 40 should leave 40 rows, not 40 rows of substance and 40 of empty strings.
CREATE TABLE public.oa_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.oa_section_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  problem_tag TEXT NOT NULL,
  prompt TEXT NOT NULL,
  given TEXT NOT NULL DEFAULT '',
  expected TEXT NOT NULL DEFAULT '',
  correct BOOLEAN NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.oa_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own OA items" ON public.oa_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own OA items" ON public.oa_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.oa_items FROM anon;
GRANT SELECT, INSERT ON public.oa_items TO authenticated;

CREATE INDEX idx_oa_runs_user ON public.oa_runs(user_id, firm_id, created_at DESC);
CREATE INDEX idx_oa_sections_run ON public.oa_section_results(run_id);
CREATE INDEX idx_oa_sections_best ON public.oa_section_results(user_id, module_id, raw_score DESC);
CREATE INDEX idx_oa_items_section ON public.oa_items(section_id);
CREATE INDEX idx_oa_items_weak_spot ON public.oa_items(user_id, firm_id, problem_tag);

-- Live aggregation rather than a maintained table, matching drill_weak_spots: no second writer to
-- keep in sync, and it is correctly empty until a candidate's first run lands.
CREATE OR REPLACE VIEW public.oa_weak_spots WITH (security_invoker = true) AS
SELECT
  user_id,
  firm_id,
  module_id,
  problem_tag,
  COUNT(*) AS attempts,
  SUM(CASE WHEN correct THEN 1 ELSE 0 END) AS correct_count,
  ROUND(AVG(CASE WHEN correct THEN 1 ELSE 0 END)::numeric, 3) AS accuracy,
  ROUND(AVG(latency_ms)) AS avg_latency_ms,
  MAX(created_at) AS last_seen
FROM public.oa_items
GROUP BY user_id, firm_id, module_id, problem_tag;

GRANT SELECT ON public.oa_weak_spots TO authenticated;
