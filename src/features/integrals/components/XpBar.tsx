import { levelState } from "../scoring";

export default function XpBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const s = levelState(xp);
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-foreground">
          Level {s.level}
          <span className="ml-2 text-muted-foreground">{s.rank}</span>
        </span>
        {!compact && (
          <span className="readout text-[12px] tabular-nums text-muted-foreground">
            {s.xpIntoLevel} / {s.xpForNextLevel} XP
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={s.xpIntoLevel}
        aria-valuemin={0}
        aria-valuemax={s.xpForNextLevel}
        aria-label={`Level ${s.level} progress: ${s.xpIntoLevel} of ${s.xpForNextLevel} XP`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-accent"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${Math.max(2, Math.round(s.progress * 100))}%` }}
        />
      </div>
    </div>
  );
}
