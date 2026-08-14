import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import TurnBody from "./TurnBody";
import ThinkingBlock from "./ThinkingBlock";
import { groupIntoTurns, type CanvasMessage } from "@/lib/sessionTurns";

interface Props {
  messages: CanvasMessage[];
  cleanText: (raw: string) => string;
  vizByMessageIndex: Map<number, string>;
  activeVizId: string | null;
  onSelectViz: (vizId: string) => void;
  onSaveNote: (assistantIndex: number) => void;
  isStreaming: boolean;
  thinking: boolean;
  revealRate: number;
  animations: boolean;
  /** Column width in px, owned by the page so it survives a mode switch. */
  width: number;
  onWidthChange: (width: number) => void;
  maxWidth: number;
}

const MIN_WIDTH = 380;

/**
 * The session as an ordinary chat: one column, oldest at the top, newest at the bottom.
 *
 * Deliberately the plainest of the three views. Some lessons are just a conversation, and on those
 * a free canvas is ceremony — you want to read down the page and nothing else. What it keeps from
 * the canvas is control over line length: the column is dragged wider or narrower from either edge,
 * because the right measure for a wall of derivation is not the right measure for a quick exchange.
 */
export default function ChatColumn({
  messages, cleanText, vizByMessageIndex, activeVizId, onSelectViz, onSaveNote, isStreaming,
  thinking, revealRate, animations, width, onWidthChange, maxWidth,
}: Props) {
  const turns = useMemo(() => groupIntoTurns(messages), [messages]);
  const lastAssistantIndex = useMemo(
    () => messages.reduce((acc, m, i) => (m.role === "assistant" ? i : acc), -1),
    [messages],
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Follow the conversation down only while the student is already at the bottom. Yanking them back
  // from something they scrolled up to re-read is the classic chat-UI betrayal.
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
  };

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, thinking, width]);

  const drag = useRef<{ id: number; startX: number; startW: number; dir: 1 | -1 } | null>(null);

  const startDrag = (dir: 1 | -1) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = { id: e.pointerId, startX: e.clientX, startW: width, dir };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // The column is centred, so an edge dragged outward by n widens it by 2n — otherwise the column
    // slides sideways instead of growing and the text under the cursor drifts away.
    const next = d.startW + (e.clientX - d.startX) * d.dir * 2;
    onWidthChange(Math.round(Math.max(MIN_WIDTH, Math.min(maxWidth, next))));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* gone */ }
  };

  const handleCls =
    "absolute inset-y-8 w-1.5 cursor-ew-resize rounded-full bg-primary/0 transition-colors duration-200 hover:bg-primary/40";

  useEffect(() => {
    if (width > maxWidth) onWidthChange(Math.max(MIN_WIDTH, maxWidth));
  }, [width, maxWidth, onWidthChange]);

  return (
    <div className="flex h-full w-full justify-center">
      <div className="group/col relative h-full" style={{ width }}>
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto overscroll-contain px-1 pb-6"
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="flex flex-col" style={{ gap: "var(--sx-pad, 24px)" }}>
            {turns.map((turn) => {
              const assistantIndex = turn.assistantIndex;
              const vizId = assistantIndex !== null ? vizByMessageIndex.get(assistantIndex) : undefined;
              const isLive = assistantIndex !== null && assistantIndex === lastAssistantIndex;
              return (
                <div
                  key={turn.key}
                  className={`group rounded-2xl border bg-card/70 backdrop-blur-xl transition-colors duration-300 ${
                    isLive ? "border-border/80" : "border-border/45"
                  }`}
                  style={{ padding: "var(--sx-pad, 24px)" }}
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
                </div>
              );
            })}

            {thinking && <ThinkingBlock animations={animations} />}
          </div>
        </div>

        {/* Width handles, one per edge. Invisible until the column is hovered — the same restraint
            the canvas cards use. */}
        <div
          onPointerDown={startDrag(-1)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Drag to set the column width"
          className={`${handleCls} -left-3`}
        />
        <div
          onPointerDown={startDrag(1)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Drag to set the column width"
          className={`${handleCls} -right-3`}
        />
      </div>
    </div>
  );
}
