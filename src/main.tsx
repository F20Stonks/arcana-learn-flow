import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Self-hosted typefaces. tailwind.config.ts has always declared Inter/JetBrains Mono, but nothing ever
// loaded them — every surface was silently falling back to system-ui and the default monospace. Variable
// fonts, bundled (no CDN, no FOUT, no layout shift).
import "@fontsource-variable/instrument-sans";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
// Book-text serif (not Instrument Serif, which has no bold cut at all) — used to make reference-paper
// question text read like the original typeset exam paper rather than the app's UI font.
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/700.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { supabaseConfigMissing } from "./integrations/supabase/client";
import { applyStoredTheme } from "./lib/appThemes";
import { applyStoredAccent } from "./components/CustomizeMenu";

// Applied here, before the app renders, so the saved theme/accent are on <html> before first
// paint — no flash of the default look. Order matters: theme sets the whole palette (incl. a
// default --primary) via the [data-theme] stylesheet rules, then accent's inline --primary
// override (if any) is applied on top, since a custom accent persists independently of theme.
// (applyStoredAccent previously existed but was never called anywhere — the accent picker's
// choice only "stuck" for the rest of that session, not across a reload. Fixed here too.)
applyStoredTheme();
applyStoredAccent();

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
