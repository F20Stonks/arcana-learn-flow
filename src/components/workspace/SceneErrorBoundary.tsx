import { Component, type ReactNode } from "react";

interface Props {
  /** identity of the current payload — changing it clears a previous error */
  resetKey: unknown;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Last line of defence for model-authored scenes: if a spec that passed
 * sanitization still explodes in the renderer, fail the canvas — not the
 * whole session.
 */
export default class SceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[scene] renderer crashed on this spec:", error);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <div className="text-center px-6">
            <div className="text-sm font-medium text-slate-300">This scene couldn't be drawn.</div>
            <div className="mt-1 text-xs text-slate-500">
              The lesson continues — the next visualization will replace it.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
