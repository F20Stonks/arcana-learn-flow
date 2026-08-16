CREATE SCHEMA IF NOT EXISTS internal;
GRANT USAGE ON SCHEMA internal TO authenticated, service_role;

ALTER MATERIALIZED VIEW public.reference_question_classification SET SCHEMA internal;
GRANT SELECT ON internal.reference_question_classification TO authenticated, service_role;

ALTER FUNCTION public.reference_question_facets(text, text, text) SET search_path TO 'public', 'internal';
ALTER FUNCTION public.reference_question_list(text, text, text, text, integer, text, text, uuid, integer, integer, text) SET search_path TO 'public', 'internal';
ALTER FUNCTION public.reference_question_progress(uuid) SET search_path TO 'public', 'internal';

CREATE OR REPLACE FUNCTION public.refresh_reference_question_classification()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'internal'
AS $function$
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.reference_question_classification;
$function$;