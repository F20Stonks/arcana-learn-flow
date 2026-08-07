-- Lets ingest-parsed-questions upsert by (source_competition, year, question_number) instead of only
-- skipping-if-source_url-exists. Needed to replace the Putnam/IMO index-only rows (metadata + link,
-- see scripts/scrape-putnam-index.mjs / scrape-imo-index.mjs) with real full-text rows from
-- scrape-putnam-full.mjs / scrape-imo-full.mjs, which share the same year-level source_url across all
-- of a year's problems — the old source_url-only cache check would have silently skipped every one of
-- them as "already ingested" instead of updating their content.
ALTER TABLE public.reference_questions
  ADD CONSTRAINT reference_questions_natural_key UNIQUE (source_competition, year, question_number);
