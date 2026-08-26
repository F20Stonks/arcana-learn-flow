-- Widen the profiles UPDATE grant to every column except the privileged ones
-- (waitlist_status, subscription_tier), which stay service-role only.
GRANT UPDATE (
  display_name, avatar_url, weekly_streak, total_xp, voice_id,
  onboarding_complete, updated_at, learner_notes, learner_style_notes
) ON public.profiles TO authenticated;