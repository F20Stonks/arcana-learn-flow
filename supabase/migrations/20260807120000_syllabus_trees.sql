-- The syllabus tree cache. See docs/syllabus-tree-layer.md.
--
-- A syllabus tree is the topic/subtopic decomposition for a NAMED external syllabus
-- (e.g. `AQA · A-Level · Physics`), authored ONCE and served to EVERY student pursuing that goal.
-- It is global content, not user data — the same argument as `lesson_plans`, one level up.
--
-- Why this table has to exist: until now every signup generated its own topic/subtopic tree at
-- runtime. That made syllabus COVERAGE a fresh gamble per student (nothing fixed to audit), and it
-- quietly defeated the lesson plan cache underneath it — `lesson_plans` is keyed on the subtopic
-- STRING, so while every student invents their own subtopic titles, those keys diverge and the plan
-- cache barely hits. One cached tree upstream makes the plan cache concentrate.
--
-- Rows are keyed by `signature` (sha256 of normalized subject|level|board — see treeSignature() in
-- supabase/functions/_shared/syllabusTree.ts). Unlike lesson plans, an unknown board does NOT
-- normalize into a shared row: a tree is only cached when subject, level AND board are all known.
-- See `hasCanonicalIdentity` — cacheable is deliberately the same condition as verifiable, because a
-- globally-shared tree is only correct when there is a real external spec it can be checked against.

CREATE TABLE public.syllabus_trees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signature TEXT NOT NULL, -- the global cache key; one row per syllabus identity per version
  tree_version INTEGER NOT NULL DEFAULT 1, -- bump SYLLABUS_TREE_VERSION to regenerate every tree at once
  -- Denormalized identity. Never read by the cache lookup (the signature is the key) — these exist so
  -- a human can inspect, audit or spot-check the cache without reversing a hash.
  subject TEXT,
  level TEXT,
  board TEXT,
  tree JSONB NOT NULL, -- validated SyllabusTree; a tree that failed validation is never stored
  -- The verification record (SyllabusCoverage): whether this tree was checked against a resolved
  -- official spec, where that spec came from, and which spec areas are still missing after the
  -- repair pass. Stored as DATA rather than asserted in a prompt, because caching multiplies quality
  -- in both directions — an unaudited truncated tree would silently clip the syllabus for every
  -- future student on this goal. Only `grounded` trees are ever written here.
  coverage JSONB,
  model TEXT, -- which model authored it, so a quality regression can be traced to a model change
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uniqueness is per (syllabus, version), NOT per syllabus — same reasoning as lesson_plans.
  -- Keying on `signature` alone would make `tree_version` a misnomer: bumping it would OVERWRITE the
  -- previous tree rather than sit beside it, so a regenerated syllabus could never be diffed against
  -- the one it replaced or rolled back to. A tree is a few KB of JSON and is the artifact the whole
  -- coverage claim rests on; keep superseded rows.
  UNIQUE (signature, tree_version)
);
ALTER TABLE public.syllabus_trees ENABLE ROW LEVEL SECURITY;

-- Trees are shared, non-personal content: any signed-in student may read any tree (same shape as
-- `lesson_plans` and the global `concepts` registry). There is deliberately NO user-level
-- INSERT/UPDATE/DELETE policy — authoring is a service-role write from the author-syllabus-tree edge
-- function, which bypasses RLS. A client that could write here could replace the syllabus served to
-- every future student on that goal.
CREATE POLICY "Authenticated users can view syllabus trees" ON public.syllabus_trees FOR SELECT USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.syllabus_trees FROM anon;
GRANT SELECT ON public.syllabus_trees TO authenticated;

-- The only hot query is the cache lookup: signature + current tree_version — which the
-- UNIQUE (signature, tree_version) constraint above already indexes, leading on signature. No
-- further index is worth its write cost.

-- Which cached tree a track was instantiated from.
--
-- Nullable and ON DELETE SET NULL by design, and it is NOT a foreign key the app reads on the hot
-- path: a track is a COPY of the tree at instantiation time, not a live view of it, so a student's
-- track never changes under them when a tree is re-authored. This column exists for provenance —
-- which template produced this track, so a coverage regression can be traced from a student's
-- complaint back to the exact tree row, and so a future "your syllabus has been updated" prompt has
-- something to compare against. Existing tracks keep NULL, which correctly reads as
-- "generated before this layer existed".
ALTER TABLE public.learning_tracks
  ADD COLUMN syllabus_tree_id UUID REFERENCES public.syllabus_trees(id) ON DELETE SET NULL;
