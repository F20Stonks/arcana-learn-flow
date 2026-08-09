-- Adds elective-option support to the syllabus tree cache. See docs/syllabus-tree-layer.md for the
-- base layer this extends.
--
-- Real specs are frequently not one linear syllabus: AQA A-Level Physics has a compulsory core PLUS
-- five mutually-exclusive options (Astrophysics, Medical Physics, Engineering Physics, Turning Points
-- in Physics, Electronics) of which a student sits exactly one. A "complete" tree that folded all five
-- in would be wrong, not thorough — most students never sit four of them. So the compulsory core and
-- each elective option are cached as SEPARATE rows, each independently authored/grounded/re-gradeable,
-- composed together only at track-instantiation time (see topics.option_group in the migration
-- alongside this one). This also generalizes to boards with "pick N of M" options (e.g. Further Maths'
-- 2-of-8) without any further schema change — each option is still just one more row.
--
-- `signature` is deliberately left as the existing hash of (subject|level|board) — NOT rehashed to
-- include option — so treeSignature() and every existing call site keeps working unchanged for the
-- core case. `option` sits alongside it as its own real column instead: '' means "the compulsory core,
-- no elective unit" (a canonical, cacheable value, not an unknown/null state), and a specific option's
-- row names it directly (e.g. 'Astrophysics'). This is the same "denormalized alongside the hash, never
-- read by the lookup itself" pattern subject/level/board already use, just made load-bearing for once —
-- the lookup now filters on it directly rather than only displaying it.
ALTER TABLE public.syllabus_trees ADD COLUMN IF NOT EXISTS "option" TEXT NOT NULL DEFAULT '';

-- Uniqueness moves from (signature, tree_version) to (signature, option, tree_version) — the old
-- constraint would otherwise reject a second row for the same syllabus's Astrophysics option, since it
-- shares the same subject/level/board signature as the core row.
ALTER TABLE public.syllabus_trees DROP CONSTRAINT IF EXISTS syllabus_trees_signature_tree_version_key;
ALTER TABLE public.syllabus_trees ADD CONSTRAINT syllabus_trees_signature_option_tree_version_key
  UNIQUE (signature, "option", tree_version);