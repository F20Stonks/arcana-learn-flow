-- insights.user_id was created without a foreign key to auth.users, so it isn't covered
-- by the ON DELETE CASCADE that every other user-owned table already has. That means
-- account deletion can't rely on the database to clean these rows up (the delete-account
-- edge function deletes them explicitly as a result). Add the missing constraint so
-- referential integrity holds going forward.
DELETE FROM public.insights WHERE user_id NOT IN (SELECT id FROM auth.users);

ALTER TABLE public.insights
  ADD CONSTRAINT insights_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
