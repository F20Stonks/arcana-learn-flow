import BrandLogo from "@/components/BrandLogo";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

// Deliberately does NOT sign the user out (it used to — see git history — which meant every waitlisted
// signup lost their session on the very page meant to keep them around). Waitlisted users stay signed in
// so they can reach /question-bank (gated by ProtectedRoute, not DashboardGuard, specifically so this
// works) — that's the "something real to do while you wait" hook this page exists to deliver on.
export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <BrandLogo className="text-3xl tracking-tight" />
        <h1 className="text-2xl font-semibold text-foreground mt-8">You're on the list</h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Thanks for signing up. We're rolling out full access gradually — you'll get an email
          the moment your account is ready.
        </p>
        <Link
          to="/question-bank"
          className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Browse real exam questions while you wait <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <div>
          <Link to="/" className="mt-5 inline-block text-sm text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}