
REVOKE ALL ON public.billing_customers FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.billing_customers TO service_role;

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.learning_tracks FROM anon;
REVOKE ALL ON public.topics FROM anon;
REVOKE ALL ON public.subtopics FROM anon;
REVOKE ALL ON public.sessions FROM anon;
REVOKE ALL ON public.messages FROM anon;
REVOKE ALL ON public.notes FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_tracks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subtopics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;

-- Add restrictive policy so RLS-enabled billing_customers passes the linter; service_role bypasses RLS
CREATE POLICY "Deny all client access" ON public.billing_customers
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
