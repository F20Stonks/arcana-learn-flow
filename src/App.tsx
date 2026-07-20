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
import NotFound from "./pages/NotFound";
import DevScenes from "./pages/DevScenes";
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
  if (profile?.onboarding_complete && !isNew) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (!profile?.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Routes>
      <Route path="/" element={
        session ? (profile?.onboarding_complete ? <Navigate to="/dashboard" replace /> : <Navigate to="/onboarding" replace />) : <LandingPage />
      } />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/onboarding" element={<OnboardingGuard><OnboardingPage /></OnboardingGuard>} />
      <Route path="/dashboard" element={<DashboardGuard><Dashboard /></DashboardGuard>} />
      <Route path="/track/:trackId" element={<DashboardGuard><TrackOverview /></DashboardGuard>} />
      <Route path="/track/:trackId/notes" element={<DashboardGuard><TrackNotes /></DashboardGuard>} />
      <Route path="/track/:trackId/questions" element={<DashboardGuard><QuestionAttack /></DashboardGuard>} />
      <Route path="/track/:trackId/papers" element={<DashboardGuard><TrackPapers /></DashboardGuard>} />
      <Route path="/session/:subtopicId" element={<DashboardGuard><SessionPage /></DashboardGuard>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      {import.meta.env.DEV && <Route path="/dev/scenes" element={<DevScenes />} />}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
