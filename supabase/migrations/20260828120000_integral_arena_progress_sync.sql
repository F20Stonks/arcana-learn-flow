-- Integral Arena: cross-device progress sync.
--
-- XP, streak, per-problem solves, badges, sprint bests and lessons read (src/features/integrals/
-- progress.ts) previously lived only in the browser's localStorage. That is why solving fifty
-- problems on a desktop showed up as zero on the same account's phone: "the same account" had
-- nowhere to mean anything server-side. One row per user, holding the whole Progress shape as
-- JSON — the client already reads and writes it as one unit (see progressSync.ts), and nothing
-- here needs to query into individual fields, so normalizing it into columns would only add
-- migration risk for no server-side benefit.
--
-- Matches the fail-soft convention in leaderboard.ts / integral_daily_results: this ships before
-- anyone has necessarily run it, and the client already treats a missing table as "no server copy
-- yet" rather than an error.
CREATE TABLE public.integral_progress (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  progress JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integral_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own integral progress" ON public.integral_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own integral progress" ON public.integral_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integral progress" ON public.integral_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.integral_progress FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.integral_progress TO authenticated;

-- No DELETE policy, same reasoning as integral_daily_results: a progress row is either updated in
-- place or left alone, never removed by the client. No secondary index either: every access is a
-- lookup by user_id, already covered by the primary key.
