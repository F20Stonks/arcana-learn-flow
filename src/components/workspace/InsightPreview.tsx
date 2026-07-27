import { useMemo, useState } from "react";
import { Box, Loader2, Trash2 } from "lucide-react";
import Scene3D from "./Scene3D";
import SceneErrorBoundary from "./SceneErrorBoundary";
import { isSceneSpec, type SceneSpec } from "@/lib/sceneSpec";
import type { SimulationPayload } from "@/lib/simulationPayload";
import { loadVizTheme } from "@/lib/vizThemes";

type Payload = SimulationPayload | SceneSpec;

interface Props {
  title: string;
  payload: Payload | null | undefined;
  onDelete?: () => void;
  deleting?: boolean;
}

/**
 * Compact, read-mostly rendering of a saved insight — reuses the same Scene3D renderer as the
 * Math Theater (full interactivity: orbit/zoom/drag sliders) rather than a static screenshot, so
 * a saved scene stays exactly as alive as it was in the session. Payload-less rows (saved before
 * this feature existed, or saved from the archetype/SimulationPayload path) degrade to a label —
 * never a crash.
 */
export default function InsightPreview({ title, payload, onDelete, deleting }: Props) {
  const scene = payload && isSceneSpec(payload) ? (payload as SceneSpec) : null;
  const theme = useMemo(loadVizTheme, []);

  const initialParams = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    (scene?.sliders ?? []).forEach((s) => { out[s.key] = s.default; });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [params, setParams] = useState(initialParams);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground truncate">{title}</span>
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Remove visualization"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {scene ? (
        <div className="relative h-56 bg-background">
          <SceneErrorBoundary resetKey={scene}>
            <Scene3D
              spec={scene}
              params={params}
              onParam={(key, value) => setParams((p) => ({ ...p, [key]: value }))}
              theme={theme}
            />
          </SceneErrorBoundary>
        </div>
      ) : (
        <div className="h-20 flex items-center justify-center gap-2 text-muted-foreground">
          <Box className="h-4 w-4" />
          <span className="text-xs">Saved before visual playback was supported</span>
        </div>
      )}
    </div>
  );
}
