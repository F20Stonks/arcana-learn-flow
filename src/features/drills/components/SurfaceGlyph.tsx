import type { SurfaceGlyphSpec } from "../types";

const BLOB = "M50,8 C74,8 90,26 90,50 C90,74 74,92 50,92 C26,92 10,74 10,50 C10,26 26,8 50,8 Z";

const HOLE_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [
    [36, 50],
    [64, 50],
  ],
};

function ellipseSubpath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx},${cy} A${rx},${ry} 0 1,0 ${cx + rx},${cy} A${rx},${ry} 0 1,0 ${cx - rx},${cy} Z`;
}

/**
 * 'holes' renders genus visually (a blob with N cut-out holes, via evenodd fill on one <path> —
 * outer blob subpath plus one ellipse subpath per hole) — the same "count the holes" heuristic
 * used to introduce genus informally. Dashed outline marks "has a boundary" (disk/annulus) vs a
 * closed surface (sphere/torus/genus-2), a real and separate topological distinction.
 *
 * 'mobius' / 'klein' / 'rp2' are fixed hand-drawn glyphs — these three can't be embedded in the
 * plane without self-intersection (Möbius, Klein) or need boundary identification (RP²), so the
 * parametric hole-count trick doesn't apply to them.
 */
export default function SurfaceGlyph({ spec }: { spec: SurfaceGlyphSpec }) {
  if (spec.kind === "holes") {
    const holes = spec.holes ?? 0;
    const positions = HOLE_POSITIONS[holes] ?? [];
    const d = BLOB + " " + positions.map(([cx, cy]) => ellipseSubpath(cx, cy, 9, 11)).join(" ");
    return (
      <svg viewBox="0 0 100 100" className="h-20 w-20 text-primary">
        <path
          d={d}
          fill="currentColor"
          fillOpacity="0.22"
          fillRule="evenodd"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={spec.dashed ? "5 4" : undefined}
        />
      </svg>
    );
  }

  if (spec.kind === "mobius") {
    return (
      <svg viewBox="0 0 100 100" className="h-20 w-20 text-primary">
        <path
          d="M20,50 C20,30 40,30 50,50 C60,70 80,70 80,50 C80,30 60,30 50,50 C40,70 20,70 20,50 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeOpacity="0.3"
        />
        <path
          d="M20,50 C20,30 40,30 50,50 C60,70 80,70 80,50 C80,30 60,30 50,50 C40,70 20,70 20,50 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
      </svg>
    );
  }

  if (spec.kind === "klein") {
    return (
      <svg viewBox="0 0 100 100" className="h-20 w-20 text-primary">
        <path
          d="M50,8 C34,8 24,18 24,30 C24,42 33,47 40,50 C29,53 18,47 18,35 L18,68 C18,82 32,92 50,92 C68,92 82,82 82,68 C82,53 70,48 60,51 C69,55 76,64 76,50 L76,30 C76,18 66,8 50,8 Z"
          fill="currentColor"
          fillOpacity="0.18"
          fillRule="evenodd"
          stroke="currentColor"
          strokeWidth="2.2"
        />
      </svg>
    );
  }

  // rp2 — a disk with its boundary marked in three antipodal pairs (the standard "disk mod
  // antipodal identification" construction of the projective plane).
  const cx = 50;
  const cy = 50;
  const r = 34;
  const ticks = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 100 100" className="h-20 w-20 text-primary">
      <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="2.2" />
      {ticks.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = cx + Math.cos(rad) * (r - 7);
        const y1 = cy + Math.sin(rad) * (r - 7);
        const x2 = cx + Math.cos(rad) * (r + 2);
        const y2 = cy + Math.sin(rad) * (r + 2);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />;
      })}
    </svg>
  );
}
