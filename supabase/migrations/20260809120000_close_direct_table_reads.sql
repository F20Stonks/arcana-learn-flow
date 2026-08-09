-- Closes a real bypass left by 20260807120526_reference_question_rate_limit.sql: that migration built a
-- rate-limited, RPC-mediated read path (reference_question_facets / reference_question_list / the
-- reference-questions edge function) and stopped the CLIENT CODE from querying reference_questions
-- directly — but it never revoked the original "Authenticated users can view reference questions" policy
-- from 20260805150000_reference_questions.sql. That policy is still `TO authenticated USING (true)`, so
-- any signed-in user's own session (their JWT — no elevated privilege needed) can skip the edge function,
-- the rate limiter, and the RPCs entirely with one direct PostgREST call
-- (`GET .../rest/v1/reference_questions?select=*`), pulling the full corpus including question_text/
-- solution_text — the exact payload the rate limiter exists to protect. The reference-questions edge
-- function already reads/writes with the service-role key (see its index.ts), so revoking the
-- authenticated policy removes the bypass without touching the app's real working path.
DROP POLICY IF EXISTS "Authenticated users can view reference questions" ON public.reference_questions;
REVOKE SELECT ON public.reference_questions FROM authenticated;

-- past_papers has the identical shape and never got the reference_questions treatment at all: still
-- directly bulk-readable by any authenticated user (`TO authenticated USING (true)`), no rate limit, no
-- RPC mediation, since the day it was created. The underlying PDFs are meant to be freely public already
-- (see the past-papers storage bucket's own public policy/comment), so this was never a content-secrecy
-- leak the way reference_questions was — but an unbounded, unrated direct table read is still a real
-- availability/cost surface, and resolve-past-papers already reads/writes with the service-role key (see
-- its index.ts), so no client caller needs the authenticated policy either. Closing it keeps the two
-- global-content tables consistent instead of leaving one deliberately open.
DROP POLICY IF EXISTS "Anyone authenticated can read past papers" ON public.past_papers;
REVOKE SELECT ON public.past_papers FROM authenticated;
