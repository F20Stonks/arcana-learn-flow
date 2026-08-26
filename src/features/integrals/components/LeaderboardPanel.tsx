import { Loader2, Trophy, Users } from "lucide-react";
import { formatDuration } from "../scoring";
import { ordinal, type LeaderboardRow } from "../leaderboard";
import type { DailyBoard } from "../hooks/useDailyBoard";

function Row({ row, isYou }: { row: LeaderboardRow; isYou: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
        isYou ? "bg-primary/[0.08] ring-1 ring-primary/30" : ""
      }`}
    >
      <span
        className={`readout w-9 shrink-0 text-[13px] tabular-nums ${
          row.rank <= 3 ? "font-semibold text-primary" : "text-muted-foreground"
        }`}
      >
        {ordinal(row.rank)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">
        {row.displayName}
        {isYou && <span className="ml-2 text-[12px] text-muted-foreground">you</span>}
      </span>
      <span className="readout shrink-0 text-[12px] tabular-nums text-muted-foreground">
        {formatDuration(row.seconds)}
        {row.hintsUsed > 0 && ` · ${row.hintsUsed}h`}
      </span>
      <span className="readout w-12 shrink-0 text-right text-[14px] font-semibold tabular-nums text-foreground">
        {row.score}
      </span>
    </li>
  );
}

/**
 * Today's board.
 *
 * Shows the podium and your own neighbourhood rather than every row: the two things a player wants
 * to know are who won and who they can catch. When the backing tables are not deployed the whole
 * panel says so plainly instead of failing — the daily itself does not depend on any of this.
 */
export default function LeaderboardPanel({ board, puzzleNumber }: { board: DailyBoard; puzzleNumber: number }) {
  if (board.state === "idle") return null;

  return (
    <section className="reveal rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="font-display text-[17px] font-semibold text-foreground">
            Daily #{puzzleNumber} board
          </h2>
        </div>
        {board.turnout && (
          <span className="readout flex items-center gap-1.5 text-[12px] tabular-nums text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {board.turnout.solvers} of {board.turnout.players} solved it
          </span>
        )}
      </div>

      {board.state === "signed-out" && (
        <p className="text-[14px] text-muted-foreground">
          Sign in to take a place on the board. Your run is saved on this device either way.
        </p>
      )}

      {board.state === "loading" && (
        <div className="flex items-center gap-2.5 py-3 text-[14px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Submitting your run…
        </div>
      )}

      {board.state === "unavailable" && (
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          The board isn't reachable yet — your run is saved locally and your streak is safe. Once the
          leaderboard migration is deployed, everyone who plays Daily #{puzzleNumber} shows up here.
        </p>
      )}

      {board.state === "ready" && board.rows.length === 0 && (
        <p className="text-[14px] text-muted-foreground">
          Nobody has solved this one yet. Be the first.
        </p>
      )}

      {board.state === "ready" && board.rows.length > 0 && (
        <>
          <ol className="flex flex-col gap-1">
            {board.window.top.map((row) => (
              <Row key={row.userId} row={row} isYou={row.userId === board.window.you?.userId} />
            ))}
            {board.window.around.length > 0 && (
              <li aria-hidden className="py-1 text-center text-[13px] text-muted-foreground/50">
                ⋯
              </li>
            )}
            {board.window.around.map((row) => (
              <Row key={row.userId} row={row} isYou={row.userId === board.window.you?.userId} />
            ))}
          </ol>

          {board.window.you && board.percentile !== null && (
            <p className="mt-4 text-[13px] text-muted-foreground">
              You came {ordinal(board.window.you.rank)}
              {board.percentile > 0 && `, ahead of ${board.percentile}% of solvers`}.
              {board.turnout && board.turnout.averageScore > 0 && (
                <> The average solve scored {board.turnout.averageScore}.</>
              )}
            </p>
          )}

          {!board.window.you && (
            <p className="mt-4 text-[13px] text-muted-foreground">
              Solve it to take a place on the board.
            </p>
          )}
        </>
      )}
    </section>
  );
}
