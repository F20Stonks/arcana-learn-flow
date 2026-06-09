
-- 1. Move stripe_customer_id out of profiles into a service-role-only billing table
CREATE TABLE IF NOT EXISTS public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
-- No client policies: only service_role (edge functions) may read/write billing data.

-- Migrate any existing data
INSERT INTO public.billing_customers (user_id, stripe_customer_id)
SELECT user_id, stripe_customer_id
FROM public.profiles
WHERE stripe_customer_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;

CREATE TRIGGER update_billing_customers_updated_at
BEFORE UPDATE ON public.billing_customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add missing DELETE policies
CREATE POLICY "Users can delete own sessions" ON public.sessions
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON public.messages
FOR DELETE USING (EXISTS (
  SELECT 1 FROM public.sessions s WHERE s.id = messages.session_id AND s.user_id = auth.uid()
));

CREATE POLICY "Users can delete own topics" ON public.topics
FOR DELETE USING (EXISTS (
  SELECT 1 FROM public.learning_tracks t WHERE t.id = topics.track_id AND t.user_id = auth.uid()
));

CREATE POLICY "Users can delete own subtopics" ON public.subtopics
FOR DELETE USING (EXISTS (
  SELECT 1 FROM public.topics t
  JOIN public.learning_tracks lt ON lt.id = t.track_id
  WHERE t.id = subtopics.topic_id AND lt.user_id = auth.uid()
));

-- 3. Lock down SECURITY DEFINER trigger functions from API execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

-- 4. Remove anon visibility on user-owned tables (authenticated still needs access via PostgREST)
REVOKE SELECT ON public.profiles, public.learning_tracks, public.topics, public.subtopics,
                 public.sessions, public.messages, public.notes
FROM anon;
