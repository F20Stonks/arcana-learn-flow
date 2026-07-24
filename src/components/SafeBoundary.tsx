import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type SafeBoundaryProps = {
  children: ReactNode;
  label?: string;
  compact?: boolean;
};

type SafeBoundaryState = {
  error: Error | null;
};

export default class SafeBoundary extends Component<SafeBoundaryProps, SafeBoundaryState> {
  state: SafeBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SafeBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[SafeBoundary]", this.props.label || "Panel", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className={`border border-border bg-card text-card-foreground ${this.props.compact ? "rounded-lg p-3" : "rounded-xl p-5"}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{this.props.label || "This panel"} couldn't load.</p>
            <p className="mt-1 text-xs text-muted-foreground">The rest of Jarvis is still available.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => this.setState({ error: null })}>
            Retry
          </Button>
        </div>
      </div>
    );
  }
}