import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CanvasCard from "./CanvasCard";
import TurnBody from "./TurnBody";
import { groupIntoTurns, type CanvasMessage } from "@/lib/sessionTurns";

export type { CanvasMessage };

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Rect of the newest card, so the page can bring just that into view on a new turn. */
  latest: { x: number; y: number; w: number; h: number } | null;
}

interface Placement {
  x: number;
  y: number;
  w: number;
  /** True once the student has dragged this card, which freezes it out of the auto-column. */
  detached: boolean;
}

const ESTIMATED_HEIGHT = 200;

interface Props {
  messages: CanvasMessage[];
  cleanText: (raw: string) => string;
  vizByMessageIndex: Map<number, string>;
  activeVizId: string | null;
  onSelectViz: (vizId: string) => void;
  scale: number;
  pending: ReactNode;
  onBoundsChange: (bounds: ContentBounds) => void;
  cardRefs: React.MutableRefObject<Map<number, { x: number; y: number; w: number; h: number }>>;
  onSaveNote: (assistantIndex: number) => void;
  isStreaming: boolean;
  /** Card width and stacking gap, from the student's density preference. */
  defaultWidth: number;
  gap: number;
  revealRate: number;
}

/**
 * Turn cards placed in canvas space.
 *
 * New cards drop into a single auto-flowing column so the student never has to arrange anything to
 * read a lesson — but the moment one is dragged it detaches and keeps its position, so the canvas
 * can be pulled apart into whatever spatial arrangement makes sense (worked example beside the
 * theory it uses, say). Auto-flow is the default; free placement is the escape hatch.
 */
export default function SessionCanvas({
  messages, cleanText, vizByMessageIndex, activeVizId, onSelectViz, scale, pending, onBoundsChange,
  cardRefs, onSaveNote, isStreaming, defaultWidth, gap, revealRate,
}: Props) {
  const turns = useMemo(() => groupIntoTurns(messages), [messages]);
  const lastAssistantIndex = useMemo(
    () => messages.reduce((acc, m, i) => (m.role === "assistant" ? i : acc), -1),
    [messages],
  );

  const [placements, setPlacements] = useState<Record<number, Placement>>({});
  const [heights, setHeights] = useState<Record<number, number>>({});

  // Auto-column: every non-detached card stacks under the one before it, using measured heights so
  // a long explanation pushes the next card down instead of overlapping it.
  const resolved = useMemo(() => {
    const out: Record<number, Placement & { h: number }> = {};
    let cursorY = 0;
    for (const turn of turns) {
      const custom = placements[turn.key];
      const h = heights[turn.key] ?? ESTIMATED_HEIGHT;
      if (custom?.detached) {
        out[turn.key] = { ...custom, h };
        continue;
      }
      out[turn.key] = { x: 0, y: cursorY, w: custom?.w ?? defaultWidth, detached: false, h };
      cursorY += h + gap;
    }
    return out;
  }, [turns, placements, heights, defaultWidth, gap]);

  // Publish geometry upward for fit-to-view and new-turn focus.
  const onBoundsRef = useRef(onBoundsChange);
  onBoundsRef.current = onBoundsChange;
  useEffect(() => {
    const entries = Object.entries(resolved);
    cardRefs.current = new Map(entries.map(([k, p]) => [Number(k), { x: p.x, y: p.y, w: p.w, h: p.h }]));
    if (entries.length === 0) {
      onBoundsRef.current({ minX: 0, minY: 0, maxX: 0, maxY: 0, latest: null });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [, p] of entries) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.w);
      maxY = Math.max(maxY, p.y + p.h);
    }
    const lastTurn = turns[turns.length - 1];
    const last = lastTurn ? resolved[lastTurn.key] : null;
    onBoundsRef.current({
      minX, minY, maxX, maxY,
      latest: last ? { x: last.x, y: last.y, w: last.w, h: last.h } : null,
    });
  }, [resolved, turns, cardRefs]);

  const move = useCallback((key: number, x: number, y: number, w: number) => {
    setPlacements((prev) => ({ ...prev, [key]: { x, y, w, detached: true } }));
  }, []);

  const resize = useCallback((key: number, w: number) => {
    setPlacements((prev) => {
      const existing = prev[key];
      return { ...prev, [key]: { x: existing?.x ?? 0, y: existing?.y ?? 0, w, detached: existing?.detached ?? false } };
    });
  }, []);

  const measure = useCallback((key: number, h: number) => {
    setHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
  }, []);

  return (
    <>
      {turns.map((turn) => {
        const p = resolved[turn.key];
        if (!p) return null;
        const { assistantIndex } = turn;
        const isLive = assistantIndex !== null && assistantIndex === lastAssistantIndex;
        const vizId = assistantIndex !== null ? vizByMessageIndex.get(assistantIndex) : undefined;

        return (
          <CanvasCard
            key={turn.key}
            x={p.x}
            y={p.y}
            width={p.w}
            scale={scale}
            dimmed={!isLive}
            label={isLive ? "Now" : undefined}
            onMove={(x, y) => move(turn.key, x, y, p.w)}
            onResize={(w) => resize(turn.key, w)}
            onMeasure={(h) => measure(turn.key, h)}
          >
            <TurnBody
              turn={turn}
              messages={messages}
              cleanText={cleanText}
              vizId={vizId}
              onStage={!!vizId && vizId === activeVizId}
              onSelectViz={onSelectViz}
              onSaveNote={onSaveNote}
              streaming={isStreaming && isLive}
              revealRate={revealRate}
            />
          </CanvasCard>
        );
      })}

      {pending}
    </>
  );
}
