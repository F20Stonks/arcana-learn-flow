/**
 * OBSIDIAN INSTRUMENT — progress ring.
 * Thin hairline track, luminous cyan arc, mono readout. Animates on mount.
 */
import { useEffect, useState } from "react";

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  stroke?: number;
}

export default function ProgressRing({ value, size = 44, stroke = 2.5 }: ProgressRingProps) {
  const [display, setDisplay] = useState(0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    const t = requestAnimationFrame(() => setDisplay(value));
    return () => cancelAnimationFrame(t);
  }, [value]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: "var(--border)" }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * display) / 100}
          style={{
            stroke: value > 0 ? "var(--primary)" : "var(--border)",
            transition: "stroke-dashoffset 900ms cubic-bezier(0.23, 1, 0.32, 1)",
            filter: value > 0 ? "drop-shadow(0 0 4px color-mix(in oklab, var(--primary) 50%, transparent))" : undefined,
          }}
        />
      </svg>
      <span className="readout absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
        {value}%
      </span>
    </div>
  );
}
