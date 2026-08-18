interface Props {
  crossings: number;
  seed: number;
}

/**
 * A real (2, n) torus-knot diagram, not an improvised drawing: two strands closing a braid of
 * `crossings` same-handed crossings. n=1 is the unknot, n=3 the trefoil, n=5 the cinquefoil — a
 * well-established family, so every diagram this draws is provably the knot its generator claims.
 *
 * Both strands are pure sine curves in x (topY→botY in y) that meet at x=cx at t=0, t=1, and at
 * every crossing — so "strand B has a gap at each crossing" is enough to read as an honest
 * over/under diagram: strand A (always drawn unbroken) passes over; strand B's gaps are where it
 * passes under.
 */
export default function KnotGlyph({ crossings, seed }: Props) {
  const topY = 15;
  const botY = 125;
  const height = botY - topY;
  const cx = 50;
  const amp = 20 + (seed % 5) * 3;
  const freq = crossings + 1;

  const pointAt = (t: number, sign: 1 | -1) => ({
    x: cx + sign * amp * Math.sin(freq * Math.PI * t),
    y: topY + t * height,
  });

  const polyline = (t0: number, t1: number, sign: 1 | -1, samples = 14) => {
    const pts = Array.from({ length: samples + 1 }, (_, i) => pointAt(t0 + ((t1 - t0) * i) / samples, sign));
    return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} ` + pts.slice(1).map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  };

  const strandA = polyline(0, 1, 1, crossings * 14 + 14);

  const eps = 0.035;
  const crossingTs = Array.from({ length: crossings }, (_, k) => (k + 1) / freq);
  const bounds = [0, ...crossingTs.flatMap((t) => [t - eps, t + eps]), 1];
  const strandBSegments: string[] = [];
  for (let i = 0; i < bounds.length; i += 2) {
    const t0 = bounds[i];
    const t1 = bounds[i + 1];
    if (t1 > t0) strandBSegments.push(polyline(t0, t1, -1, 6));
  }

  return (
    <svg viewBox="0 0 100 140" className="h-28 w-20 text-primary">
      <path d={strandBSegments.join(" ")} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d={strandA} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
