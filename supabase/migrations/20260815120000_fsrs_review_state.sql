-- Memory state for FSRS scheduling.
--
-- The previous scheduler multiplied the interval by 1.3 / 1.6 / 2.5 on success and 0.4 on a lapse.
-- That is blind doubling: it has no model of forgetting, so it cannot distinguish a subtopic you have
-- nearly lost from one you have almost automated, and it treats the fifth successful review exactly
-- like the first. FSRS needs three things a single interval number cannot carry — how durable the
-- memory currently is, how hard this material is for this person, and when it was last seen.
--
-- All nullable: a row written before FSRS simply has no memory model yet, and bootstraps from an
-- empty card on its next review rather than pretending its interval implies a stability.

alter table public.subtopic_reviews
  add column if not exists stability double precision,
  add column if not exists difficulty double precision,
  add column if not exists reps integer not null default 0,
  add column if not exists lapses integer not null default 0,
  add column if not exists fsrs_state integer,
  add column if not exists last_review timestamptz;
