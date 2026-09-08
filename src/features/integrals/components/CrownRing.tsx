/**
 * The ring around a path node: how many of a skill's five crowns are in.
 *
 * An SVG arc rather than a conic-gradient, for two reasons — the arc can be given a real cap and a
 * real stroke width that scale with the node, and the whole thing stays one element that inherits
 * `currentColor`, so the caller decides gold-vs-primary without this component knowing anything
 * about the theme.
 */
interface Props {
  /** Crowns earned. */
  value: number;
  /** Crowns available — MAX_CROWN in practice. */
  max: number;
  size: number;
  /** Stroke width in px. */
  width?: number;
  className?: string;
}

export default function CrownRing({ value, max, size, width = 3, className = "" }: Props) {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  const fraction = max > 0 ? Math.max(0, Math.min(value / max, 1)) : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
      // The arc starts at twelve o'clock and runs clockwise, which is the direction every
      // progress ring in every app runs; the default SVG start is three o'clock.
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={width}
        className="stroke-border"
      />
      {fraction > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={width}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={`${c * fraction} ${c}`}
          style={{ transition: "stroke-dasharray 420ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      )}
    </svg>
  );
}
