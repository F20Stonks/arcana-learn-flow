import { useRef, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Minus, type LucideIcon } from "lucide-react";

export interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  rect: PanelRect;
  onRectChange: (rect: PanelRect) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  title: string;
  icon: LucideIcon;
  /** Which way the panel grows when resized. Right-docked panels grow leftward so they never push
   *  themselves off the screen; left-docked ones grow rightward. */
  side?: "left" | "right";
  minW?: number;
  minH?: number;
  /** Quiet trailing text in the title bar — a count, a status. */
  meta?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  zIndex?: number;
  onFocus?: () => void;
  /** Take the panel out of the workspace entirely. It reappears as a pill in the dock, not gone. */
  onMinimize?: () => void;
  /** True while this panel is the one expanded over the workspace. The rect is supplied by the
   *  parent, so the expansion is a normal rect change and animates like any other. */
  maximized?: boolean;
  onToggleMaximized?: () => void;
}

/**
 * The one movable, resizable, collapsible window used by every session panel — stage, notes,
 * navigator, log.
 *
 * Written once rather than per-panel because "I can't resize this" was never really about one
 * panel: a workspace where some things move and others don't teaches the student not to try. Every
 * panel here has the same grammar — drag the title bar, drag an edge or the corner, click the
 * chevron to fold it away — so the behaviour is learned once and then assumed everywhere.
 */
export default function FloatingPanel({
  rect, onRectChange, collapsed, onToggleCollapsed, title, icon: Icon,
  side = "right", minW = 260, minH = 180, meta, headerActions, children, zIndex = 40, onFocus,
  onMinimize, maximized = false, onToggleMaximized,
}: Props) {
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const size = useRef<{ id: number; sx: number; sy: number; ow: number; oh: number; ox: number; mode: string } | null>(null);

  const frameOf = (el: HTMLElement) => el.closest("[data-canvas-frame]") as HTMLElement | null;

  const startDrag = (e: React.PointerEvent) => {
    // A maximized panel is parked, not placed: dragging it would only mean dragging it back.
    if (e.button !== 0 || maximized) return;
    e.stopPropagation();
    onFocus?.();
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: rect.x, oy: rect.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const frame = frameOf(e.currentTarget as HTMLElement);
    const maxX = (frame?.clientWidth ?? window.innerWidth) - rect.w - 8;
    const maxY = (frame?.clientHeight ?? window.innerHeight) - 56;
    onRectChange({
      ...rect,
      // Clamped so a panel can never be dragged somewhere it can't be dragged back from.
      x: Math.min(Math.max(8, d.ox + (e.clientX - d.sx)), Math.max(8, maxX)),
      y: Math.min(Math.max(8, d.oy + (e.clientY - d.sy)), Math.max(8, maxY)),
    });
  };

  const endPointer = (ref: React.MutableRefObject<{ id: number } | null>) => (e: React.PointerEvent) => {
    if (ref.current?.id !== e.pointerId) return;
    ref.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* gone */ }
  };

  const startSize = (mode: string) => (e: React.PointerEvent) => {
    if (e.button !== 0 || maximized) return;
    e.stopPropagation();
    onFocus?.();
    size.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ow: rect.w, oh: rect.h, ox: rect.x, mode };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveSize = (e: React.PointerEvent) => {
    const s = size.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    let { w, h, x } = { w: s.ow, h: s.oh, x: s.ox };

    if (s.mode.includes("w")) {
      // Growing a right-docked panel means dragging its LEFT edge outward, which moves x too.
      if (side === "right") {
        w = Math.max(minW, s.ow - dx);
        x = s.ox + (s.ow - w);
      } else {
        w = Math.max(minW, s.ow + dx);
      }
    }
    if (s.mode.includes("h")) h = Math.max(minH, s.oh + dy);
    onRectChange({ ...rect, w, h, x });
  };

  const busy = !!drag.current || !!size.current;
  const edgeClass = side === "right" ? "left-0" : "right-0";

  return (
    <div
      onPointerDown={() => onFocus?.()}
      data-panel={title}
      className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border bg-card/80 backdrop-blur-2xl ${
        maximized
          ? "border-border/80 shadow-[0_8px_24px_rgba(0,0,0,0.24),0_48px_96px_-32px_rgba(0,0,0,0.7)]"
          : "border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.18),0_24px_56px_-20px_rgba(0,0,0,0.6)]"
      }`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: collapsed ? undefined : rect.h,
        zIndex,
        // Position transitions too, so maximizing reads as this panel growing out of where it sat
        // rather than a dialog appearing over the top of it.
        transition: busy
          ? "none"
          : "height 320ms var(--ease-out), width 320ms var(--ease-out), left 320ms var(--ease-out), top 320ms var(--ease-out)",
      }}
    >
      <div
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endPointer(drag)}
        onPointerCancel={endPointer(drag)}
        className={`flex shrink-0 items-center gap-2.5 px-3.5 py-2.5 ${
          maximized ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary/75" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-tight text-foreground">{title}</span>
        {meta && <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">{meta}</span>}
        <div onPointerDown={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-0.5">
          {headerActions}
          {onToggleMaximized && (
            <button
              onClick={onToggleMaximized}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={maximized ? `Restore ${title} (Esc)` : `Expand ${title}`}
              aria-label={maximized ? `Restore ${title}` : `Expand ${title}`}
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            onClick={onToggleCollapsed}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={collapsed ? `Show ${title}` : `Fold ${title}`}
            aria-label={collapsed ? `Show ${title}` : `Fold ${title}`}
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={`Put ${title} away — it stays in the dock below`}
              aria-label={`Minimize ${title}`}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

          {/* Edge + corner handles. Invisible until the panel is hovered — present when reached for,
              silent while reading. Withdrawn entirely while maximized: the size is the workspace's
              to give back, not the pointer's to fight with. */}
          {!maximized && (
          <>
          <div
            onPointerDown={startSize("w")}
            onPointerMove={moveSize}
            onPointerUp={endPointer(size)}
            onPointerCancel={endPointer(size)}
            className={`absolute ${edgeClass} top-8 bottom-6 w-1.5 cursor-ew-resize bg-primary/0 transition-colors hover:bg-primary/40`}
            title="Drag to resize"
          />
          <div
            onPointerDown={startSize("h")}
            onPointerMove={moveSize}
            onPointerUp={endPointer(size)}
            onPointerCancel={endPointer(size)}
            className="absolute inset-x-6 bottom-0 h-1.5 cursor-ns-resize bg-primary/0 transition-colors hover:bg-primary/40"
            title="Drag to resize"
          />
          <div
            onPointerDown={startSize("wh")}
            onPointerMove={moveSize}
            onPointerUp={endPointer(size)}
            onPointerCancel={endPointer(size)}
            className={`absolute bottom-0 ${edgeClass} h-4 w-4 ${side === "right" ? "cursor-nesw-resize" : "cursor-nwse-resize"}`}
            title="Drag to resize"
          >
            <div className={`absolute bottom-1.5 ${side === "right" ? "left-1.5" : "right-1.5"} h-1.5 w-1.5 rounded-full bg-muted-foreground/25 transition-colors hover:bg-primary/70`} />
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
