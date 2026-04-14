import { UnitCircleProps } from "./types";

/**
 * Interactive Unit Circle showing sin/cos/tan for a given angle.
 */
export default function UnitCircle({
  angle,
  showSin = true,
  showCos = true,
  showTan = false,
  width = 360,
  height = 360,
  title,
  className = "",
}: UnitCircleProps) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(cx, cy) - 50;

  const px = cx + r * Math.cos(angle);
  const py = cy - r * Math.sin(angle);
  const sinVal = Math.sin(angle);
  const cosVal = Math.cos(angle);
  const angleDeg = ((angle * 180) / Math.PI).toFixed(1);

  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      {title && <p className="text-xs font-medium text-foreground mb-3">{title}</p>}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
        {/* Axes */}
        <line x1={30} y1={cy} x2={width - 30} y2={cy} stroke="hsl(0,0%,25%)" strokeWidth="1" />
        <line x1={cx} y1={30} x2={cx} y2={height - 30} stroke="hsl(0,0%,25%)" strokeWidth="1" />

        {/* Circle */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(0,0%,20%)" strokeWidth="1.5" />

        {/* Angle arc */}
        <path
          d={describeArc(cx, cy, 25, 0, angle)}
          fill="none"
          stroke="hsl(239,84%,67%)"
          strokeWidth="1.5"
        />
        <text
          x={cx + 32 * Math.cos(angle / 2)}
          y={cy - 32 * Math.sin(angle / 2)}
          style={{ fontSize: "9px", fill: "hsl(239,84%,67%)" }}
          textAnchor="middle"
        >
          {angleDeg}°
        </text>

        {/* Radius line */}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="hsl(0,0%,80%)" strokeWidth="2" />

        {/* Sin line */}
        {showSin && (
          <>
            <line x1={px} y1={cy} x2={px} y2={py} stroke="hsl(0,84%,60%)" strokeWidth="2" />
            <text x={px + 8} y={(cy + py) / 2} style={{ fontSize: "9px", fill: "hsl(0,84%,60%)" }}>
              sin = {sinVal.toFixed(3)}
            </text>
          </>
        )}

        {/* Cos line */}
        {showCos && (
          <>
            <line x1={cx} y1={cy} x2={px} y2={cy} stroke="hsl(142,71%,45%)" strokeWidth="2" />
            <text x={(cx + px) / 2} y={cy + 16} textAnchor="middle" style={{ fontSize: "9px", fill: "hsl(142,71%,45%)" }}>
              cos = {cosVal.toFixed(3)}
            </text>
          </>
        )}

        {/* Tan line */}
        {showTan && Math.abs(cosVal) > 0.01 && (
          <>
            <line
              x1={cx + r} y1={cy}
              x2={cx + r} y2={cy - r * Math.tan(angle)}
              stroke="hsl(38,92%,50%)" strokeWidth="2"
            />
            <text x={cx + r + 8} y={cy - (r * Math.tan(angle)) / 2} style={{ fontSize: "9px", fill: "hsl(38,92%,50%)" }}>
              tan = {Math.tan(angle).toFixed(3)}
            </text>
          </>
        )}

        {/* Point */}
        <circle cx={px} cy={py} r={5} fill="hsl(239,84%,67%)" stroke="hsl(0,0%,7%)" strokeWidth="2" />

        {/* Axis labels */}
        <text x={width - 25} y={cy - 8} style={{ fontSize: "9px", fill: "hsl(0,0%,40%)" }}>1</text>
        <text x={25} y={cy - 8} style={{ fontSize: "9px", fill: "hsl(0,0%,40%)" }}>-1</text>
        <text x={cx + 5} y={35} style={{ fontSize: "9px", fill: "hsl(0,0%,40%)" }}>1</text>
        <text x={cx + 5} y={height - 25} style={{ fontSize: "9px", fill: "hsl(0,0%,40%)" }}>-1</text>
      </svg>
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = { x: cx + r * Math.cos(startAngle), y: cy - r * Math.sin(startAngle) };
  const end = { x: cx + r * Math.cos(endAngle), y: cy - r * Math.sin(endAngle) };
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
