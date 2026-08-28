/**
 * Cross-device progress sync.
 *
 * progress.ts is intentionally local-only at the storage layer — everything here builds on top of
 * it rather than inside it, the same split leaderboard.ts already uses for the daily submission.
 * Two devices signed into the same account each keep their own localStorage, so a fresh device is
 * not "no progress", it's "no progress *recorded here yet*" — the fix is to reconcile the two on
 * sign-in rather than to make either one authoritative.
 *
 * The reconciliation has to survive both sides having made real, independent progress since they
 * last talked (the common case: solving problems on a laptop for weeks before ever opening the
 * phone). There's no shared event log to replay, so `mergeProgress` takes the field-by-field union
 * or maximum of the two snapshots — the property that matters is that the result can never be
 * *worse* than either input, i.e. a sync can never make an earned badge, a solved problem or a
 * streak disappear. The cost is that two genuinely concurrent sessions can occasionally overcount
 * something like `sprints[key].runs`; that is a cosmetic near-miss, not lost progress, and is the
 * trade this file deliberately makes.
 *
 * Every network call here fails soft, matching leaderboard.ts: the migration that creates
 * `integral_progress` ships with this code but is not applied until someone runs it, and losing a
 * sync must never cost a student their session — localStorage already has whatever they just did.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { emptyProgress, type DailyRecord, type Progress, type SolveRecord, type SprintBest } from "./progress";

/** See leaderboard.ts's `db` — same reason: this table isn't in the generated schema types yet. */
const db = supabase as unknown as SupabaseClient;

function mergeSolves(a: Progress["solves"], b: Progress["solves"]): Progress["solves"] {
  const out: Progress["solves"] = { ...a };
  for (const [id, rb] of Object.entries(b)) {
    const ra = out[id];
    out[id] = !ra
      ? rb
      : ({
          solvedAt: ra.solvedAt > rb.solvedAt ? ra.solvedAt : rb.solvedAt,
          solves: Math.max(ra.solves, rb.solves),
          bestSeconds: Math.min(ra.bestSeconds, rb.bestSeconds),
          everSolvedWithoutHints: ra.everSolvedWithoutHints || rb.everSolvedWithoutHints,
        } satisfies SolveRecord);
  }
  return out;
}

/** A solved day beats an unsolved one; between two solved attempts, the better score wins. */
function betterDaily(a: DailyRecord, b: DailyRecord): DailyRecord {
  if (a.solved !== b.solved) return a.solved ? a : b;
  return a.score >= b.score ? a : b;
}

function mergeDaily(a: Progress["daily"], b: Progress["daily"]): Progress["daily"] {
  const out: Progress["daily"] = { ...a };
  for (const [key, rb] of Object.entries(b)) out[key] = out[key] ? betterDaily(out[key], rb) : rb;
  return out;
}

/**
 * Streak *state* (current run + its last day) comes from whichever side played more recently — day
 * keys sort lexicographically, so a plain string comparison is enough. `longest` is a straight max:
 * it only ever grows, on either device, so the bigger of the two is always the true bigger streak.
 * Anything stale here is self-healing anyway — every read goes through `liveStreak`, which re-derives
 * whether a streak is still alive against *today* rather than trusting what was last written.
 */
function mergeStreak(a: Progress["streak"], b: Progress["streak"]): Progress["streak"] {
  const longest = Math.max(a.longest, b.longest);
  if (!a.lastDayKey) return { ...b, longest };
  if (!b.lastDayKey) return { ...a, longest };
  return { ...(a.lastDayKey >= b.lastDayKey ? a : b), longest };
}

function mergeSprints(a: Progress["sprints"], b: Progress["sprints"]): Progress["sprints"] {
  const out: Progress["sprints"] = { ...a };
  for (const [key, rb] of Object.entries(b)) {
    const ra = out[key];
    out[key] = !ra
      ? rb
      : ({
          score: Math.max(ra.score, rb.score),
          solved: Math.max(ra.solved, rb.solved),
          runs: Math.max(ra.runs, rb.runs),
          at: ra.score >= rb.score ? ra.at : rb.at,
        } satisfies SprintBest);
  }
  return out;
}

/** Earliest timestamp wins — a badge was earned the first time either device crossed the line. */
function mergeBadges(a: Progress["badges"], b: Progress["badges"]): Progress["badges"] {
  const out: Progress["badges"] = { ...a };
  for (const [id, at] of Object.entries(b)) out[id] = !out[id] || at < out[id] ? at : out[id];
  return out;
}

/** Union of two independently-evolved snapshots. See the file header for why "union", not "latest". */
export function mergeProgress(a: Progress, b: Progress): Progress {
  return {
    version: 1,
    xp: Math.max(a.xp, b.xp),
    solves: mergeSolves(a.solves, b.solves),
    daily: mergeDaily(a.daily, b.daily),
    streak: mergeStreak(a.streak, b.streak),
    badges: mergeBadges(a.badges, b.badges),
    lessonsRead: [...new Set([...a.lessonsRead, ...b.lessonsRead])],
    sprints: mergeSprints(a.sprints, b.sprints),
  };
}

/** Defensively shaped like `progress.ts`'s own `read()` — a partial or pre-this-feature row is fine. */
function sanitize(raw: unknown): Progress {
  if (!raw || typeof raw !== "object") return emptyProgress();
  return { ...emptyProgress(), ...(raw as Partial<Progress>) };
}

/** The account's server copy, or null if there isn't one yet (new account, or the request failed). */
export async function pullProgress(userId: string): Promise<Progress | null> {
  try {
    const { data, error } = await db
      .from("integral_progress")
      .select("progress")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return sanitize((data as { progress: unknown }).progress);
  } catch {
    return null;
  }
}

/** Upserts the whole snapshot. Best-effort — the next successful push catches up any that fail. */
export async function pushProgress(userId: string, progress: Progress): Promise<void> {
  try {
    await db
      .from("integral_progress")
      .upsert({ user_id: userId, progress, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  } catch {
    // Local storage already has it; there is nothing useful to do with this failure here.
  }
}
