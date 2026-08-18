import type { KnotPairVisual } from "../types";
import KnotGlyph from "./KnotGlyph";

export default function KnotPairView({ visual }: { visual: KnotPairVisual }) {
  return (
    <div className="flex items-center gap-8">
      <KnotGlyph crossings={visual.left.crossings} seed={visual.left.seed} />
      <span className="text-sm font-medium text-muted-foreground">vs</span>
      <KnotGlyph crossings={visual.right.crossings} seed={visual.right.seed} />
    </div>
  );
}
