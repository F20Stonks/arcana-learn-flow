/**
 * The shape of a player's history, ready to draw.
 *
 * Everything here is a pure function of stored progress, so the calendar and the breakdown are
 * testable without rendering anything.
 */
import { dayKey } from "./daily";
import { PROBLEMS, PROBLEM_BY_ID } from "./problems";
import { BASE_POINTS } from "./scoring";
import type { DailyRecord, Progress } from "./progress";
import type { Difficulty } from "./types";

/** 0 means nothing was banked that day; 1–4 is how well it went relative to par. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface DayCell {
  key: string;
  date: Date;
  /** Days after today, drawn as empty outlines so the grid keeps its rectangle. */
  future: boolean;
  attempted: boolean;
  solved: boolean;
  score: number;
  level: HeatLevel;
  record?: DailyRecord;
}

/**
 * How bright a solved day should be.
 *
 * Comparing raw scores across days would be unfair — the daily ramps in difficulty across the
 * week, so a perfect Monday scores less than a mediocre Saturday. The ratio against that
 * problem's base points asks the only question worth asking: how did you do against par?
 */
export function heatLevel(record: DailyRecord | undefined): HeatLevel {
  if (!record?.solved) return 0;
  const difficulty = PROBLEM_BY_ID[record.problemId]?.difficulty;
  const par = difficulty ? BASE_POINTS[difficulty] : 100;
  const ratio = record.score / par;
  if (ratio < 0.7) return 1;
  if (ratio < 1.0) return 2;
  if (ratio < 1.3) return 3;
  return 4;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Weeks of seven days, oldest first, each column running Sunday to Saturday and the last column
 * containing today. The grid always ends on a Saturday so it stays rectangular.
 */
export function heatmapWeeks(p: Progress, weeks = 18, today = new Date()): DayCell[][] {
  const endOfWeek = addDays(today, 6 - today.getDay());
  const start = addDays(endOfWeek, -(weeks * 7 - 1));
  const todayKey = dayKey(today);

  const columns: DayCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const key = dayKey(date);
      const record = p.daily[key];
      column.push({
        key,
        date,
        future: key > todayKey,
        attempted: record !== undefined,
        solved: record?.solved ?? false,
        score: record?.score ?? 0,
        level: heatLevel(record),
        record,
      });
    }
    columns.push(column);
  }
  return columns;
}

/**
 * The months to label along the top: the first column in which each month appears.
 *
 * A month name is several columns wide, so two months starting a week apart would overlap. Any
 * label closer than `minGap` columns to the last one is dropped — the grid reads better missing a
 * month than printing "AprMay".
 */
export function monthLabels(weeks: DayCell[][], minGap = 3): Array<{ index: number; label: string }> {
  const out: Array<{ index: number; label: string }> = [];
  let previousMonth = -1;
  let lastLabelled = -Infinity;
  weeks.forEach((column, index) => {
    const month = column[0].date.getMonth();
    if (month === previousMonth) return;
    previousMonth = month;
    if (index - lastLabelled < minGap) return;
    out.push({ index, label: column[0].date.toLocaleDateString(undefined, { month: "short" }) });
    lastLabelled = index;
  });
  return out;
}

export interface HistorySummary {
  played: number;
  solved: number;
  /** Days elapsed since the first attempt — the denominator for a turnout figure. */
  span: number;
  bestScore: number;
  bestDayKey: string | null;
  totalScore: number;
}

export function historySummary(p: Progress, today = new Date()): HistorySummary {
  const entries = Object.entries(p.daily);
  const played = entries.length;
  const solved = entries.filter(([, r]) => r.solved).length;
  const best = entries.reduce<[string, number]>(
    (top, [key, r]) => (r.score > top[1] ? [key, r.score] : top),
    ["", 0],
  );
  const firstKey = entries.map(([k]) => k).sort()[0];
  let span = played;
  if (firstKey) {
    const [y, m, d] = firstKey.split("-").map(Number);
    const first = new Date(y, m - 1, d).getTime();
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    span = Math.max(1, Math.round((now - first) / 86_400_000) + 1);
  }
  return {
    played,
    solved,
    span,
    bestScore: best[1],
    bestDayKey: best[0] || null,
    totalScore: entries.reduce((sum, [, r]) => sum + r.score, 0),
  };
}

export interface DifficultyProgress {
  difficulty: Difficulty;
  solved: number;
  total: number;
}

export function difficultyBreakdown(p: Progress): DifficultyProgress[] {
  return ([1, 2, 3, 4, 5] as Difficulty[]).map((difficulty) => {
    const pool = PROBLEMS.filter((q) => q.difficulty === difficulty);
    return {
      difficulty,
      solved: pool.filter((q) => p.solves[q.id]).length,
      total: pool.length,
    };
  });
}
