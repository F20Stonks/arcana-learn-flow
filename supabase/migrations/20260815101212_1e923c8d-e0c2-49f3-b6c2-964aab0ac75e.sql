-- 1. Prevent self-escalation of privileged profile columns
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.waitlist_status := OLD.waitlist_status;
    NEW.subscription_tier := OLD.subscription_tier;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- 2. Storage: restrict reads to authenticated users
DROP POLICY IF EXISTS "Anyone can read reference paper files" ON storage.objects;
CREATE POLICY "Authenticated users can read reference paper files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reference-papers');

DROP POLICY IF EXISTS "Anyone can read spec document files" ON storage.objects;
CREATE POLICY "Authenticated users can read spec document files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'spec-documents');

-- 3. Revoke anon SELECT (GraphQL/PostgREST discoverability) on internal tables
REVOKE SELECT ON public.user_resource_analytics FROM anon;
REVOKE SELECT ON public.scene_outcomes FROM anon;
REVOKE SELECT ON public.session_turn_flags FROM anon;
REVOKE SELECT ON public.reference_question_requests FROM anon;
REVOKE SELECT ON public.resource_sources FROM anon;
REVOKE SELECT ON public.reference_topic_aliases FROM anon;
REVOKE SELECT ON public.reference_topic_strands FROM anon;