-- Where a worked solution came from.
--
-- Most university-level material (Tripos example sheets in particular) has no public official
-- solutions, so any solution set is assembled from mixed sources. A student reading a worked
-- solution needs to know whether they are looking at the examiner's own answer or someone else's
-- reconstruction — those carry very different authority, and a confidently wrong worked solution is
-- more damaging than no solution at all.
--
-- Recorded at ingest, never after: provenance cannot be reconstructed once the import has run, and
-- retrofitting it means guessing. `generated` exists as a value so that if AI-written solutions are
-- ever added they are forced to declare themselves rather than passing as official.

alter table public.reference_questions
  add column if not exists solution_provenance text
    check (solution_provenance in ('official','textbook','community','generated')),
  add column if not exists solution_source_url text,
  add column if not exists solution_added_at timestamptz;
