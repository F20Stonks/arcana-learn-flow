/**
 * The values deck (WS-6, UK_BEE_BURST.md) — flashcards for the memorised results.
 *
 * A study tool, not a drill: nothing here is scored or persisted, the same "reading isn't scored"
 * spirit the Lessons page already has. Front is the integral, back is the value — flip it, then
 * move on. Content is drawn only from techniques.ts's worked examples and the bank's own definite
 * answers (valuesDeck.ts), so this is re-presentation, not new authorship.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Shuffle } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import { shuffled } from "@/features/integrals/rng";
import { buildValuesDeck, valuesDeckForTechnique } from "@/features/integrals/valuesDeck";
import { TECHNIQUES, TECHNIQUE_BY_ID } from "@/features/integrals/techniques";
import type { TechniqueId } from "@/features/integrals/types";

const ALL = "all" as const;

export default function IntegralValues() {
  const fullDeck = useMemo(() => buildValuesDeck(), []);
  const [technique, setTechnique] = useState<TechniqueId | typeof ALL>(ALL);
  const [seed, setSeed] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const filtered = useMemo(
    () => (technique === ALL ? fullDeck : valuesDeckForTechnique(fullDeck, technique)),
    [fullDeck, technique],
  );
  const cards = useMemo(() => shuffled(filtered, seed), [filtered, seed]);
  const card = cards[index] ?? null;

  const changeTechnique = (next: TechniqueId | typeof ALL) => {
    setTechnique(next);
    setIndex(0);
    setFlipped(false);
  };

  const reshuffle = () => {
    setSeed((s) => s + 1);
    setIndex(0);
    setFlipped(false);
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= cards.length) return;
    setIndex(next);
    setFlipped(false);
  };

  // Space flips, the arrow keys move — a flashcard app's usual keyboard shortcuts, ignored while
  // focus is on the technique picker so changing the filter with arrow keys still works normally.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLSelectElement) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        goTo(index + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(index - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goTo closes over index/cards.length correctly per render
  }, [index, cards.length]);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        <header className="reveal mb-6">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Values deck
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            The memorised results — flip a card to check yourself. Not scored; read it like the
            lessons.
          </p>
        </header>

        <div className="reveal mb-5 flex flex-wrap items-center gap-3">
          <label htmlFor="values-technique" className="sr-only">
            Filter by technique
          </label>
          <select
            id="values-technique"
            value={technique}
            onChange={(e) => changeTechnique(e.target.value as TechniqueId | typeof ALL)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-hidden focus:border-primary/60"
          >
            <option value={ALL}>All techniques ({fullDeck.length} cards)</option>
            {TECHNIQUES.map((t) => {
              const count = valuesDeckForTechnique(fullDeck, t.id).length;
              return count > 0 ? (
                <option key={t.id} value={t.id}>
                  {t.name} ({count})
                </option>
              ) : null;
            })}
          </select>
          <button
            onClick={reshuffle}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Shuffle className="h-3.5 w-3.5" /> Shuffle
          </button>
        </div>

        {!card ? (
          <p className="reveal text-[14px] text-muted-foreground">Nothing in this deck yet.</p>
        ) : (
          <>
            <div className="reveal mb-4 flex items-center justify-between text-[13px] text-muted-foreground">
              <span>
                Card {index + 1} of {cards.length}
              </span>
              <span>{TECHNIQUE_BY_ID[card.technique].name}</span>
            </div>

            <button
              onClick={() => setFlipped((f) => !f)}
              aria-pressed={flipped}
              className="reveal mb-6 flex min-h-[220px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-6 py-10 text-center transition-colors hover:border-primary/30"
            >
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {flipped ? "Value" : "Integral — click to reveal"}
              </span>
              <div className="overflow-x-auto">
                <Tex block className="text-foreground">
                  {flipped ? card.back : card.front}
                </Tex>
              </div>
            </button>

            <div className="flex items-center justify-between">
              <button
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                onClick={() => setFlipped((f) => !f)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Flip
              </button>
              <button
                onClick={() => goTo(index + 1)}
                disabled={index === cards.length - 1}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
