import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  /** True while a turn has been sent and the answer hasn't started arriving. */
  thinking: boolean;
  revealRate: number;
  animations: boolean;
}

/** How many cards deep the silhouettes go before there's nothing left to see. */
const DEPTH = 3;

/**
 * The session as a deck: one exchange at a time, the ones before it stacked behind as silhouettes.
 *
 * The canvas is for spreading a lesson out and comparing its parts. This is the opposite posture —
 * one thing in front of you, everything else parked but visibly still there, so the lesson still
 * feels like a place with a before and an after rather than a single floating card. Scrolling moves
 * through the deck, but only once the card in front has been read to its end: a long derivation
 * scrolls inside its own card first, and only then hands the wheel over to the deck.
 */
export default function CardDeck({
  messages, cleanText, vizByMessageIndex, activeVizId, onSelectViz, onSaveNote, isStreaming,
  thinking, revealRate, animations,
}: Props) {
  const turns = useMemo(() => groupIntoTurns(messages), [messages]);
  const lastAssistantIndex = useMemo(
    () => messages.reduce((acc, m, i) => (m.role === "assistant" ? i : acc), -1),
    [messages],
  );

  /** The thinking placeholder is a card of its own at the end, so waiting is a place in the deck. */
  const total = turns.length + (thinking ? 1 : 0);
  const [index, setIndex] = useState(Math.max(0, total - 1));

  const clamp = useCallback((i: number) => Math.max(0, Math.min(total - 1, i)), [total]);

  // A new turn brings the deck to the front. Anything else would leave the student looking at an old
  // card while the answer they just asked for arrives somewhere off-screen.
  const lastTotal = useRef(total);
  useEffect(() => {
    if (total !== lastTotal.current) {
      lastTotal.current = total;
      setIndex(Math.max(0, total - 1));
    }
  }, [total]);

  const frontRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);

  // Wheel: scroll the front card until it has no more to give, then move through the deck. The
  // listener is native and non-passive because both branches need preventDefault — React's onWheel
  // is registered passively and would let the page scroll underneath.
  const cooldown = useRef(0);
  const travel = useRef(0);
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const scroller = frontRef.current;
      if (scroller) {
        const atTop = scroller.scrollTop <= 0;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        const canScroll = scroller.scrollHeight > scroller.clientHeight + 1;
        if (canScroll && ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop))) {
          scroller.scrollTop += e.deltaY;
          e.preventDefault();
          return;
        }
      }
      e.preventDefault();
      const now = performance.now();
      if (now < cooldown.current) return;
      // Accumulate: trackpads deliver a dozen small deltas per flick, and stepping on each one makes
      // the deck unusable.
      travel.current += e.deltaY;
      if (Math.abs(travel.current) < 40) return;
      const dir = travel.current > 0 ? 1 : -1;
      travel.current = 0;
      cooldown.current = now + 320;
      setIndex((i) => clamp(i + dir));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clamp]);

  // The front card starts at its own top whenever the deck moves — landing mid-explanation because
  // the previous card had been scrolled is disorienting.
  useEffect(() => {
    if (frontRef.current) frontRef.current.scrollTop = 0;
  }, [index]);

  const ease = animations ? "transform 420ms var(--ease-out), opacity 420ms var(--ease-out)" : "none";

  const renderCard = (i: number) => {
    const offset = i - index;
    const depth = Math.abs(offset);
    if (depth > DEPTH) return null;
    const front = offset === 0;
    const isThinkingCard = thinking && i === turns.length;
    const turn = isThinkingCard ? null : turns[i];
    if (!isThinkingCard && !turn) return null;

    const assistantIndex = turn?.assistantIndex ?? null;
    const vizId = assistantIndex !== null ? vizByMessageIndex.get(assistantIndex) : undefined;

    return (
      <div
        key={isThinkingCard ? "thinking" : turn!.key}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ zIndex: 30 - depth }}
        aria-hidden={!front}
      >
        <div
          onClick={() => { if (!front) setIndex(i); }}
          className={`group flex w-full max-h-full flex-col ${front ? "pointer-events-auto" : depth === 1 ? "pointer-events-auto cursor-pointer" : ""}`}
          style={{
            maxWidth: 760,
            // Older cards lift and shrink behind, newer ones sink below — so the deck reads as a
            // sequence you are somewhere inside, not a pile.
            transform: `translateY(${offset * 18}px) scale(${1 - depth * 0.05})`,
            opacity: front ? 1 : Math.max(0, 0.5 - (depth - 1) * 0.16),
            filter: depth >= 2 ? "blur(1.5px)" : undefined,
            transition: ease,
          }}
        >
          <div
            className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card/85 backdrop-blur-xl ${
              front
                ? "border-border/80 shadow-[0_2px_10px_rgba(0,0,0,0.2),0_28px_60px_-24px_rgba(0,0,0,0.6)]"
                : "border-border/40 shadow-none"
            }`}
          >
            {/* Capped by the deck's own box, never by the viewport: a card measured against `vh`
                grows past the bottom of a short window and runs under the command bar. */}
            <div
              ref={front ? frontRef : undefined}
              className="min-h-0 overflow-y-auto overscroll-contain"
              style={{ padding: "var(--sx-pad, 24px)" }}
            >
              {isThinkingCard ? (
                <ThinkingBlock animations={animations} />
              ) : (
                <TurnBody
                  turn={turn!}
                  messages={messages}
                  cleanText={cleanText}
                  vizId={vizId}
                  onStage={!!vizId && vizId === activeVizId}
                  onSelectViz={onSelectViz}
                  onSaveNote={onSaveNote}
                  streaming={isStreaming && assistantIndex !== null && assistantIndex === lastAssistantIndex}
                  revealRate={revealRate}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const indices = Array.from({ length: total }, (_, i) => i);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-0 flex-1 items-stretch gap-1 px-1">
        <div className="flex shrink-0 items-center">
          <button
            onClick={() => setIndex((i) => clamp(i - 1))}
            disabled={index === 0}
            title="Previous exchange"
            aria-label="Previous exchange"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 text-muted-foreground backdrop-blur-xl transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* The deck itself. Arrows sit OUTSIDE this box rather than floating over it, so a card can
            never be read through a control. */}
        <div ref={deckRef} className="relative min-h-0 flex-1">
          {indices.map(renderCard)}
        </div>

        <div className="flex shrink-0 items-center">
          <button
            onClick={() => setIndex((i) => clamp(i + 1))}
            disabled={index >= total - 1}
            title="Next exchange"
            aria-label="Next exchange"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 text-muted-foreground backdrop-blur-xl transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2 pt-3">
        <span className="text-[10px] tabular-nums text-muted-foreground/70">
          {Math.min(index + 1, total)}/{total}
        </span>
        <div className="flex items-center gap-1">
          {indices.map((i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              title={`Exchange ${i + 1}`}
              aria-label={`Go to exchange ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
