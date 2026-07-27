import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Self-hosted typefaces. tailwind.config.ts has always declared Inter/JetBrains Mono, but nothing ever
// loaded them — every surface was silently falling back to system-ui and the default monospace. Variable
// fonts, bundled (no CDN, no FOUT, no layout shift).
import "@fontsource-variable/instrument-sans";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { supabaseConfigMissing } from "./integrations/supabase/client";

const rootElement = document.getElementById("root");

// A build with no backend credentials cannot do anything useful, and every failure
// downstream of it looks like an unexplained blank page. Say so explicitly instead.
const CONFIG_ERROR_HTML = `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
              font-family:ui-sans-serif,system-ui,sans-serif;background:#0a0a0a;color:#fff">
    <div style="max-width:520px">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#f59e0b">
        Backend not connected
      </div>
      <h1 style="font-size:22px;line-height:1.3;margin:10px 0 12px;font-weight:600">
        Cortexed can't reach its backend, so the app didn't start.
      </h1>
      <p style="font-size:14px;line-height:1.6;color:#a1a1aa;margin:0 0 16px">
        This build has no Supabase credentials
        (<code style="color:#e4e4e7">VITE_SUPABASE_URL</code> and
        <code style="color:#e4e4e7">VITE_SUPABASE_PUBLISHABLE_KEY</code>).
        They're injected by the hosting environment at build time, so this usually means
        the Cloud backend isn't linked to this project any more.
      </p>
      <p style="font-size:14px;line-height:1.6;color:#a1a1aa;margin:0">
        Reconnect the Cloud backend (or set those two environment variables) and rebuild.
      </p>
    </div>
  </div>
`;

if (!rootElement) {
  document.body.textContent = "Cortexed could not start because the app root is missing.";
} else if (supabaseConfigMissing) {
  rootElement.innerHTML = CONFIG_ERROR_HTML;
} else {
  rootElement.innerHTML =
    '<div class="min-h-screen bg-background text-foreground flex items-center justify-center"><div class="text-sm text-muted-foreground">Starting Cortexed…</div></div>';
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
