import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// componentTagger (lovable-tagger) runs in development mode only — the mode
// Lovable's in-editor preview serves — and is what the preview harness attaches
// to. It is loaded OPTIONALLY: a static import would make the whole vite config
// fail to load anywhere the package isn't installed, which takes the dev server
// down entirely and renders the preview blank. Missing package => no tagger, and
// everything else still runs.
async function optionalComponentTagger(): Promise<PluginOption | null> {
  try {
    const mod = await import("lovable-tagger");
    return mod.componentTagger();
  } catch {
    return null;
  }
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => ({
  server: {
    host: "::",
    port: process.env.PORT ? Number(process.env.PORT) : 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" ? await optionalComponentTagger() : null,
  ].filter(Boolean) as PluginOption[],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
