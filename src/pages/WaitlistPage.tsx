import { useEffect } from "react";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export default function WaitlistPage() {
  useEffect(() => {
    // Ensure no lingering session for a waitlisted user
    supabase.auth.signOut().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <BrandLogo className="text-3xl tracking-tight" />
        <h1 className="text-2xl font-semibold text-foreground mt-8">You're on the list</h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Thanks for signing up. We're rolling out access gradually — you'll get an email
          the moment your account is ready.
        </p>
        <Link
          to="/"
          className="inline-block mt-8 text-sm text-primary hover:underline"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}