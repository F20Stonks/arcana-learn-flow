import { Component, ReactNode } from "react";

interface State { error: Error | null }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
          <div style={{ maxWidth: 520, background: "#141414", border: "1px solid #262626", borderRadius: 12, padding: 24 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 13, color: "#a3a3a3", marginBottom: 16 }}>The app hit an unexpected error. Try reloading — if it keeps happening, the details below will help debug it.</p>
            <pre style={{ fontSize: 11, color: "#f87171", background: "#0a0a0a", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 220, whiteSpace: "pre-wrap" }}>{String(this.state.error?.stack || this.state.error?.message || this.state.error)}</pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer" }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}