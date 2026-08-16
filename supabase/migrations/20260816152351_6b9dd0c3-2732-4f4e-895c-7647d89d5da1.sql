REVOKE SELECT ON public.resource_bookmarks, public.resource_chunks, public.resource_progress, public.resources, public.track_resources, public.user_roles FROM anon;

REVOKE ALL ON public.reference_question_classification FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_track_resource_chunks(uuid, uuid, text, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_track_resource_chunks(uuid, uuid, text, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.protect_profile_privileged_columns() FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.reference_question_sort_key(q text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT ARRAY[
    COALESCE(regexp_replace(COALESCE(q, ''), '[0-9]', '', 'g'), ''),
    lpad(COALESCE(NULLIF(regexp_replace(COALESCE(q, ''), '[^0-9]', '', 'g'), ''), '0'), 6, '0')
  ];
$function$;