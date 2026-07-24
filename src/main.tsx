import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.textContent = "Jarvis could not start because the app root is missing.";
} else {
  rootElement.innerHTML = '<div class="min-h-screen bg-background text-foreground flex items-center justify-center"><div class="text-sm text-muted-foreground">Starting Jarvis…</div></div>';
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
