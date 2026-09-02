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
import DrillsHub from "./pages/DrillsHub";
import QuantHub from "./pages/QuantHub";
import IntegralsHub from "./pages/IntegralsHub";
import DailyIntegral from "./pages/DailyIntegral";
import IntegralTraining, { TrainingTechnique } from "./pages/IntegralTraining";
import IntegralLessons from "./pages/IntegralLessons";
import IntegralSprint from "./pages/IntegralSprint";
import IntegralProgress from "./pages/IntegralProgress";
import OAHub from "./pages/OAHub";
import OAFirm from "./pages/OAFirm";
import OARun from "./pages/OARun";
import OADrill from "./pages/OADrill";
import IntegralPaper from "./pages/IntegralPaper";
import IntegralRecognition from "./pages/IntegralRecognition";
import IntegralValues from "./pages/IntegralValues";
import IntegralCampaign from "./pages/IntegralCampaign";
import IntegralHeadsolve from "./pages/IntegralHeadsolve";
import UkuibPath from "./pages/UkuibPath";
import UkuibSkill from "./pages/UkuibSkill";
import UkuibLesson from "./pages/UkuibLesson";
import UkuibCheckpoint from "./pages/UkuibCheckpoint";
import DrillPlay from "./pages/DrillPlay";
import LeaderboardsPage from "./pages/LeaderboardsPage";
import NotFound from "./pages/NotFound";
import DevScenes from "./pages/DevScenes";
import ComingSoon from "./components/ComingSoon";
// Lazy so pdf.js (~1.2 MB of engine, plus its worker) is fetched when someone actually opens a
// document, not on every page load of the app.
const ResourceReader = lazy(() => import("./pages/ResourceReader"));
import PricingPage from "./pages/PricingPage";
import WaitlistPage from "./pages/WaitlistPage";
import TermsPage from "./pages/legal/TermsPage";
import PrivacyPage from "./pages/legal/PrivacyPage";
import RefundPage from "./pages/legal/RefundPage";
import { Loader2 } from "lucide-react";
import { setProgressScope } from "@/features/integrals/progress";

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
  // No more full-account block on waitlist_status: every signup gets in and can play Drills /
  // Integral Arena immediately. waitlist_status now only decides which routes below are gated to
  // a ComingSoon page (see BetaGate) rather than whether the account can be used at all.
  if (profile?.onboarding_complete && !isNew) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  // Onboarding is skipped for now — new signups land straight on the dashboard.
  return <>{children}</>;
}

/**
 * Gates a feature behind full beta approval. Drills and Integral Arena are the only features live
 * for every signup right now — everything else renders ComingSoon until profile.waitlist_status
 * flips to "approved" (still an owner/service-role-only column, see the profiles RLS grant). Sits
 * inside DashboardGuard/ProtectedRoute, not in place of them: auth and onboarding requirements are
 * unchanged, this only decides which of those authenticated pages is the real one.
 */
function BetaGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { profile } = useAuth();
  if (profile?.waitlist_status !== "approved") return <ComingSoon feature={feature} />;
  return <>{children}</>;
}

function AppRoutes() {
  const { session, loading, user } = useAuth();

  // Local Integral Arena progress is namespaced per account, set here (during render, before any
  // page reads it) so signing in with a second email on the same browser starts from zero.
  setProgressScope(user?.id ?? null);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Routes>
      <Route path="/" element={
        session ? <Navigate to="/dashboard" replace /> : <LandingPage />
      } />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/waitlist" element={<WaitlistPage />} />
      <Route path="/onboarding" element={<OnboardingGuard><OnboardingPage /></OnboardingGuard>} />
      {/* Beta: only Drills and Integral Arena are live for every signup. Everything else below is
          real, working code — BetaGate just stands a ComingSoon page in front of it until
          profile.waitlist_status is flipped to "approved" for that account. */}
      <Route path="/dashboard" element={<DashboardGuard><BetaGate feature="Learning tracks"><Dashboard /></BetaGate></DashboardGuard>} />
      <Route path="/track/:trackId" element={<DashboardGuard><BetaGate feature="Learning tracks"><TrackOverview /></BetaGate></DashboardGuard>} />
      <Route path="/track/:trackId/notes" element={<DashboardGuard><BetaGate feature="Learning tracks"><TrackNotes /></BetaGate></DashboardGuard>} />
      <Route path="/track/:trackId/questions" element={<DashboardGuard><BetaGate feature="Learning tracks"><QuestionAttack /></BetaGate></DashboardGuard>} />
      <Route path="/track/:trackId/papers" element={<DashboardGuard><BetaGate feature="Learning tracks"><TrackPapers /></BetaGate></DashboardGuard>} />
      <Route path="/session/:subtopicId" element={<DashboardGuard><BetaGate feature="Sessions"><SessionPage /></BetaGate></DashboardGuard>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/question-bank" element={<ProtectedRoute><BetaGate feature="Question bank"><QuestionBank /></BetaGate></ProtectedRoute>} />
      <Route path="/question-bank/:questionId" element={<ProtectedRoute><BetaGate feature="Question bank"><QuestionBankDetail /></BetaGate></ProtectedRoute>} />
      {/* Timed practice games sharing one drill engine (src/features/drills) — Zetamac++ first.
          Live for every signup: no BetaGate. */}
      <Route path="/leaderboards" element={<DashboardGuard><LeaderboardsPage /></DashboardGuard>} />
      <Route path="/drills" element={<DashboardGuard><DrillsHub /></DashboardGuard>} />
      <Route path="/drills/:drillKey" element={<DashboardGuard><DrillPlay /></DashboardGuard>} />
      {/* UK Quant (src/features/quant) — a separate, curated lesson-first curriculum for quant-
          interview prep. Not part of the general Drills catalog: no nav link, reachable only by
          direct URL. Reuses the Drills practice engine read-only via focus-tagged practice links. */}
      <Route path="/quant" element={<DashboardGuard><QuantHub /></DashboardGuard>} />
      {/* Integral Arena (src/features/integrals) — the daily integral plus a technique-by-technique
          training room. Self-contained: its own grader, problem bank and progression. Also live for
          every signup: no BetaGate. */}
      <Route path="/integrals" element={<DashboardGuard><IntegralsHub /></DashboardGuard>} />
      <Route path="/integrals/daily" element={<DashboardGuard><DailyIntegral /></DashboardGuard>} />
      <Route path="/integrals/sprint" element={<DashboardGuard><IntegralSprint /></DashboardGuard>} />
      <Route path="/integrals/progress" element={<DashboardGuard><IntegralProgress /></DashboardGuard>} />
      <Route path="/integrals/lessons" element={<DashboardGuard><IntegralLessons /></DashboardGuard>} />
      <Route path="/integrals/train" element={<DashboardGuard><IntegralTraining /></DashboardGuard>} />
      <Route path="/integrals/lessons" element={<DashboardGuard><IntegralLessons /></DashboardGuard>} />
      <Route path="/integrals/train/source/:sourceKey" element={<DashboardGuard><TrainingTechnique /></DashboardGuard>} />
      <Route path="/integrals/train/:techniqueId" element={<DashboardGuard><TrainingTechnique /></DashboardGuard>} />
      {/* UK Round 1 mock: 30 questions, 120 minutes, free navigation — see UK_BEE_BURST.md WS-3. */}
      <Route path="/integrals/uk/round1" element={<DashboardGuard><IntegralPaper /></DashboardGuard>} />
      {/* "Name the weapon" recognition drill — see UK_BEE_BURST.md WS-6. */}
      <Route path="/integrals/recognition" element={<DashboardGuard><IntegralRecognition /></DashboardGuard>} />
      {/* The values deck — flashcards for memorised results, see UK_BEE_BURST.md WS-6. */}
      <Route path="/integrals/values" element={<DashboardGuard><IntegralValues /></DashboardGuard>} />
      {/* The campaign — a dated, self-administering training track counted back from Round 1,
          composing recognition/training/paper/values/progress into a daily plan. See
          UK_BEE_BURST.md WS-7. */}
      <Route path="/integrals/campaign" element={<DashboardGuard><IntegralCampaign /></DashboardGuard>} />
      {/* Headsolve — think time only, no answer input. See UK_BEE_BURST.md Extension 2, WS-9. */}
      <Route path="/integrals/headsolve" element={<DashboardGuard><IntegralHeadsolve /></DashboardGuard>} />

      {/* The UKUIB course (src/features/integrals/ukuib) — a Duolingo-style path through the
          published UK University Integration Bee syllabus. Its own section rather than another
          Arena tile: the Arena is free-form practice by technique or by paper, the course is a
          route. Both draw on the same bank and the same grader. See UKUIB_PATH.md. */}
      <Route path="/ukuib" element={<DashboardGuard><UkuibPath /></DashboardGuard>} />
      <Route path="/ukuib/skill/:skillId" element={<DashboardGuard><UkuibSkill /></DashboardGuard>} />
      <Route path="/ukuib/lesson/:skillId" element={<DashboardGuard><UkuibLesson /></DashboardGuard>} />
      <Route path="/ukuib/checkpoint/:unitId" element={<DashboardGuard><UkuibCheckpoint /></DashboardGuard>} />

      {/* OA Arena (src/features/oa) — format reconstructions of trading firms' online
          assessments. Self-contained like the Integral Arena: no backend, nothing leaves the
          browser, and every question is generated and graded locally. */}
      <Route path="/oa" element={<DashboardGuard><OAHub /></DashboardGuard>} />
      <Route path="/oa/drill" element={<DashboardGuard><OADrill /></DashboardGuard>} />
      <Route path="/oa/:firmId" element={<DashboardGuard><OAFirm /></DashboardGuard>} />
      <Route path="/oa/:firmId/:assessmentId" element={<DashboardGuard><OARun /></DashboardGuard>} />
      {/* Pilot viewer for the reference-question corpus — real auth, real data, deliberately not linked
          from any nav yet (direct URL only) until the UX is approved. */}
      <Route path="/reference-questions" element={<ProtectedRoute><BetaGate feature="Reference questions"><ReferenceQuestions /></BetaGate></ProtectedRoute>} />
      <Route path="/resource-bank" element={<ProtectedRoute><BetaGate feature="Resources"><ResourceBank /></BetaGate></ProtectedRoute>} />
      {/* The reader runs full-height outside AppShell — see ResourceReader for why the sidebar is
          dropped here. ProtectedRoute, not DashboardGuard: reading a document needs a session, not a
          completed onboarding. BetaGate still applies (it renders its own AppShell page when gated). */}
      <Route
        path="/resource/:resourceId"
        element={
          <ProtectedRoute>
            <BetaGate feature="Resources">
              <Suspense fallback={null}><ResourceReader /></Suspense>
            </BetaGate>
          </ProtectedRoute>
        }
      />
      {/* The Knowledge group. These were tabs inside a right-hand slide-over; they're routes now so
          they can be linked, refreshed and navigated back out of like anything else. */}
      <Route path="/concepts" element={<DashboardGuard><BetaGate feature="Concepts"><ConceptsPage /></BetaGate></DashboardGuard>} />
      <Route path="/map" element={<DashboardGuard><BetaGate feature="Map"><MapPage /></BetaGate></DashboardGuard>} />
      <Route path="/reviews" element={<DashboardGuard><BetaGate feature="Review calendar"><ReviewCalendarPage /></BetaGate></DashboardGuard>} />
      <Route path="/analytics" element={<ProtectedRoute><BetaGate feature="Analytics"><AnalyticsDashboard /></BetaGate></ProtectedRoute>} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/refund" element={<RefundPage />} />
      {import.meta.env.DEV && <Route path="/dev/scenes" element={<DevScenes />} />}
      {/* Integral Arena runs behind DashboardGuard, which needs a session and a finished onboarding —
          none of which a local dev run has. These unguarded twins exist so the pages can be opened
          and screenshotted while working on them. DEV only: the whole block is dead code Vite strips
          from a production bundle. */}
      {import.meta.env.DEV && <Route path="/dev/integrals" element={<IntegralsHub />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/daily" element={<DailyIntegral />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/sprint" element={<IntegralSprint />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/progress" element={<IntegralProgress />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/lessons" element={<IntegralLessons />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/train" element={<IntegralTraining />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/lessons" element={<IntegralLessons />} />}
      {import.meta.env.DEV && (
        <Route path="/dev/integrals/train/source/:sourceKey" element={<TrainingTechnique />} />
      )}
      {import.meta.env.DEV && (
        <Route path="/dev/integrals/train/:techniqueId" element={<TrainingTechnique />} />
      )}
      {import.meta.env.DEV && <Route path="/dev/integrals/uk/round1" element={<IntegralPaper />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/recognition" element={<IntegralRecognition />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/values" element={<IntegralValues />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/campaign" element={<IntegralCampaign />} />}
      {import.meta.env.DEV && <Route path="/dev/integrals/headsolve" element={<IntegralHeadsolve />} />}
      {import.meta.env.DEV && <Route path="/dev/ukuib" element={<UkuibPath />} />}
      {import.meta.env.DEV && <Route path="/dev/ukuib/skill/:skillId" element={<UkuibSkill />} />}
      {import.meta.env.DEV && <Route path="/dev/ukuib/lesson/:skillId" element={<UkuibLesson />} />}
      {import.meta.env.DEV && <Route path="/dev/ukuib/checkpoint/:unitId" element={<UkuibCheckpoint />} />}
      {/* Same unguarded-twin pattern as the /dev/integrals/* block above, for drills and UK Quant. */}
      {import.meta.env.DEV && <Route path="/dev/drills" element={<DrillsHub />} />}
      {import.meta.env.DEV && <Route path="/dev/drills/:drillKey" element={<DrillPlay />} />}
      {import.meta.env.DEV && <Route path="/dev/quant" element={<QuantHub />} />}
      {import.meta.env.DEV && <Route path="/dev/oa" element={<OAHub />} />}
      {import.meta.env.DEV && <Route path="/dev/oa/drill" element={<OADrill />} />}
      {import.meta.env.DEV && <Route path="/dev/oa/:firmId" element={<OAFirm />} />}
      {import.meta.env.DEV && <Route path="/dev/oa/:firmId/:assessmentId" element={<OARun />} />}
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
