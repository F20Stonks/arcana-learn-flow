interface Props {
  onSubmit: (regionCode: string) => void;
}

// Geometry owned entirely by this component — the generator only needs to know the bit encoding
// (A,B,C membership as '0'/'1'), never these coordinates. Hit-testing is plain distance-to-center
// math against a click point, not precomputed intersection paths, so it can't drift out of sync
// with what's drawn.
const R = 78;
const CENTERS: Record<"A" | "B" | "C", [number, number]> = {
  A: [118, 96],
  B: [182, 96],
  C: [150, 156],
};
const VIEW_W = 300;
const VIEW_H = 240;

function regionFromPoint(x: number, y: number): string {
  const inCircle = (c: [number, number]) => Math.hypot(x - c[0], y - c[1]) <= R;
  return [inCircle(CENTERS.A) ? "1" : "0", inCircle(CENTERS.B) ? "1" : "0", inCircle(CENTERS.C) ? "1" : "0"].join("");
}

export default function VennDiagramInput({ onSubmit }: Props) {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    onSubmit(regionFromPoint(x, y));
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-56 w-full max-w-[300px] cursor-pointer"
        onClick={handleClick}
        role="img"
        aria-label="Three-circle Venn diagram, tap a region"
      >
        <circle cx={CENTERS.A[0]} cy={CENTERS.A[1]} r={R} fill="var(--accent)" fillOpacity="0.28" stroke="var(--primary)" strokeWidth="1.5" />
        <circle cx={CENTERS.B[0]} cy={CENTERS.B[1]} r={R} fill="var(--accent)" fillOpacity="0.28" stroke="var(--primary)" strokeWidth="1.5" />
        <circle cx={CENTERS.C[0]} cy={CENTERS.C[1]} r={R} fill="var(--accent)" fillOpacity="0.28" stroke="var(--primary)" strokeWidth="1.5" />
        <text x={CENTERS.A[0] - 58} y={CENTERS.A[1] - 48} className="fill-foreground text-sm font-semibold">A</text>
        <text x={CENTERS.B[0] + 46} y={CENTERS.B[1] - 48} className="fill-foreground text-sm font-semibold">B</text>
        <text x={CENTERS.C[0] - 6} y={CENTERS.C[1] + 82} className="fill-foreground text-sm font-semibold">C</text>
        <rect x="4" y="4" width={VIEW_W - 8} height={VIEW_H - 8} fill="none" stroke="var(--border)" strokeWidth="1" rx="8" />
      </svg>
      <p className="text-xs text-muted-foreground">Tap inside the diagram — outside all three circles is a valid answer too.</p>
    </div>
  );
}
