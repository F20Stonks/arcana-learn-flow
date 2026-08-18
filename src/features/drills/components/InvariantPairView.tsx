import type { InvariantPairVisual } from "../types";
import SurfaceGlyph from "./SurfaceGlyph";

export default function InvariantPairView({ visual }: { visual: InvariantPairVisual }) {
  return (
    <div className="flex items-center gap-6">
      <SurfaceGlyph spec={visual.left} />
      <span className="text-sm font-medium text-muted-foreground">vs</span>
      <SurfaceGlyph spec={visual.right} />
    </div>
  );
}
