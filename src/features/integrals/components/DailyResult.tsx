import { useEffect, useState } from "react";
import { Copy, Flame, Share2 } from "lucide-react";
import { toast } from "sonner";
import { dailyNumber, secondsUntilNextDaily, shareText } from "../daily";
import { formatDuration } from "../scoring";
import type { ScoreBreakdown } from "../scoring";
import type { Problem } from "../types";

interface Props {
  problem: Problem;
  solved: boolean;
  seconds: number;
  hintsUsed: number;
  wrongAttempts: number;
  streak: number;
  /** Present for a run just finished; absent when we're rebuilding a past day from storage. */
  score: ScoreBreakdown | null;
  totalScore?: number;
}

function Row({ label, value, dim = false }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className={`text-[13px] ${dim ? "text-muted-foreground" : "text-foreground"}`}>{label}</span>
      <span className="readout text-[13px] tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export default function DailyResult(props: Props) {
  const { problem, solved, seconds, hintsUsed, wrongAttempts, streak, score, totalScore } = props;
  const total = score?.total ?? totalScore ?? 0;
  const [countdown, setCountdown] = useState(secondsUntilNextDaily());

  useEffect(() => {
    const id = window.setInterval(() => setCountdown(secondsUntilNextDaily()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const text = shareText({
    number: dailyNumber(),
    difficulty: problem.difficulty,
    solved,
    seconds,
    hintsUsed,
    wrongAttempts,
    streak,
    score: total,
  });

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Result copied — go ruin someone's afternoon.");
      }
    } catch {
      // A cancelled share sheet is not an error worth surfacing.
    }
  };

  const hours = Math.floor(countdown / 3600);
  const mins = Math.floor((countdown % 3600) / 60);

  return (
    <div className="reveal rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[20px] font-semibold text-foreground">
          {solved ? "Solved." : "Not this time."}
        </h2>
        {streak > 0 && (
          <span className="readout flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[13px] font-semibold text-primary">
            <Flame className="h-3.5 w-3.5" /> {streak} day{streak === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {solved && (
        <div className="mt-4 divide-y divide-border/60">
          {score && (
          <>
          <Row label={`Base (${problem.difficulty}★)`} value={`${score.base}`} />
          {score.speedBonus > 0 && (
            <Row label={`Speed · ${formatDuration(seconds)}`} value={`+${score.speedBonus}`} dim />
          )}
          {score.hintPenalty < 0 && (
            <Row label={`Hints · ${hintsUsed}`} value={`${score.hintPenalty}`} dim />
          )}
          {score.attemptPenalty < 0 && (
            <Row label={`Wrong tries · ${wrongAttempts}`} value={`${score.attemptPenalty}`} dim />
          )}
          {score.streakMultiplier !== 1 && (
            <Row label="Streak multiplier" value={`×${score.streakMultiplier.toFixed(2)}`} dim />
          )}
          {score.modeMultiplier !== 1 && (
            <Row label="Repeat solve" value={`×${score.modeMultiplier.toFixed(2)}`} dim />
          )}
          </>
          )}
          <div className="flex items-baseline justify-between pt-2.5">
            <span className="text-[14px] font-semibold text-foreground">Score</span>
            <span className="readout text-[22px] font-bold tabular-nums text-primary">{total}</span>
          </div>
        </div>
      )}

      <pre className="readout mt-5 whitespace-pre-wrap rounded-xl bg-accent px-4 py-3 text-[13px] leading-relaxed text-foreground">
        {text}
      </pre>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={share}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {typeof navigator !== "undefined" && navigator.share ? (
            <Share2 className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Share result
        </button>
        <span className="readout text-[13px] tabular-nums text-muted-foreground">
          Next integral in {hours}h {String(mins).padStart(2, "0")}m
        </span>
      </div>
    </div>
  );
}
