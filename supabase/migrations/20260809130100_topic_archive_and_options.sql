-- Lets a track's elective-option topics be added, archived, and restored independently of the rest of
-- the track. See 20260809130000_syllabus_tree_options.sql (the cache-side half of this feature) and
-- docs/syllabus-tree-layer.md.
--
-- `archived_at`: NULL = active, a timestamp = archived (and when) — the exact learning_tracks.archived_at
-- pattern from 20260713120000_track_archive.sql, reused rather than reinvented. Archiving never touches
-- subtopics/sessions/notes underneath, so restoring is instant (flip the timestamp back to NULL) and
-- lossless — no re-fetch or re-instantiation needed except when adding an option for the very first
-- time. Per the user's explicit direction, removing an option is never destructive and never final:
-- "archive it, and you can add it back anytime, we don't need to be strict."
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- `option_group`: NULL means this topic is part of the compulsory core; a non-null value names which
-- elective option this topic came from (e.g. 'Astrophysics'), matching syllabus_trees.option by
-- convention (not a foreign key — a track's topics are a COPY, instantiated once, same reasoning as
-- learning_tracks.syllabus_tree_id being provenance-only). This is what lets the UI archive/restore an
-- entire option's topics as one unit with a single UPDATE, and what lets instantiation check whether an
-- option was already added to this track before (so "add" restores existing rows instead of duplicating
-- them).
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS option_group TEXT;

-- The hot query this feature adds: "this track's rows for option X" (both for archiving them as a group
-- and for checking whether they already exist before instantiating).
CREATE INDEX IF NOT EXISTS idx_topics_track_option ON public.topics(track_id, option_group);

-- Dashboard/session/review-scheduling queries filter out archived topics the same way the dashboard
-- already filters out archived tracks — index the pair so that filter stays cheap as tracks grow
-- options.
CREATE INDEX IF NOT EXISTS idx_topics_track_archived ON public.topics(track_id, archived_at);

-- Which elective options this track's syllabus HAS (e.g. ['Astrophysics', 'Medical Physics', ...]),
-- captured once from author-syllabus-tree's core-mode response at track creation. Deliberately NOT a
-- live read of the cached tree's own optionalUnits — same reasoning as syllabus_tree_id being a
-- provenance snapshot rather than a live view (docs/syllabus-tree-layer.md): a track's option picker
-- should not silently change if the cached core tree is later re-authored. Empty array (the default)
-- means "no elective options for this syllabus" — TrackOverview's options section stays hidden.
ALTER TABLE public.learning_tracks ADD COLUMN IF NOT EXISTS available_options TEXT[] NOT NULL DEFAULT '{}';
