import type { GraphVisual } from "../types";

const LETTERS = "ABCDEFGH";

export default function GraphView({ visual }: { visual: GraphVisual }) {
  const { vertexCount, edges } = visual;
  const cx = 90;
  const cy = 90;
  const r = 65;
  const points = Array.from({ length: vertexCount }, (_, i) => {
    const angle = (2 * Math.PI * i) / vertexCount - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number];
  });

  return (
    <svg viewBox="0 0 180 180" className="h-44 w-44 text-primary">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={points[a][0]}
          y1={points[a][1]}
          x2={points[b][0]}
          y2={points[b][1]}
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="2"
        />
      ))}
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill="currentColor" />
          <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-primary-foreground text-[10px] font-semibold">
            {LETTERS[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}
