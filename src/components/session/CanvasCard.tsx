import { useEffect, useRef, type ReactNode } from "react";
import { GripHorizontal } from "lucide-react";

interface Props {
  x: number;
  y: number;
  width: number;
  scale: number;
  /** Quiet label in the drag strip — "You asked", "Step 3", etc. */
  label?: ReactNode;
  /** Muted styling for turns that aren't the live one. */
  dimmed?: boolean;
  onMove: (x: number, y: number) => void;
  onResize: (width: number) => void;
  onMeasure?: (height: number) => void;
  children: ReactNode;
}

const MIN_WIDTH = 340;
const MAX_WIDTH = 1100;

/**
 * A card living in canvas space: absolutely positioned, dragged by its top strip, resized by its
 * right edge. Height is always content-driven — a learning card with a hand-set height would either
 * clip an explanation or leave a pool of dead space under it, and neither is ever what the student
 * wants. Width is the only dimension worth controlling, because that is what sets line length.
 *
 * Pointer deltas are divided by the canvas scale: at 50% zoom a 10px hand movement must move the
 * card 20px in canvas space, or dragging drifts away from the cursor.
 */
export default function CanvasCard({
  x, y, width, scale, label, dimmed, onMove, onResize, onMeasure, children,
}: Props) {
  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resize = useRef<{ pointerId: number; startX: number; originW: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(0);

  const measure = () => {
    const h = bodyRef.current?.parentElement?.offsetHeight ?? 0;
    if (h && h !== lastHeight.current) {
      lastHeight.current = h;
      onMeasure?.(h);
    }
  };

  /**
   * Report height continuously, not just after a resize drag.
   *
   * The auto-flow column stacks each card under the measured height of the one before it, so a card
   * that never reports lands on an estimate — and every turn longer than the estimate is drawn
   * straight through the next one. Height changes constantly here: on mount, as streamed text
   * arrives line by line, when KaTeX swaps a formula in, when the width is dragged. A ResizeObserver
   * is the only thing that catches all of those.
   */
  useEffect(() => {
    const el = bodyRef.current?.parentElement;
    if (!el) return;
    const report = () => {
      const h = el.offsetHeight;
      if (h && h !== lastHeight.current) {
        lastHeight.current = h;
        onMeasure?.(h);
      }
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasure]);

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: x, originY: y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    onMove(d.originX + (e.clientX - d.startX) / scale, d.originY + (e.clientY - d.startY) / scale);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* gone */ }
  };

  const startResize = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    resize.current = { pointerId: e.pointerId, startX: e.clientX, originW: width };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveResize = (e: React.PointerEvent) => {
    const r = resize.current;
    if (!r || r.pointerId !== e.pointerId) return;
    const next = r.originW + (e.clientX - r.startX) / scale;
    onResize(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
    measure();
  };

  const endResize = (e: React.PointerEvent) => {
    if (resize.current?.pointerId !== e.pointerId) return;
    resize.current = null;
    measure();
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* gone */ }
  };

  return (
    <div
      className="group absolute"
      style={{ left: x, top: y, width }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`relative rounded-2xl border bg-card/80 shadow-[0_1px_2px_rgba(0,0,0,0.12),0_12px_32px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-[border-color,opacity,box-shadow] duration-300 ${
          dimmed ? "border-border/40 opacity-[0.62] hover:opacity-100" : "border-border/80"
        }`}
      >
        {/* Drag strip. Deliberately near-invisible until hover: the affordance should be there when
            you reach for it and silent when you're reading. */}
        <div
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex cursor-grab items-center gap-2 rounded-t-2xl pt-3.5 pb-1 active:cursor-grabbing"
          style={{ paddingLeft: "var(--sx-pad, 24px)", paddingRight: "var(--sx-pad, 24px)" }}
        >
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/0 transition-colors duration-200 group-hover:text-muted-foreground/50" />
          {label && (
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
              {label}
            </span>
          )}
        </div>

        <div
          ref={bodyRef}
          className="pt-1"
          style={{
            paddingLeft: "var(--sx-pad, 24px)",
            paddingRight: "var(--sx-pad, 24px)",
            paddingBottom: "var(--sx-pad, 24px)",
          }}
        >
          {children}
        </div>

        {/* Width handle on the right edge — appears on hover, same restraint as the drag strip. */}
        <div
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          title="Drag to set width"
          className="absolute -right-1 top-1/2 h-16 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-primary/0 transition-colors duration-200 group-hover:bg-primary/25 hover:!bg-primary/60"
        />
      </div>
    </div>
  );
}
