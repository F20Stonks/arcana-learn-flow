/**
 * The "an answer is coming" card: a light running around the border and three shimmering lines
 * where the sentences will be.
 *
 * Shared by all three views so waiting looks the same wherever you are in the session. The caller
 * owns position and width; this owns only what the wait looks like.
 */
export default function ThinkingBlock({ animations = true }: { animations?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-px">
      {/* The looping light: a conic gradient rotating behind the card, visible only where the
          1px inset leaves it exposed — so it reads as a light running around the edge. */}
      <div
        className={`absolute left-1/2 top-1/2 h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2 ${
          animations ? "animate-orbit" : ""
        }`}
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, transparent 250deg, var(--primary) 320deg, transparent 360deg)",
        }}
      />
      <div
        className="relative rounded-2xl bg-card/90 backdrop-blur-xl"
        style={{ padding: "var(--sx-pad, 24px)" }}
      >
        <div className="space-y-2.5">
          {["82%", "94%", "61%"].map((w, i) => (
            <div key={w} className="relative h-2.5 overflow-hidden rounded-full bg-secondary/50" style={{ width: w }}>
              {animations && (
                <div
                  className="absolute inset-y-0 w-1/3 animate-sheen bg-linear-to-r from-transparent via-foreground/12 to-transparent"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
