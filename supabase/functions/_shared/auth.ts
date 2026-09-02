import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// Verifies the caller's Supabase JWT and returns the user id.
// Returns null when no valid session was provided.
export async function requireUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  // SUPABASE_ANON_KEY is not always present in the function env (newer projects ship
  // SUPABASE_PUBLISHABLE_KEY instead); fall back so token validation never silently 401s.
  const KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !KEY) return null;

  const client = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export function unauthorized(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}