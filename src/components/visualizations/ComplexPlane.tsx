import { ComplexPlaneProps } from "./types";

/**
 * Interactive Complex Plane (Argand diagram).
 * Shows complex numbers as points, with optional vectors.
 */
export default function ComplexPlane({
  points,
  vectors,
  showGrid = true,
  range = [-5, 5],
  width = 400,
  height = 400,
  title,
  className = "",
}: ComplexPlaneProps) {
  const padding = 40;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;
  const span = range[1] - range[0];

  const toX = (v: number) => padding + ((v - range[0]) / span) * plotW;
  const toY = (v: number) => padding + ((range[1] - v) / span) * plotH;

  const gridLines = [];
  for (let i = Math.ceil(range[0]); i <= Math.floor(range[1]); i++) {
    gridLines.push(i);
  }

  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      {title && <p className="text-xs font-medium text-foreground mb-3">{title}</p>}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
        {/* Grid */}
        {showGrid && gridLines.map((v) => (
          <g key={v}>
            <line x1={toX(v)} y1={padding} x2={toX(v)} y2={height - padding}
              stroke="hsl(0,0%,15%)" strokeWidth="0.5" />
            <line x1={padding} y1={toY(v)} x2={width - padding} y2={toY(v)}
              stroke="hsl(0,0%,15%)" strokeWidth="0.5" />
          </g>
        ))}

        {/* Axes */}
        <line x1={toX(range[0])} y1={toY(0)} x2={toX(range[1])} y2={toY(0)}
          stroke="hsl(0,0%,30%)" strokeWidth="1.5" />
        <line x1={toX(0)} y1={toY(range[0])} x2={toX(0)} y2={toY(range[1])}
          stroke="hsl(0,0%,30%)" strokeWidth="1.5" />

        {/* Axis labels */}
        <text x={width - padding + 5} y={toY(0) + 4} style={{ fontSize: "10px", fill: "hsl(0,0%,53%)" }}>Re</text>
        <text x={toX(0) + 5} y={padding - 8} style={{ fontSize: "10px", fill: "hsl(0,0%,53%)" }}>Im</text>

        {/* Tick labels */}
        {gridLines.filter(v => v !== 0).map((v) => (
          <g key={`tick-${v}`}>
            <text x={toX(v)} y={toY(0) + 14} textAnchor="middle" style={{ fontSize: "8px", fill: "hsl(0,0%,40%)" }}>{v}</text>
            <text x={toX(0) - 10} y={toY(v) + 3} textAnchor="end" style={{ fontSize: "8px", fill: "hsl(0,0%,40%)" }}>{v}i</text>
          </g>
        ))}

        {/* Vectors */}
        {vectors?.map((vec, i) => (
          <g key={`vec-${i}`}>
            <line
              x1={toX(vec.origin.x)} y1={toY(vec.origin.y)}
              x2={toX(vec.direction.x)} y2={toY(vec.direction.y)}
              stroke={vec.color || "hsl(239,84%,67%)"}
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          </g>
        ))}

        {/* Points */}
        {points.map((p, i) => {
          const cx = toX(p.real);
          const cy = toY(p.imaginary);
          const color = p.color || "hsl(239,84%,67%)";

          return (
            <g key={i}>
              {/* Dashed lines to axes */}
              <line x1={cx} y1={cy} x2={cx} y2={toY(0)} stroke={color} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
              <line x1={cx} y1={cy} x2={toX(0)} y2={cy} stroke={color} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
              
              {/* Glow */}
              <circle cx={cx} cy={cy} r={8} fill={color} opacity="0.15" />
              {/* Point */}
              <circle cx={cx} cy={cy} r={4} fill={color} stroke="hsl(0,0%,7%)" strokeWidth="1.5" />
              {/* Label */}
              {p.label && (
                <text x={cx + 8} y={cy - 8} style={{ fontSize: "10px", fill: color, fontWeight: 500 }}>
                  {p.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="hsl(239,84%,67%)" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
