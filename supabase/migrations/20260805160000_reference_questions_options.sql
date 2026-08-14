-- Multiple-choice papers (TMUA, and others) have lettered answer options as part of the question
-- itself, not prose. Discovered ingesting TMUA 2022 Paper 2 — every question there is MCQ (A-E, some
-- A-H), which the original schema had nowhere to hold. Letter is implicit from array index (A=0, B=1,
-- ...), matching the existing question-attack convention (options?: string[], String.fromCharCode(65+i)).
-- NULL/empty for free-response papers like STEP.
ALTER TABLE public.reference_questions ADD COLUMN options TEXT[];
