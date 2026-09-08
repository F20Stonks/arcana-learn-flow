# Integral Arena: cross-device progress, real competition, clearer scoring

Three things: your progress follows you between devices, the competitive layer gets all-time boards and seasons, and the hub plus scoring get cleaned up so it's obvious what you're earning and why.

## 1. Progress that follows your account

Today everything — solves, XP, streak, badges, sprint bests, lesson reads — lives only in the browser you played in. Sign in on your phone and you start from zero.

- On sign-in, the app pulls your saved progress from your account and merges it with whatever is on that device (best-of on every number: highest XP, longest streak, fastest time per problem, union of solves and badges). Nothing is ever lost by logging in somewhere new.
- After that, every solve saves up to your account in the background, with the local copy kept as an offline fallback so play never blocks on the network.
- Same treatment for the newer stores: paper sittings, recognition drill history, headsolve ladder, campaign target date and ticks, and the attempt log (attempts capped to a recent window so it stays small).
- If you're signed out or offline, everything works exactly as it does now and syncs the next time you're online.

## 2. Making it competitive

Right now the only board is the daily.

- **All-time rankings** — a leaderboard page with tabs: total problems solved, XP, current streak, sprint bests per configuration, and paper-mode best score. Each row shows your own position even when you're outside the top 50.
- **Seasons** — a fixed season window (monthly). Season points come from solves, daily results, sprint and paper performance during that window only, so a newcomer can win a season. Past seasons stay browsable with their final top 3.
- **Ranks** — six tiers (e.g. Bronze → Grandmaster) derived from season points, shown as a badge next to your name on every board and on the hub. A short "what you need for the next tier" line so it never feels arbitrary.
- **Anti-forgery** — season points and all-time totals are recomputed on the server from your saved solves and daily results, the same way drill scoring was recently hardened. The client can't post its own totals.

## 3. Clear XP and scoring

The main motivation complaint: it isn't clear how XP or score is earned.

- A **"How scoring works"** panel, reachable from the hub and the progress page: XP per solve by difficulty, the no-hints bonus, streak multipliers, how sprint score and daily score are computed, and how season points differ from XP. Written in plain language with a worked example.
- On every solve, an XP breakdown line instead of a bare number: "+12 XP — base 8, no hints +2, difficulty 4 +2".
- On the hub, one honest headline: level, XP to next level, current streak, season rank — replacing the current spread of numbers.

## 4. Hub and UI polish

- Rebuild the hub around three groups instead of a flat wall of tiles: **Play today** (daily, campaign's next session), **Train** (training, headsolve, recognition, values deck, lessons), **Compete** (sprint, paper, leaderboards). Each tile gets one line of "what this is for" and a small progress or streak indicator where one exists.
- One consistent card, heading, spacing and colour treatment shared across hub, progress, lessons, leaderboards — several pages drifted apart as modes were added.
- Progress page tidy-up: the strongest signals (level, streak, solved-by-technique, season rank) first, error profile and detailed stats collapsed below.
- Mobile pass on the hub, practice screen and leaderboards.

## Order of work

1. Cross-device progress sync (highest value, unblocks server-side boards).
2. Server-computed all-time boards.
3. Seasons and ranks.
4. Scoring transparency (XP breakdown + explainer).
5. Hub restructure and the shared visual pass.

## Technical notes

- The `integral_progress` table already exists (per-user JSON, correct row-level policies) and is currently unused — it becomes the sync target. New tables for season standings and cached all-time aggregates, plus a scheduled/edge recompute so ranking reads are cheap.
- Sync lives behind the existing store modules (`progress.ts`, `attempts.ts`, `headsolveHistory.ts`, `uk/*`), which already share a scoped, fail-soft localStorage pattern — a remote adapter slots in under them rather than changing every caller.
- Merge is last-write-wins per field with max() on monotonic values, so two devices played offline in parallel can't clobber each other.
- No change to grading (`answer.ts`), the problem bank, or lesson content.
