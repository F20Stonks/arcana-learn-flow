import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotesProvider } from "@/stores/NotesContext";
import Home from "./pages/Home";
import TrackDetail from "./pages/TrackDetail";
import TrackNotes from "./pages/TrackNotes";
import TrackTracker from "./pages/TrackTracker";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <NotesProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/track/:trackId" element={<TrackDetail />} />
            <Route path="/track/:trackId/notes" element={<TrackNotes />} />
            <Route path="/track/:trackId/tracker" element={<TrackTracker />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </NotesProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
