# Build burst: UK Integration Bee, solo, Round 1 on ~7 Nov 2026

**Status:** active. **Window: Mon 31 Aug – Sun 13 Sep 2026.** After 13 Sep the app is frozen
except content ingestion and bug fixes.

This is a *time-boxed* runbook, not an open-ended improvement task. It supersedes the open-ended
"seed more content" loop in `CLAUDE.md` for the duration of the window. Everything in `CLAUDE.md`'s
**Standing directives** and **Workflow** sections still applies and is not repeated here except
where this file tightens it.

---

## Why this exists (read once, then act)

The project owner is entering the **UK University Integration Bee solo**, Round 1 in early
November, and is training to be *finals-grade so the qualifier is trivial*. That single sentence
determines every priority below.

Facts that were measured from this repo, not estimated — do not re-derive them, and do not
contradict them without re-measuring:

- Bank is **788 problems**; **453 at difficulty 4–5** (57%); **207** carry the advanced arsenal
  (DUTIS, Beta, Gamma, Wallis, reciprocal-substitution, recurrence, floor, inverse-integral,
  introducing-constants); **154** come from real MIT bee rounds (regular season → finals).
- **The content is sufficient for this goal.** At 25 problems/day × 70 days that is 2.2 passes
  over the bank. Do **not** spend this window mining or adding problems.
- Solo Round 1 is **30 problems in 120 minutes = 4.0 min/problem**. Under the realistic ramp
  (15 min for Q1–10, 40 min for Q11–20, 65 min for the tail) the accessible ten must land in
  **90 seconds each**.
- `orderQueue` in `queue.ts` is **11 lines** and is the entire selection intelligence in the app.
- `techniqueMastery` is `solved / pool.length` — no decay, no retest, no speed input.
- `Problem.kind` is branched on in exactly **6 non-test sites**: `answer.ts`, `latex.ts`,
  `components/IntegralPrompt.tsx`, `components/RunPanel.tsx`, and two test helpers.
- The grader already emits a distinct `off-by-constant-factor` verdict **with the factor attached**
  and then discards it.

## The objective, in one line

Maximise the owner's expected Round-1 score on ~7 Nov by making the **existing** bank trainable:
measure every attempt, schedule the next problem intelligently, benchmark against the real paper
format, and diagnose *how* he fails.

---

## Scope

### In scope — build in this order, they depend on each other

**WS-1 · Attempt logging + split clock.** *Blocks everything else. Do this first.*
Persist every attempt, not just every solve. Today a wrong attempt increments a counter and the
answer string is discarded, so seventy days of training would produce no evidence.

- New store alongside `progress.ts` (same localStorage + scoping pattern, `scopedKey`, same
  fail-soft behaviour when storage is unavailable). Do **not** widen `Progress` itself — a separate
  key keeps the existing migration path clean.
- Record per attempt: `problemId`, `mode`, verdict *class*, the submitted string, hints open at the
  time, `wrongAttemptsSoFar`, and **two timings** — `msToFirstKeystroke` (recognition) and
  `msFirstKeystrokeToSubmit` (execution). The existing single elapsed clock conflates maths with
  typing; keep the existing `elapsed` too, don't replace it.
- Wire from `useIntegralRun`, `useSprintRun`, `useDailyRun`.
- Cap stored attempts (ring buffer, ~5000) so localStorage can't be filled.

**WS-2 · Paper mode — 30 in 120.** *The weekly benchmark. Highest single-feature value.*

- `uk/paper.ts`: deterministic assembly from a seed → 30 problems in three bands of 10
  (difficulty ≤2 / 3 / 4–5), definite-weighted (~70%), no repeats within a paper.
- **One answer sheet with free navigation**, not one-problem-at-a-time — competitors skip around
  and the mode is worthless without it. Per-problem flag/skip, jump-to-question, 120-min clock,
  pause/resume.
- Scoring out of 30 **plus a pacing report**: marks and minutes per band, and time spent on
  problems ultimately not landed (the triage cost).
- Route `/integrals/uk/round1` + the unguarded `/dev/` twin, matching the existing pattern in
  `App.tsx`.
- Reuse `shuffled` from `rng.ts` and the existing run/grading machinery. Do not fork it.

**WS-3 · The scheduler.** *The daily driver for 70 days. Replaces the 11-line queue.*

Replace `orderQueue` with a real selector reading the WS-1 attempt log. Weigh, roughly in this
order of influence:
- **retention decay** — time since last correct solve, scaled by how hard it was for him;
- **weakness** — per-technique and per-error-class failure rate;
- **near-miss priority** — an `off-by-constant-factor` or a single sign slip means the method was
  right; those are worth more than problems he had no idea about;
- **target success band** — aim ~70% success, not 95% (bored) or 30% (demoralised);
- **interleaving** — consecutive problems must not share a primary technique.

Keep `orderQueue` exported and working for any caller not yet migrated; add the new selector
beside it rather than editing in place, and switch callers deliberately.

**WS-4 · Error taxonomy.** *Solo, nobody else catches his sign errors.*

Extend the verdict vocabulary by comparing the student's parsed expression against the reference
**symbolically and numerically** — differentiate their answer and compare to the integrand, take
ratios and differences. Classify at minimum: `constant-factor`, `sign-flip`, `missing-absolute-value`,
`right-family-wrong-parameter`, `correct-but-unsimplified`, `wrong-method`. Everything else stays
`incorrect` — an honest bucket beats a wrong label.

**This must not change what counts as correct.** `normalize()` and its 50 tests are untouchable;
this is classification of answers already judged wrong. Add a test asserting that every problem's
own stored answer still grades `correct` and is never classified.

Surface as a profile on the progress page: which error class dominates, and in which techniques.

**WS-5 · Recognition drill + values deck.** *Cheap, aimed at the 90-second requirement.*

- **Name the weapon**: show the integrand, four technique buttons, ~3s clock, no solving. Every
  problem is already tagged, so this needs zero new content. Score recognition accuracy and median
  response time per technique.
- **Values deck**: flashcards for the memorised results. Source them **only** from `techniques.ts`
  lessons and existing bank answers — this is re-presentation of content already in the repo, not
  new authorship, so standing directive #2 is satisfied.

### Explicitly out of scope — do not build these, even if they seem natural

- **Crossnumber / Round 2 grid mechanic.** Round 2 happens *after* Round 1. Zero value before 7 Nov.
- **A `limit` problem kind.** Same reason. Cheap later; not on the critical path now.
- **Team mode / collective coverage.** He is solo.
- **Mining or authoring new problems.** The bank is sufficient for this objective. If PDFs appear
  in the session uploads, note them in the progress log and keep building — ingestion is a
  post-window task.
- **Anything outside `src/features/integrals`, `src/pages/Integral*`, and the router.**

---

## Hard rules

1. **No invented problems.** A real transcription from a source document, or nothing.
2. **No AI or network calls at runtime.** Development-time verification is fine; per-user API cost
   is not. Every classifier above is symbolic/numeric.
3. **Never weaken `normalize()` or its tests.** Adding parser tests is fine; changing what counts
   as correct is not.
4. **Add beside, don't replace.** The daily, sprint and training modes must keep working exactly as
   they do. Existing tests pass *unedited* — that is the regression guard. If an existing test needs
   changing to make something pass, stop and report instead.
5. **Never skip, disable or quarantine a test** to get green.
6. **Do not touch the Cortexed app or Supabase backend** outside the paths named above.

## Verification loop — every workstream, no exceptions

```
npm install --registry https://registry.npmjs.org   # default registry 403s in this sandbox
npx vitest run                                      # WHOLE repo, not just the feature
npx tsc --noEmit
npx eslint <files you touched>
```

Baseline before you start: **1901/1901 tests passing across 19 files, `tsc --noEmit` clean**
— verified on `5278b62` at the time this runbook was written. Reproduce that before your first
edit. If you cannot, report it and stop; do not build on a red baseline. That number is also your
regression guard: it may only ever go **up**.

For any UI work, a **Playwright walkthrough against the unguarded `/dev/integrals/*` routes with
screenshots** is required. Unit tests are not sufficient evidence that a mode works; this bar is
established practice in this repo and has caught real bugs.

Lint note: `npx eslint src` reports ~95 pre-existing findings across ~42 files, all outside this
task's scope. Filter eslint's JSON output on the paths you touched rather than eyeballing the list.

## Pre-flight checklist — before writing any problem or verification script

These are drawn from real failures already logged in `CLAUDE.md`; each one cost a session.

- [ ] `integrandExpr` is written in terms of **`x`**, whatever letter the source uses. `fn()` binds
      `x` regardless, so a `t`-named expression silently evaluates to zero and quadrature "passes".
- [ ] A throwaway verification script must **not** reuse the naming of the thing it verifies — that
      is how the above bug hid. Trust `npx vitest run`, never a script alone.
- [ ] Domain chosen so intermediates stay inside double precision — a large constant in an exponent
      overflows long before the maths breaks.
- [ ] Grepped `bank/*.ts` for the integrand before adding; the exact-duplicate test misses the same
      integral in different notation.
- [ ] Numeric margin is comfortable, not marginal (error well inside ~50% of tolerance).

## Commit cadence

Commit at the end of **each workstream**, and at any natural midpoint inside one. Every commit
message names what shipped **and what was deliberately skipped, with the reason**. Push to
`claude/pensive-tesla-421vh8` with `git push -u origin claude/pensive-tesla-421vh8`; on network
failure retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s).

Append a dated entry to the **Progress log** at the bottom of `CLAUDE.md` before moving to the next
workstream, noting what shipped, what was skipped and why, and what is next.

## Stop and report — do not improvise past these

- The test suite is red before your first edit.
- Landing a workstream would require editing an existing passing test.
- A workstream turns out to need new problem content to be worth shipping.
- The window closes (13 Sep) with workstreams outstanding — **cut scope, do not extend the window**.
  Shipping WS-1 and WS-2 on time beats shipping all five late.
- Any finding that a standing directive in `CLAUDE.md` now conflicts with this objective. That is
  the owner's call, not the agent's.
