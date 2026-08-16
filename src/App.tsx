import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useSearchParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import OnboardingPage from "./pages/OnboardingPage";
import Dashboard from "./pages/Dashboard";
import TrackOverview from "./pages/TrackOverview";
import TrackNotes from "./pages/TrackNotes";
import QuestionAttack from "./pages/QuestionAttack";
import TrackPapers from "./pages/TrackPapers";
import SessionPage from "./pages/SessionPage";
import SettingsPage from "./pages/SettingsPage";
import ReferenceQuestions from "./pages/ReferenceQuestions";
import ResourceBank from "./pages/ResourceBank";
import ConceptsPage from "./pages/ConceptsPage";
import MapPage from "./pages/MapPage";
import ReviewCalendarPage from "./pages/ReviewCalendarPage";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import QuestionBank, { QuestionBankDetail } from "./pages/QuestionBank";
import NotFound from "./pages/NotFound";
import DevScenes from "./pages/DevScenes";
// Lazy so pdf.js (~1.2 MB of engine, plus its worker) is fetched when someone actually opens a
// document, not on every page load of the app.
const ResourceReader = lazy(() => import("./pages/ResourceReader"));
import PricingPage from "./pages/PricingPage";
import WaitlistPage from "./pages/WaitlistPage";
import TermsPage from "./pages/legal/TermsPage";
import PrivacyPage from "./pages/legal/PrivacyPage";
import RefundPage from "./pages/legal/RefundPage";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const [params] = useSearchParams();
  const isNew = params.get("new") === "1";
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile && profile.waitlist_status !== "approved") return <Navigate to="/waitlist" replace />;
  if (profile?.onboarding_complete && !isNew) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile && profile.waitlist_status !== "approved") return <Navigate to="/waitlist" replace />;
  if (!profile?.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Routes>
      <Route path="/" element={
        session
          ? (profile && profile.waitlist_status !== "approved"
              ? <Navigate to="/waitlist" replace />
              : profile?.onboarding_complete
                ? <Navigate to="/dashboard" replace />
                : <Navigate to="/onboarding" replace />)
          : <LandingPage />
      } />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/waitlist" element={<WaitlistPage />} />
      <Route path="/onboarding" element={<OnboardingGuard><OnboardingPage /></OnboardingGuard>} />
      <Route path="/dashboard" element={<DashboardGuard><Dashboard /></DashboardGuard>} />
      <Route path="/track/:trackId" element={<DashboardGuard><TrackOverview /></DashboardGuard>} />
      <Route path="/track/:trackId/notes" element={<DashboardGuard><TrackNotes /></DashboardGuard>} />
      <Route path="/track/:trackId/questions" element={<DashboardGuard><QuestionAttack /></DashboardGuard>} />
      <Route path="/track/:trackId/papers" element={<DashboardGuard><TrackPapers /></DashboardGuard>} />
      <Route path="/session/:subtopicId" element={<DashboardGuard><SessionPage /></DashboardGuard>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      {/* Student-facing browser over the ingested reference-question corpus (STEP, Putnam, IMO, …). Not
          track-scoped (the corpus is global), so it sits at the top level next to /dashboard rather than
          under /track/:id. Deliberately gated by ProtectedRoute (session only), NOT DashboardGuard —
          waitlisted signups (not yet approved, no onboarding) get read access here specifically, as the
          "something real to do while you wait" hook. Everything else stays behind full approval. */}
      <Route path="/question-bank" element={<ProtectedRoute><QuestionBank /></ProtectedRoute>} />
      <Route path="/question-bank/:questionId" element={<ProtectedRoute><QuestionBankDetail /></ProtectedRoute>} />
      {/* Pilot viewer for the reference-question corpus — real auth, real data, deliberately not linked
          from any nav yet (direct URL only) until the UX is approved. */}
      <Route path="/reference-questions" element={<ProtectedRoute><ReferenceQuestions /></ProtectedRoute>} />
      <Route path="/resource-bank" element={<ProtectedRoute><ResourceBank /></ProtectedRoute>} />
      {/* The reader runs full-height outside AppShell — see ResourceReader for why the sidebar is
          dropped here. ProtectedRoute, not DashboardGuard: reading a document needs a session, not a
          completed onboarding. */}
      <Route
        path="/resource/:resourceId"
        element={
          <ProtectedRoute>
            <Suspense fallback={null}><ResourceReader /></Suspense>
          </ProtectedRoute>
        }
      />
      {/* The Knowledge group. These were tabs inside a right-hand slide-over; they're routes now so
          they can be linked, refreshed and navigated back out of like anything else. */}
      <Route path="/concepts" element={<DashboardGuard><ConceptsPage /></DashboardGuard>} />
      <Route path="/map" element={<DashboardGuard><MapPage /></DashboardGuard>} />
      <Route path="/reviews" element={<DashboardGuard><ReviewCalendarPage /></DashboardGuard>} />
      <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/refund" element={<RefundPage />} />
      {import.meta.env.DEV && <Route path="/dev/scenes" element={<DevScenes />} />}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* 300ms, not Radix's 700ms default: in a collapsed sidebar the tooltip IS the label — it's
        the only way to read the nav — so three-quarters of a second turns the rail into a guess.
        Radix still skips the delay entirely for adjacent tooltips once one is open. */}
    <TooltipProvider delayDuration={300}>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
