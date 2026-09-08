/**
 * Leaderboards — Integral Arena and Drills only.
 *
 * Deliberately scoped to the two competitive games: everything else in the app is private study
 * work with nothing meaningful to rank. Rows come from the owner-rights leaderboard views, so a
 * player sees other people's names and scores but never their account data.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import ScoringExplainer from "@/features/integrals/components/ScoringExplainer";
import { DRILL_LIST } from "@/features/drills/registry";
import {
  fetchAllTimeBoard,
  fetchArenaBoard,
  fetchMyStanding,
  fetchSeasonBoard,
  seasonKey,
  seasonName,
  type MyStanding,
  type RankRow,
  fetchDrillGameBoard,
  fetchDrillOverallBoard,
  type ArenaRow,
  type DrillGameRow,
  type DrillOverallRow,
} from "@/features/leaderboards/data";

type Tab = "ranks" | "arena" | "drills";

/** Which board the "Rankings" tab is showing: everything ever, or this calendar month. */
type Scope = "alltime" | "season";

function Medal({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? "text-amber-400" : rank === 2 ? "text-zinc-300" : rank === 3 ? "text-orange-400" : "text-muted-foreground";
  return <span className={`readout w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums ${tone}`}>{rank}</span>;
}

function Row({
  rank,
  name,
  you,
  primary,
  detail,
}: {
  rank: number;
  name: string;
  you: boolean;
  primary: string;
  detail: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
        you ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/40"
      }`}
    >
      <Medal rank={rank} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-foreground">
          {name}
          {you && <span className="ml-2 text-[11px] uppercase tracking-wide text-primary">you</span>}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">{detail}</div>
      </div>
      <div className="readout shrink-0 text-[15px] font-semibold tabular-nums text-foreground">{primary}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">{label}</p>;
}

export default function LeaderboardsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("ranks");
  const [scope, setScope] = useState<Scope>("alltime");
  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [ranksLoading, setRanksLoading] = useState(true);
  const [standing, setStanding] = useState<MyStanding | null>(null);
  const season = seasonKey();
  const [loading, setLoading] = useState(true);
  const [arena, setArena] = useState<ArenaRow[]>([]);
  const [drills, setDrills] = useState<DrillOverallRow[]>([]);
  const [game, setGame] = useState<string>(DRILL_LIST[0]?.key ?? "");
  const [gameRows, setGameRows] = useState<DrillGameRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchArenaBoard(), fetchDrillOverallBoard()]).then(([a, d]) => {
      if (cancelled) return;
      setArena(a);
      setDrills(d);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRanksLoading(true);
    const load = scope === "alltime" ? fetchAllTimeBoard() : fetchSeasonBoard(season);
    Promise.all([load, fetchMyStanding(season)]).then(([rows, mine]) => {
      if (cancelled) return;
      setRanks(rows);
      setStanding(mine);
      setRanksLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [scope, season]);

  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    fetchDrillGameBoard(game).then((rows) => {
      if (!cancelled) setGameRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

  const gameName = useMemo(() => DRILL_LIST.find((d) => d.key === game)?.name ?? game, [game]);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to={tab === "arena" ? "/integrals" : "/drills"}
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        <header className="reveal mb-6">
          <h1 className="flex items-center gap-2.5 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            <Trophy className="h-6 w-6 text-amber-400" /> Leaderboards
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Integral Arena and Drills, ranked across everyone playing. Your own study tracks stay private.
          </p>
        </header>

        <div className="mb-6 inline-flex rounded-xl border border-border bg-card p-1">
          {(["ranks", "arena", "drills"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "ranks" ? "Rankings" : t === "arena" ? "Integral Arena" : "Drills"}
            </button>
          ))}
        </div>

        {tab === "ranks" ? (
          <div className="space-y-5">
            <div className="inline-flex rounded-xl border border-border bg-card p-1">
              {(["alltime", "season"] as Scope[]).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setScope(sc)}
                  className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors ${
                    scope === sc ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sc === "alltime" ? "All time" : seasonName(season)}
                </button>
              ))}
            </div>

            {standing && (
              <section className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-4">
                <div>
                  <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
                    {standing.allTimeRank ? `#${standing.allTimeRank}` : "—"}
                  </div>
                  <div className="text-[12px] text-muted-foreground">all-time place</div>
                </div>
                <div>
                  <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
                    {standing.seasonRank ? `#${standing.seasonRank}` : "—"}
                  </div>
                  <div className="text-[12px] text-muted-foreground">this season</div>
                </div>
                <div>
                  <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
                    {standing.allTimeXp}
                  </div>
                  <div className="text-[12px] text-muted-foreground">total XP</div>
                </div>
                <div>
                  <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
                    {standing.allTimeSolved}
                  </div>
                  <div className="text-[12px] text-muted-foreground">problems solved</div>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
              <h2 className="px-3 pb-2 pt-1 text-[13px] font-medium text-muted-foreground">
                {scope === "alltime"
                  ? "Everything you have ever earned in the Arena"
                  : `${seasonName(season)} — the board resets on the first of next month`}
              </h2>
              {ranksLoading ? (
                <div className="flex items-center gap-3 px-3 py-10">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <p className="text-[14px] text-muted-foreground">Loading…</p>
                </div>
              ) : ranks.length === 0 ? (
                <Empty
                  label={
                    scope === "alltime"
                      ? "Nobody is on the board yet. Solve anything and you're first."
                      : "This season is still empty. Play today and take the top spot."
                  }
                />
              ) : (
                ranks.map((r) => (
                  <Row
                    key={r.userId}
                    rank={r.rank}
                    name={r.displayName}
                    you={r.userId === user?.id}
                    primary={`${r.score}`}
                    detail={r.detail}
                  />
                ))
              )}
            </section>

            <ScoringExplainer />
          </div>
        ) : loading ? (
          <div className="flex items-center gap-3 py-16">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-[14px] text-muted-foreground">Loading boards…</p>
          </div>
        ) : tab === "arena" ? (
          <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
            <h2 className="px-3 pb-2 pt-1 text-[13px] font-medium text-muted-foreground">
              All-time daily integral score
            </h2>
            {arena.length === 0 ? (
              <Empty label="No one has banked a daily yet. Solve today's and take first place." />
            ) : (
              arena.map((r) => (
                <Row
                  key={r.userId}
                  rank={r.rank}
                  name={r.displayName}
                  you={r.userId === user?.id}
                  primary={`${r.totalScore}`}
                  detail={`${r.daysSolved}/${r.daysPlayed} solved · best ${r.bestScore}${
                    r.avgSeconds != null ? ` · avg ${r.avgSeconds}s` : ""
                  }`}
                />
              ))
            )}
          </section>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
              <h2 className="px-3 pb-2 pt-1 text-[13px] font-medium text-muted-foreground">Overall drill XP</h2>
              {drills.length === 0 ? (
                <Empty label="No drill runs recorded yet. Play one and you're on the board." />
              ) : (
                drills.map((r) => (
                  <Row
                    key={r.userId}
                    rank={r.rank}
                    name={r.displayName}
                    you={r.userId === user?.id}
                    primary={`${r.xp} XP`}
                    detail={`${r.runs} runs · ${r.gamesPlayed} games · ${r.accuracy}% accuracy`}
                  />
                ))
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-1">
                <h2 className="mr-1 text-[13px] font-medium text-muted-foreground">By game</h2>
                {DRILL_LIST.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setGame(d.key)}
                    className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                      game === d.key
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
              {gameRows.length === 0 ? (
                <Empty label={`No runs of ${gameName} yet.`} />
              ) : (
                gameRows.map((r) => (
                  <Row
                    key={`${r.userId}:${r.mode}`}
                    rank={r.rank}
                    name={r.displayName}
                    you={r.userId === user?.id}
                    primary={`${r.bestScore}`}
                    detail={`${r.mode} · ${r.runs} runs · ${r.accuracy}% accuracy`}
                  />
                ))
              )}
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
