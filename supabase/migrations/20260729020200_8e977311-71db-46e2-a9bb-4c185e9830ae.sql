
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS waitlist_status text NOT NULL DEFAULT 'waitlisted';

-- Backfill: every existing user is grandfathered in as approved
UPDATE public.profiles SET waitlist_status = 'approved' WHERE waitlist_status <> 'approved';

-- Constrain to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_waitlist_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_waitlist_status_check
      CHECK (waitlist_status IN ('waitlisted', 'approved', 'rejected'));
  END IF;
END $$;

-- Update the signup trigger function so new users land on the waitlist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, waitlist_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'waitlisted'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
