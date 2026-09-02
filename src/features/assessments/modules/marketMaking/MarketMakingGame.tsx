/**
 * The market-making game's whole UI — contract description, reveals, inventory, blotter, quote
 * entry, and (once settled) the multi-metric scorecard.
 *
 * This owns everything below `item.prompt` because `input: "custom"` says it should — see
 * index.ts's top comment. ItemRenderer.tsx (out of this module's edit scope) has no branch for
 * `custom` today; wiring this in means adding one there, e.g.:
 *
 *   {module.input === "custom" && module.kind === "market-making" ? (
 *     <MarketMakingGame key={item.id} item={item} onSubmit={onSubmit} />
 *   ) : module.input === "choice" && item.choices ? (
 *     <ChoiceInput ... />
 *   ) : (
 *     <FreeNumericInput ... />
 *   )}
 *
 * Layout follows the shared component vocabulary (Debrief.tsx, ItemRenderer.tsx) without sharing
 * any code with them: rounded-2xl border border-border bg-card panels, font-mono tabular-nums on
 * every number, text-muted-foreground for secondary labels.
 *
 * What is deliberately NEVER rendered while the game is running: game.settlement, any round's true
 * fairValue or stdDev, and any running P&L. Deriving the fair value from the contract's known
 * shape plus what's been revealed is the actual skill this module tests — printing the number
 * would trade the test for a data-entry exercise, and a live P&L readout would leak exactly how
 * close the last quote was to it.
 */
import { useEffect, useRef, useState } from "react";
import type { AssessmentItem } from "../../types";
import { useMarketMakingGame } from "./useMarketMakingGame";
import type { MarketMakingScorecard, Trade } from "./types";

interface Props {
  item: AssessmentItem;
  onSubmit: (raw: string) => void;
}

const signed = (n: number) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(2);
const plain = (n: number) => n.toFixed(2);

function InventoryBadge({ inventory }: { inventory: number }) {
  const label = inventory > 0 ? "Long" : inventory < 0 ? "Short" : "Flat";
  return (
    <span className="font-mono text-sm tabular-nums text-foreground">
      {label} {Math.abs(inventory)}
    </span>
  );
}

function Blotter({ trades }: { trades: Trade[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-[13px] font-semibold text-foreground">Blotter</h3>
      {trades.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">No fills yet.</p>
      ) : (
        <ul className="mt-3 flex max-h-40 flex-col divide-y divide-border overflow-y-auto">
          {trades.map((t, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 py-1.5 font-mono text-[12.5px] tabular-nums text-foreground"
            >
              <span className="text-muted-foreground">R{t.round + 1}</span>
              <span>{t.side === "bot-buys" ? "Sold" : "Bought"} {t.qty}</span>
              <span>@ {plain(t.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface QuoteFormProps {
  roundIndex: number;
  onSubmit: (bid: number, ask: number) => void;
  error: string | null;
}

/** Bid, then ask, then submit — every one of those reachable with Enter alone. Remounted with a
 * fresh `key` per round by the caller, so autofocus and empty fields come free (same convention
 * as FreeNumericInput.tsx). */
function QuoteForm({ roundIndex, onSubmit, error }: QuoteFormProps) {
  const [bid, setBid] = useState("");
  const [ask, setAsk] = useState("");
  const bidRef = useRef<HTMLInputElement>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const numeric = /^-?\d*\.?\d*$/;

  useEffect(() => {
    bidRef.current?.focus();
  }, [roundIndex]);

  const submit = () => {
    if (bid.trim() === "" || ask.trim() === "") return;
    onSubmit(Number(bid), Number(ask));
    setBid("");
    setAsk("");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Bid</span>
          <input
            ref={bidRef}
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            aria-label="Your bid"
            value={bid}
            onChange={(e) => {
              if (numeric.test(e.target.value)) setBid(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                askRef.current?.focus();
              }
            }}
            placeholder="?"
            className="w-28 rounded-xl border-2 border-border bg-card px-3 py-2.5 text-center font-mono text-xl tabular-nums text-foreground outline-hidden transition-colors focus:border-primary/60 placeholder:text-muted-foreground/30"
          />
        </label>
        <span className="pb-2.5 text-muted-foreground">–</span>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Ask</span>
          <input
            ref={askRef}
            inputMode="decimal"
            autoComplete="off"
            aria-label="Your ask"
            value={ask}
            onChange={(e) => {
              if (numeric.test(e.target.value)) setAsk(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="?"
            className="w-28 rounded-xl border-2 border-border bg-card px-3 py-2.5 text-center font-mono text-xl tabular-nums text-foreground outline-hidden transition-colors focus:border-primary/60 placeholder:text-muted-foreground/30"
          />
        </label>
        <button
          onClick={submit}
          disabled={bid.trim() === "" || ask.trim() === ""}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          Quote
        </button>
      </div>
      {error && <p className="mt-2.5 text-[12.5px] text-destructive">{error}</p>}
      <p className="mt-2.5 text-[11px] text-muted-foreground">Enter moves bid → ask → submit. No mouse required.</p>
    </div>
  );
}

function Summary({
  scorecard,
  settlement,
  description,
  onContinue,
}: {
  scorecard: MarketMakingScorecard;
  settlement: number;
  description: string;
  onContinue: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["Your P&L", signed(scorecard.candidatePnl)],
    ["Benchmark P&L", signed(scorecard.benchmarkPnl)],
    ["Fills", `${scorecard.fillCount} / ${scorecard.roundsCount}`],
    [
      "Adverse selection",
      scorecard.adverseSelectionRate === null ? "—" : `${Math.round(scorecard.adverseSelectionRate * 100)}%`,
    ],
    [
      "Spread / uncertainty",
      scorecard.avgSpreadOverUncertainty === null ? "—" : `${scorecard.avgSpreadOverUncertainty.toFixed(2)}σ`,
    ],
    ["Peak inventory", `${scorecard.peakAbsInventory} (ended ${scorecard.endInventorySign})`],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">Settled</p>
        <p className="mt-1.5 text-[14px] text-muted-foreground">{description}</p>
        <p className="mt-1 text-[14px] text-foreground">
          Settlement value: <span className="font-mono tabular-nums">{plain(settlement)}</span>
        </p>

        <div className="mt-5 flex items-baseline gap-3">
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">Skill P&amp;L</span>
          <span
            className={`font-mono text-[36px] font-semibold tabular-nums ${
              scorecard.skillPnl >= 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {signed(scorecard.skillPnl)}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Your P&amp;L minus what a perfectly-priced player would have made from the same settlement draw — this
          nets the luck of the draw out, leaving only pricing skill.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-mono text-[15px] tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <button
        onClick={onContinue}
        className="rounded-xl bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Continue
      </button>
    </div>
  );
}

export default function MarketMakingGame({ item, onSubmit }: Props) {
  const g = useMarketMakingGame(item, onSubmit);

  if (g.isFinished && g.scorecard && g.settlement !== null) {
    return (
      <Summary scorecard={g.scorecard} settlement={g.settlement} description={g.game.description} onContinue={g.finish} />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-[14px] text-foreground">{g.game.description}</p>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
              Round {g.roundIndex + 1} / {g.roundsTotal}
            </span>
            <InventoryBadge inventory={g.inventory} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-[13px] font-semibold text-foreground">Revealed</h3>
        {g.revealed.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Nothing yet — quote against the contract's prior shape.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {g.revealed.map((text, i) => (
              <li
                key={i}
                className={`text-[13.5px] ${i === g.revealed.length - 1 ? "text-foreground" : "text-muted-foreground"}`}
              >
                {text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuoteForm key={g.roundIndex} roundIndex={g.roundIndex} onSubmit={g.submitQuote} error={g.error} />

      <Blotter trades={g.trades} />
    </div>
  );
}
