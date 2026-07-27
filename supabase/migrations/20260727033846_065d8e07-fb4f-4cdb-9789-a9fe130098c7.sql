
-- 1. Concepts: restrict INSERT to service role only
DROP POLICY IF EXISTS "Authenticated users can insert concepts" ON public.concepts;
CREATE POLICY "Only service role can insert concepts"
  ON public.concepts FOR INSERT TO service_role WITH CHECK (true);

-- 2. Storage past-papers: signed-in users only
DROP POLICY IF EXISTS "Anyone can read past paper files" ON storage.objects;
CREATE POLICY "Authenticated users can read past paper files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'past-papers');

-- 3. Subscriptions: explicit restrictive policies blocking user writes
CREATE POLICY "Users cannot insert subscriptions"
  ON public.subscriptions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Users cannot update subscriptions"
  ON public.subscriptions AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Users cannot delete subscriptions"
  ON public.subscriptions AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- 4. SECURITY DEFINER function: revoke execute from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, authenticated, PUBLIC;

-- 5. Revoke anon SELECT on non-public tables to hide from GraphQL/anon PostgREST
REVOKE SELECT ON public.concepts, public.daily_challenges, public.insights,
  public.subscriptions, public.subtopic_concepts, public.subtopic_reviews,
  public.user_concept_knowledge FROM anon;
