import { useMemo, useState } from "react";
import Scene3D from "./Scene3D";
import SceneErrorBoundary from "./SceneErrorBoundary";
import type { SceneSpec } from "@/lib/sceneSpec";
import { loadVizTheme } from "@/lib/vizThemes";

interface Props {
  scene: SceneSpec;
  /**
   * "stem" — full-width diagram sitting under the question text, inside the
   * question card. "option" — compact tile meant to sit INSIDE an MCQ option
   * button (graph-matching questions), so it deliberately carries no border/
   * card chrome of its own — the surrounding button already owns the
   * selected/hover border, and doubling it up would look like a card-in-a-card.
   */
  variant?: "stem" | "option";
  className?: string;
}

/**
 * Compact, read-mostly rendering of an AI-attached question/option diagram —
 * reuses the exact same Scene3D renderer (and the params/theme/error-boundary
 * plumbing InsightPreview already established for the Notes page) so a
 * generated question's diagram is exactly as alive and visually consistent as
 * every other visualization in the app. Deliberately has no delete affordance
 * and no title bar: those belong to the caller's own chrome (the question
 * card, or the MCQ option button).
 */
export default function QuestionDiagram({ scene, variant = "stem", className = "" }: Props) {
  const theme = useMemo(loadVizTheme, []);

  const initialParams = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    (scene.sliders ?? []).forEach((s) => { out[s.key] = s.default; });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [params, setParams] = useState(initialParams);

  const height = variant === "option" ? "h-36 sm:h-40" : "h-56";

  return (
    <div className={`relative w-full ${height} rounded-lg overflow-hidden bg-background ${className}`}>
      <SceneErrorBoundary resetKey={scene}>
        <Scene3D
          spec={scene}
          params={params}
          onParam={(key, value) => setParams((p) => ({ ...p, [key]: value }))}
          theme={theme}
        />
      </SceneErrorBoundary>
    </div>
  );
}
