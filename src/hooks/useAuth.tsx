import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

const AUTH_TIMEOUT_MS = 6500;

function createLocalProfile(nextUser: User): Profile {
  const displayName =
    typeof nextUser.user_metadata?.display_name === "string" && nextUser.user_metadata.display_name.trim()
      ? nextUser.user_metadata.display_name.trim()
      : nextUser.email?.split("@")[0] || "learner";
  const now = new Date().toISOString();

  return {
    id: nextUser.id,
    user_id: nextUser.id,
    display_name: displayName,
    avatar_url: null,
    weekly_streak: 0,
    total_xp: 0,
    subscription_tier: "free",
    voice_id: null,
    onboarding_complete: false,
    created_at: now,
    updated_at: now,
  };
}

async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), AUTH_TIMEOUT_MS);
  });
  const result = await Promise.race([promise, timeout]);
  if (timeoutId) clearTimeout(timeoutId);
  return result;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Whose profile `profile` currently reflects — compared against user?.id below so "loading" can
  // never read a stale ready-state left over from before the real user was known (see useAuth fix notes).
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const createFallbackProfile = async (nextUser: User): Promise<Profile | null> => {
    const localProfile = createLocalProfile(nextUser);

    const { data, error } = await supabase
      .from("profiles")
      .upsert({ user_id: nextUser.id, display_name: localProfile.display_name }, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();

    if (error) console.warn("Profile fallback creation failed:", error.message);
    return data || localProfile;
  };

  const fetchProfile = async (nextUser: User) => {
    return withTimeout(
      (async () => {
        const { data, error } = await supabase.from("profiles").select("*").eq("user_id", nextUser.id).maybeSingle();
        if (error) console.warn("Profile fetch failed:", error.message);
        if (data) return data;
        return createFallbackProfile(nextUser);
      })(),
      createLocalProfile(nextUser),
    );
  };

  useEffect(() => {
    let cancelled = false;

    const applySession = (nextSession: Session | null) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthLoading(false);
    };

    const authTimeout = window.setTimeout(() => {
      if (!cancelled) setAuthLoading(false);
    }, AUTH_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    }).catch((error) => {
      console.warn("Auth session restore failed:", error?.message || error);
      applySession(null);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileUserId(null);
      return;
    }
    if (profileUserId === user.id) return; // already loaded (or loading) for this exact user

    let cancelled = false;
    fetchProfile(user)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setProfileUserId(user.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(createLocalProfile(user));
          setProfileUserId(user.id);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split("@")[0] } },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) setProfile(await fetchProfile(user));
  };

  const loading = authLoading || (!!user && profileUserId !== user.id);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
