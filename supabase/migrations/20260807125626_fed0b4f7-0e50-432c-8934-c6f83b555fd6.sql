ALTER TABLE public.reference_questions
  ADD CONSTRAINT reference_questions_natural_key UNIQUE (source_competition, year, question_number);