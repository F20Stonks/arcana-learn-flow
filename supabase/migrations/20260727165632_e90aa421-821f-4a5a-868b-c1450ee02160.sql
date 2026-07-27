DELETE FROM public.insights WHERE user_id NOT IN (SELECT id FROM auth.users);

ALTER TABLE public.insights
  ADD CONSTRAINT insights_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;