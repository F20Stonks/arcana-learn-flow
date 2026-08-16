CREATE OR REPLACE FUNCTION public.is_admin(p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'admin');
$function$;

REVOKE EXECUTE ON FUNCTION public.match_track_resource_chunks(uuid, uuid, text, integer) FROM authenticated;