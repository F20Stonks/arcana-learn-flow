import { supabase, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

// Edge functions now require a real user JWT (they call getUser on it).
// The publishable/anon key has no `sub` claim and gets rejected as
// "invalid claim: missing sub claim" -> 401. Always prefer the live
// session token; fall back to the publishable key only so unauthenticated
// requests still hit the function boundary (and get a clean 401 there).
export async function getBearerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || SUPABASE_PUBLISHABLE_KEY;
}