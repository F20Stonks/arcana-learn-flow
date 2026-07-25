import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SUPABASE_CONFIG_MISSING } from "./integrations/supabase/client";

const root = createRoot(document.getElementById("root")!);

if (SUPABASE_CONFIG_MISSING) {
  // Backend env vars didn't reach the build. Show a readable message instead of
  // a blank screen so this is never a silent black page again.
  root.render(
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        background: "#0b0b0f",
        color: "#e5e7eb",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "34rem", lineHeight: 1.5 }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
          Backend not connected
        </h1>
        <p style={{ opacity: 0.8 }}>
          The app loaded fine, but the Supabase environment variables
          (<code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>) didn't reach this build, so
          it can't reach the backend. Reconnect the Supabase / Cloud integration
          so those values are injected, then reload.
        </p>
      </div>
    </div>
  );
} else {
  root.render(<App />);
}
