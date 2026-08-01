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
  signature TEXT NOT NULL UNIQUE, -- the global cache key; one row per subtopic identity
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- Plans are shared, non-personal content: any signed-in student may read any plan (same shape as the
-- global `concepts` registry). There is deliberately NO user-level INSERT/UPDATE/DELETE policy —
-- authoring is a service-role write from the author-lesson-plan edge function, which bypasses RLS.
-- A client that could write here could poison every future session on that subtopic.
CREATE POLICY "Authenticated users can view lesson plans" ON public.lesson_plans FOR SELECT USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.lesson_plans FROM anon;
GRANT SELECT ON public.lesson_plans TO authenticated;

-- The only hot query is the cache lookup: signature + current plan_version. `signature` alone is
-- already indexed by its UNIQUE constraint, so this composite is the one index worth adding.
CREATE INDEX idx_lesson_plans_signature_version ON public.lesson_plans(signature, plan_version);
