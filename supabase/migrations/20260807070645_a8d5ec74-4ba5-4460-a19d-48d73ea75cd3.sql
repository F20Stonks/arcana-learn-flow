-- The lesson plan cache. See docs/lesson-plan-layer.md.
CREATE TABLE public.lesson_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signature TEXT NOT NULL,
  plan_version INTEGER NOT NULL DEFAULT 1,
  subject TEXT,
  level TEXT,
  board TEXT,
  topic TEXT,
  subtopic TEXT,
  plan JSONB NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (signature, plan_version)
);
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view lesson plans" ON public.lesson_plans FOR SELECT USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.lesson_plans FROM anon;
GRANT SELECT ON public.lesson_plans TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;

-- Learner card
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learner_notes text,
  ADD COLUMN IF NOT EXISTS learner_style_notes text;

-- The syllabus tree cache. See docs/syllabus-tree-layer.md.
CREATE TABLE public.syllabus_trees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signature TEXT NOT NULL,
  tree_version INTEGER NOT NULL DEFAULT 1,
  subject TEXT,
  level TEXT,
  board TEXT,
  tree JSONB NOT NULL,
  coverage JSONB,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (signature, tree_version)
);
ALTER TABLE public.syllabus_trees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view syllabus trees" ON public.syllabus_trees FOR SELECT USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.syllabus_trees FROM anon;
GRANT SELECT ON public.syllabus_trees TO authenticated;
GRANT ALL ON public.syllabus_trees TO service_role;

ALTER TABLE public.learning_tracks
  ADD COLUMN syllabus_tree_id UUID REFERENCES public.syllabus_trees(id) ON DELETE SET NULL;