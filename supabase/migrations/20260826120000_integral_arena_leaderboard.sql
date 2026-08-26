-- Integral Arena: the daily leaderboard.
--
-- Keyed on puzzle_number, not on a date. The daily integral is selected from the player's *local*
-- calendar day (see src/features/integrals/daily.ts), so at any given instant a player in Auckland
-- and one in Los Angeles are on different puzzles. Ranking by date would put them on the same board
-- with different problems; ranking by puzzle number puts everyone who played puzzle #238 together,
-- whenever their day happened to fall. This is the same choice every daily-puzzle game makes.
--
-- Being listed is the feature the board exists for, so a solved daily appears on it. Only the name
-- the player chose and the run's own numbers are exposed — see the view below.

CREATE TABLE public.integral_daily_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_number INTEGER NOT NULL,
  problem_id TEXT NOT NULL,
  solved BOOLEAN NOT NULL,
  seconds INTEGER NOT NULL,
  hints_used INTEGER NOT NULL DEFAULT 0,
  wrong_attempts INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One attempt per puzzle, enforced here rather than in the client. This is what makes a score
  -- worth comparing: without it the best strategy is to replay until the timer flatters you.
  CONSTRAINT integral_daily_results_one_per_puzzle UNIQUE (user_id, puzzle_number),

  -- Bounds, not validation. The real ceiling is base 420 x 1.5 speed x 1.5 streak = 945; anything
  -- past 1000 is not a good run, it is a forged payload.
  CONSTRAINT integral_daily_results_sane CHECK (
    score >= 0 AND score <= 1000
    AND seconds >= 0 AND seconds <= 86400
    AND hints_used >= 0 AND hints_used <= 20
    AND wrong_attempts >= 0 AND wrong_attempts <= 500
  )
);

ALTER TABLE public.integral_daily_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own integral results" ON public.integral_daily_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own integral results" ON public.integral_daily_results
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.integral_daily_results FROM anon;
GRANT SELECT, INSERT ON public.integral_daily_results TO authenticated;

-- Deliberately no UPDATE and no DELETE policy: a submitted day is final. Combined with the unique
-- constraint above, that is the whole anti-replay story at the table level.

CREATE INDEX idx_integral_results_board ON public.integral_daily_results(puzzle_number, score DESC, seconds ASC);
CREATE INDEX idx_integral_results_user ON public.integral_daily_results(user_id, puzzle_number DESC);

-- The epoch in src/features/integrals/daily.ts. Puzzle 1 is 2026-01-01.
CREATE OR REPLACE FUNCTION public.integral_current_puzzle_number()
RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT ((CURRENT_DATE - DATE '2026-01-01') + 1)::integer;
$$;

/*
  Reject a submission for a puzzle that is not plausibly today's.

  A CHECK constraint cannot call now(), so this is a trigger. The window is the server's own puzzle
  number plus or minus one, which covers the whole spread of local dates on Earth at any instant.
  It stops the two attacks the client could otherwise mount for free: backfilling a streak out of
  puzzles that have already passed, and pre-submitting tomorrow's.

  It does NOT make a score trustworthy — the client still reports its own time and result. Doing
  that properly means an edge function that selects the problem, grades the answer and measures the
  elapsed time server-side; submitScore() in leaderboard.ts is written so that swapping this insert
  for a function call touches nothing else.
*/
CREATE OR REPLACE FUNCTION public.integral_check_puzzle_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  current_puzzle INTEGER := public.integral_current_puzzle_number();
BEGIN
  IF abs(NEW.puzzle_number - current_puzzle) > 1 THEN
    RAISE EXCEPTION 'puzzle % is outside the submission window (server is on %)',
      NEW.puzzle_number, current_puzzle
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER integral_daily_results_puzzle_window
  BEFORE INSERT ON public.integral_daily_results
  FOR EACH ROW EXECUTE FUNCTION public.integral_check_puzzle_window();

/*
  The board itself.

  Runs as the view owner rather than the caller (no security_invoker), because the point of a
  leaderboard is reading other people's rows — the SELECT policy above deliberately does not allow
  that on the table. The column list is the whole security boundary, so it carries only the name a
  player chose to display, their avatar, and the numbers from the run. profiles.learner_notes,
  subscription_tier and the rest are not reachable through it.

  Unsolved days are excluded: a leaderboard of people who did not solve it is not a leaderboard.
*/
CREATE OR REPLACE VIEW public.integral_daily_leaderboard AS
SELECT
  r.puzzle_number,
  r.user_id,
  COALESCE(NULLIF(TRIM(p.display_name), ''), 'Anonymous') AS display_name,
  p.avatar_url,
  r.score,
  r.seconds,
  r.hints_used,
  r.wrong_attempts,
  RANK() OVER (
    PARTITION BY r.puzzle_number
    ORDER BY r.score DESC, r.seconds ASC, r.created_at ASC
  ) AS rank
FROM public.integral_daily_results r
LEFT JOIN public.profiles p ON p.user_id = r.user_id
WHERE r.solved;

REVOKE ALL ON public.integral_daily_leaderboard FROM anon;
GRANT SELECT ON public.integral_daily_leaderboard TO authenticated;

-- Everyone who played a puzzle, for the "you beat N% of solvers" line. Solved and unsolved both
-- count here: the denominator is who turned up, not who managed it.
CREATE OR REPLACE VIEW public.integral_daily_turnout AS
SELECT
  puzzle_number,
  COUNT(*) AS players,
  COUNT(*) FILTER (WHERE solved) AS solvers,
  ROUND(AVG(score) FILTER (WHERE solved))::integer AS average_score,
  MAX(score) AS top_score
FROM public.integral_daily_results
GROUP BY puzzle_number;

REVOKE ALL ON public.integral_daily_turnout FROM anon;
GRANT SELECT ON public.integral_daily_turnout TO authenticated;
