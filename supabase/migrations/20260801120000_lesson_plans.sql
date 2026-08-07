-- The lesson plan cache. See docs/lesson-plan-layer.md.
--
-- A plan is the per-subtopic artifact authored ONCE at the highest available quality and then served
-- to EVERY student who ever studies that subtopic — it is global content, not user data. That is the
-- whole economic argument for the layer: one expensive authoring call amortised across all users,
-- so live teaching turns only have to execute a plan instead of inventing one.
--
-- Rows are keyed by `signature` (sha256 of normalized subject|level|board|topic|subtopic — see
-- planSignature() in supabase/functions/_shared/lessonPlan.ts). Board is part of the key because
-- boards genuinely differ on scope and notation; an unknown board normalizes to "" so unbranded
-- tracks share one plan.

CREATE TABLE public.lesson_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signature TEXT NOT NULL, -- the global cache key; one row per subtopic identity per version
  plan_version INTEGER NOT NULL DEFAULT 1, -- bump LESSON_PLAN_VERSION to regenerate every plan at once
  -- Denormalized identity. Never read by the cache lookup (the signature is the key) — these exist so
  -- a human can inspect, audit or spot-check the cache without reversing a hash.
  subject TEXT,
  level TEXT,
  board TEXT,
  topic TEXT,
  subtopic TEXT,
  plan JSONB NOT NULL, -- validated LessonPlan; a plan that failed validation is never stored
  model TEXT, -- which model authored it, so a quality regression can be traced to a model change
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uniqueness is per (subtopic, version), NOT per subtopic. Keying on `signature` alone would make
  -- `plan_version` a misnomer: bumping it would OVERWRITE the previous plan rather than sit beside it,
  -- so an old plan could never be compared against its replacement or rolled back to. Plans are the
  -- quality-critical artifact of this whole layer and are graded by hand against a written bar
  -- (docs/lesson-plan-calibration.md) — being able to diff v1 against v2 for the same subtopic is
  -- exactly what that grading needs. Superseded rows are a few KB of JSON; keep them.
  UNIQUE (signature, plan_version)
);
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- Plans are shared, non-personal content: any signed-in student may read any plan (same shape as the
-- global `concepts` registry). There is deliberately NO user-level INSERT/UPDATE/DELETE policy —
-- authoring is a service-role write from the author-lesson-plan edge function, which bypasses RLS.
-- A client that could write here could poison every future session on that subtopic.
CREATE POLICY "Authenticated users can view lesson plans" ON public.lesson_plans FOR SELECT USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.lesson_plans FROM anon;
GRANT SELECT ON public.lesson_plans TO authenticated;

-- The only hot query is the cache lookup: signature + current plan_version — which the UNIQUE
-- (signature, plan_version) constraint above already indexes, leading on signature. No further index
-- is worth its write cost.
