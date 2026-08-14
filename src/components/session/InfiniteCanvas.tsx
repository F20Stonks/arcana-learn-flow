import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Minus, Plus, Maximize } from "lucide-react";
import { clampScale, type Viewport } from "@/lib/canvasViewport";

interface Props {
  viewport: Viewport;
  onViewportChange: (next: Viewport) => void;
  /** Absolutely-positioned children, laid out in canvas coordinates. */
  children: ReactNode;
  /** Called when the user asks to frame the content (button or double-click on empty space). */
  onFit: () => void;
  /** Floating UI that must NOT pan or zoom — command bar, stage, log. */
  overlay?: ReactNode;
  /** Measured command-bar height. Below `lg` the bar spans nearly the full width, so the zoom pill
   *  has to sit above it; from `lg` up the bar is a centred column and the corner is free. */
  bottomInset: number;
}

/**
 * A pannable, zoomable surface. Children are positioned in canvas space; this component owns the
 * single transform that maps canvas space to screen space.
 *
 * The whole point is spatial freedom: the session is a place you move around in, not a column you
 * scroll. Panning is the default drag gesture on empty space, wheel scrolls the canvas, and
 * ctrl/⌘+wheel (or pinch) zooms about the pointer rather than the origin — zooming about the origin
 * is the thing that makes home-made canvases feel broken, because the point you were looking at
 * slides away as you zoom.
 */
export default function InfiniteCanvas({ viewport, onViewportChange, children, onFit, overlay, bottomInset }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  // Panning is tracked in refs, not state: a pan updates on every pointermove and re-rendering the
  // whole card tree at pointer frequency drops frames badly once scenes are mounted.
  const panning = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const zoomAbout = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vp = viewportRef.current;
      const next = clampScale(vp.scale * factor);
      if (next === vp.scale) return;
      // Keep the canvas point under the cursor fixed on screen.
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const ratio = next / vp.scale;
      onViewportChange({
        x: px - (px - vp.x) * ratio,
        y: py - (py - vp.y) * ratio,
        scale: next,
      });
    },
    [onViewportChange],
  );

  // Wheel must be a non-passive native listener: React's onWheel is registered passively, so
  // preventDefault() there is ignored and ctrl+wheel zooms the whole browser page instead.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAbout(e.clientX, e.clientY, e.deltaY < 0 ? 1.08 : 1 / 1.08);
        return;
      }
      const vp = viewportRef.current;
      onViewportChange({ ...vp, x: vp.x - e.deltaX, y: vp.y - e.deltaY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAbout, onViewportChange]);

  const onPointerDown = (e: React.PointerEvent) => {
    // Only empty canvas starts a pan — a card's own drag handle stops propagation before this.
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    const vp = viewportRef.current;
    panning.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: vp.x, originY: vp.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = panning.current;
    if (!p || p.pointerId !== e.pointerId) return;
    onViewportChange({
      ...viewportRef.current,
      x: p.originX + (e.clientX - p.startX),
      y: p.originY + (e.clientY - p.startY),
    });
  };

  const endPan = (e: React.PointerEvent) => {
    if (panning.current?.pointerId !== e.pointerId) return;
    panning.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
  };

  const pct = Math.round(viewport.scale * 100);

  return (
    <div ref={frameRef} className="absolute inset-0 overflow-hidden">
      {/* Dot grid, translated and scaled with the viewport so the surface reads as a real place
          you are moving over rather than a static backdrop. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: "var(--sx-grid, 0.35)",
          backgroundImage: "radial-gradient(circle, var(--rule-strong) 1px, transparent 1px)",
          backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />

      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) onFit();
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
            // Panning is continuous, so a transition here would fight the pointer. Programmatic
            // moves (fit, focus-new-turn) re-enable it via the data attribute below.
            transition: panning.current ? "none" : "transform 420ms var(--ease-out)",
          }}
        >
          {children}
        </div>
      </div>

      {overlay}

      {/* Zoom control, bottom-right — the conventional home for it, and it doubles as the readout
          that tells you why things look small after a pinch. */}
      <div
        style={{ bottom: bottomInset }}
        className="absolute right-4 z-30 flex items-center gap-0.5 rounded-full border border-border/70 bg-card/80 p-1 shadow-lg backdrop-blur-xl lg:!bottom-4"
      >
        <button
          onClick={() => zoomAbout(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.2)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onFit}
          className="min-w-[3.25rem] rounded-full px-2 py-1 text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-accent"
          title="Fit to view"
        >
          {pct}%
        </button>
        <button
          onClick={() => zoomAbout(window.innerWidth / 2, window.innerHeight / 2, 1.2)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button
          onClick={onFit}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Fit to view"
          aria-label="Fit to view"
        >
          <Maximize className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
