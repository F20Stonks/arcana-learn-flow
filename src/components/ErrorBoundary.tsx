import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <h1 className="text-lg font-semibold text-foreground">Jarvis couldn't finish loading.</h1>
                <p className="mt-2 text-sm text-muted-foreground">Reload the app or sign in again. The error is visible below instead of leaving the preview black.</p>
              </div>
            </div>
            <pre className="mt-5 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-xs text-destructive">{String(this.state.error?.stack || this.state.error?.message || this.state.error)}</pre>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4" />
                Reload
              </Button>
              <Button variant="secondary" onClick={() => { window.location.href = "/auth"; }}>
                Sign in again
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}