import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader as Loader2 } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";

export default function AuthPage() {
  const { session, profile, loading, signIn, signUp } = useAuth();
  const [params] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(params.get("mode") === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  
  if (session && profile) {
    if (profile.waitlist_status !== "approved") return <Navigate to="/waitlist" replace />;
    return <Navigate to={profile.onboarding_complete ? "/dashboard" : "/onboarding"} replace />;
  }
  if (session && !profile) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);
    if (result.error) setError(result.error.message);
    setSubmitting(false);
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    const { lovable } = await import("@/integrations/lovable");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message ?? "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative">
      {/* Explicit way back to the landing page. BrandLogo below is already a Link to "/", but a
          wordmark carries no affordance saying so — arriving here (especially straight from an
          external link, where there's no history to go back through) otherwise reads as a dead end.
          A plain Link, never navigate(-1): /auth is frequently the entry URL. */}
      <Link
        to="/"
        className="absolute top-5 left-5 sm:top-6 sm:left-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandLogo className="text-3xl tracking-tight" />
          <p className="text-sm text-muted-foreground mt-2">Your AI learning companion</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 rounded-lg border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground outline-hidden focus:ring-2 focus:ring-primary/50 transition-all"
          />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 rounded-lg border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground outline-hidden focus:ring-2 focus:ring-primary/50 transition-all"
          />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full h-11 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:bg-accent transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          )}
          Continue with Google
        </button>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(""); }} className="text-primary hover:underline">
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
