-- Learner card: persistent, cross-session context injected into every teaching prompt.
-- learner_notes: user-authored instructions ("go slower on notation", "geometric first") — never
--   touched by the AI, only by the user via Settings.
-- learner_style_notes: AI-observed signal (misconceptions, representation preference, pace) appended
--   by assess-session after each session, capped to a bounded rolling log so it never grows unbounded.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learner_notes text,
  ADD COLUMN IF NOT EXISTS learner_style_notes text;
