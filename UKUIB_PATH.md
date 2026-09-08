# UKUIB Path — a Duolingo-style course for the UK University Integration Bee

**Status:** scoping document + working runbook. Branch `claude/ukuib-duolingo-style-build-qtc2k9`.
Baseline at the start of this work: **2487/2487 tests passing across 44 files**, `npx tsc --noEmit -p
tsconfig.app.json` clean.

This document supersedes `UK_BEE_BURST.md` for the UKUIB course work specifically. `CLAUDE.md`'s
standing directives still apply in full — in particular **no AI grading in the live app** (#3),
**deterministic UX** (#4), and **sourced problems only** (#2). The last of those is no longer a
blocker: the owner has supplied 30 genuine UKUIB documents, so there is a large well of real
sourced content to draw on.

---

## 1. What the syllabus actually asks for

Extracted verbatim from `UK_University_Integration_Bee_Syllabus.pdf` (Vishal Gupta, 3 pages). The
syllabus is explicitly "a guideline of content that will allow you to be able to solve each problem
rather than a strict requirement" — advanced machinery can often be dodged with a clever
substitution. That framing matters for the course: **recognition and route-choice are the skill**,
not encyclopaedic knowledge of special functions.

### §1 Integration Techniques (7 required items, 1 explicitly excluded)

| # | Item | Covered today by | Status |
|---|---|---|---|
| 1.1 | Everything on the A-Level and STEP syllabus for integration, incl. substitution and by parts | `power`, `u-sub`, `parts`, `trig-identity`, `trig-sub`, `partial-fractions`, `complete-square`, `recurrence`, `inverse-integral` | ✅ covered |
| 1.2 | DUTIS: `d/dt ∫ₐᵇ f(x,t)dx = ∫ₐᵇ ∂f/∂t dx` | `feynman` | ✅ covered |
| 1.3 | DUTIS general version, with variable limits `a(t)`, `b(t)` (full Leibniz rule) | — | ❌ **GAP** |
| 1.4 | t-sub, `t = tan(x/2)` | `t-sub` | ✅ covered |
| 1.5 | Infinite series and their use; swapping `∫` and `Σ` (convergence not examined) | partially, inside `zeta-series` / `log-power-integrals` | ⚠️ **GAP as a technique in its own right** |
| 1.6 | Reflection property `∫ₐᵇ f(x)dx = ∫ₐᵇ f(a+b−x)dx` | `symmetry` — but only the `[0,a]` King's-rule form | ⚠️ **needs the general `[a,b]` form** |
| 1.7 | Odd and even functions | `symmetry` | ✅ covered |
| ✗ | Green's / Stokes' / Divergence theorems and vector calculus | — | **excluded by the syllabus — do not teach** |

### §2 Functions & Specific results (9 items)

| # | Item | Covered today by | Status |
|---|---|---|---|
| 2.1 | Gamma function `Γ(n) = ∫₀^∞ xⁿ⁻¹e⁻ˣdx` | `gamma-function` | ✅ covered |
| 2.2 | Euler reflection formula `Γ(s)Γ(1−s) = π/sin(πs)` | used in the `reciprocal-substitution` bank; no lesson | ❌ **GAP** |
| 2.3 | Beta function `B(x,y) = ∫₀¹tˣ⁻¹(1−t)^{y−1}dt = Γ(x)Γ(y)/Γ(x+y)` | `beta-integrals` | ✅ covered |
| 2.4 | Riemann zeta `ζ(s) = Σ1/nˢ`, Re(s) > 1 | `zeta-series` | ✅ covered |
| 2.5 | Floor `⌊x⌋`, ceiling `⌈x⌉`, fractional part `{x}` | `floor-function` | ✅ covered |
| 2.6 | Named series: `Σ1/n² = π²/6`, `Σ(−1)ⁿ/(2n+1)² = G` (Catalan), `Σ(−1)ⁿ/(2n+1)³ = π³/32`, `Σ_{−∞}^{∞}1/(n²+1) = π coth π`, `Σ_{−∞}^{∞}(−1)ⁿ/(n²+1) = π csch π` | only `π²/6`, inside `zeta-series` | ❌ **GAP** — four of the five are absent |
| 2.7 | Euler–Mascheroni constant `γ = lim(Σ1/k − ln n)` | — | ❌ **GAP** |
| 2.8 | Wallis' product `∏4n²/(4n²−1) = π/2` | `wallis-product` | ✅ covered |
| 2.9 | Sine product `sin(πx)/(πx) = ∏(1 − x²/n²)` | mentioned as lesson colour only | ❌ **GAP** |

### The six new lessons this course needs

`leibniz-rule` · `series-swap` · `euler-reflection` · `named-series` · `euler-mascheroni` ·
`sine-product`

Plus one extension to an existing lesson: `symmetry` gains the general `∫ₐᵇ f(a+b−x)` form
alongside the `[0,a]` case it already teaches. That takes the curriculum from **21 to 27
techniques**, and — for the first time — to **complete syllabus coverage**.

---

## 2. What "Duolingo style" means here, concretely

Duolingo's teaching loop, and what each part maps onto in this repo. The honest headline: **this is
not a rewrite.** Most of the machinery exists already and has been built and tested over many
sessions. What's missing is the *composition layer* — a path, a lesson player, and per-skill
progression — plus content for the gaps above.

| Duolingo mechanic | What we build | What it reuses |
|---|---|---|
| A **path** of units you unlock in order | `ukuib/curriculum.ts` + the path page | technique/problem metadata |
| **Short lessons** (~8 exercises, 3–5 min) ending in a summary + XP | `ukuib/lesson.ts` assembly + the lesson player | `problems.ts`, `techniques.ts` |
| **Exercise variety** inside one lesson | 6 exercise types (below) | `AnswerInput`, `recognition.ts`, `Completion`, `valuesDeck.ts` |
| **Teach before test** — the tip card | `teach` exercise type | `techniques.ts` `intuition` + `examples` |
| **Crowns** — repeat a skill to level it up, harder each time | `ukuibProgress.ts` crown state; lesson assembly reads crown level | `Difficulty` bands |
| **Spaced resurfacing** of old material | interleaved review slots in lesson assembly | `conceptReview.ts`, `queue.ts`'s `scheduledQueue` |
| **Hearts** — a run ends on 5 mistakes | `ukuibProgress.ts` per-lesson hearts | — |
| **Streak / XP / leagues** | reuse the Arena's | `progress.ts`, `leaderboard.ts` |
| **Checkpoint tests** to prove a unit | `ukuib/checkpoint.ts` | `uk/paper.ts` assembly patterns |

### The six exercise types

All deterministic, all graded locally — **no model call at runtime**, per standing directive #3.

1. **`teach`** — a tip card: the technique's `intuition`, its recognition cue, and one worked
   example stepped through one beat at a time. Not scored; "Got it" advances.
2. **`recognise`** — "which technique cracks this?", four options. Reuses `recognition.ts`'s
   `distractorsFor`, which already prefers genuinely confusable siblings via `techniqueMap.ts`.
   **Not used by any default lesson shape** (see the note below) — the type and grader stay in
   `exercises.ts` for the recognition drill and any future shape that wants it, but lessons don't
   ask for it.
3. **`complete`** — a worked solution with the final move blanked out; the student supplies it.
   Reuses the `Completion` records added in WS-10 and grades with `answer.ts`.
4. **`order`** — the beats of a method arrived shuffled; tap them into the right sequence. Built
   from a technique's `recipe`. Pure recall of procedure, no algebra.
5. **`value`** — "what is `∫₀^∞ x³e⁻ˣdx`?" from the values deck, as multiple choice at low crowns
   and free entry at high ones. Reuses `valuesDeck.ts`.
6. **`solve`** — a real bank problem, typed or built with the symbol palette, hints available.
   Reuses `AnswerInput` and the existing grading path untouched.

### Lesson shapes by crown level

| Crown | Shape | Difficulty band |
|---|---|---|
| 0 → 1 | `teach`, 1× `order`, 2× `complete`, 3× `solve` | 1–2 |
| 1 → 2 | 2× `complete`, 5× `solve` | 2–3 |
| 2 → 3 | 1× `value`, 1× `complete`, 5× `solve`, 1 interleaved review from an earlier skill | 3–4 |
| 3 → 4 | 1× `value`, 6× `solve`, 2 interleaved reviews | 4–5 |
| 4 → 5 ("legendary") | 8× `solve`, no hints, a clock | 4–5 |

Scaffolding falls away as the crown rises — that progression *is* the pedagogy, and it's the thing
a flat "pick a technique and grind" training room can't express.

**Revised after real usage feedback**: the first cut of this table had 2× and then 1× `recognise`
("which technique cracks this?") at the two lowest crowns. Feedback was direct — guessing a label
before solving anything teaches guessing, not integration — so `recognise` was cut from every
lesson shape and its slots redistributed into `complete`/`solve`, the two exercise types that
actually make a student work the problem. See `lesson.ts`'s own comment on `SHAPES` for the same
note in the code.

### Hearts — the one deliberately un-Duolingo decision

Hearts are in, because the tension is a real part of why the format works: **5 per lesson, a wrong
answer costs one, running out ends the lesson and you retry it.** But they **refill instantly and
free on exit** — no timers, no paywall, no waiting. The mechanic is there to make you concentrate,
not to sell you out of a hole. Flagged here as a design call the owner can overrule (a settings
toggle for "no hearts" is a ten-line change if wanted).

---

## 3. The curriculum — 10 units

Ordered as a *learning* progression, which is deliberately not the syllabus's own checklist order.
Every syllabus item is accounted for; the § reference on each unit says which.

| Unit | Name | Skills | Syllabus |
|---|---|---|---|
| 0 | **Foundations** | `power`, `u-sub`, `parts`, `trig-identity`, `trig-sub`, `partial-fractions`, `complete-square` | §1.1 |
| 1 | **STEP manoeuvres** | `recurrence`, `inverse-integral` | §1.1 |
| 2 | **Symmetry** | `symmetry` (odd/even + the general reflection property), `reciprocal-substitution` | §1.6, §1.7 |
| 3 | **The universal substitution** | `t-sub` | §1.4 |
| 4 | **Under the integral sign** | `feynman`, **`leibniz-rule`**, `introducing-constants` | §1.2, §1.3 |
| 5 | **Series and integrals** | **`series-swap`**, `zeta-series`, `log-power-integrals`, **`named-series`** | §1.5, §2.4, §2.6 |
| 6 | **Gamma and Beta** | `gamma-function`, `beta-integrals`, **`euler-reflection`**, `gaussian-hypersphere` | §2.1, §2.2, §2.3 |
| 7 | **Discontinuous integrands** | `floor-function` | §2.5 |
| 8 | **Infinite products and constants** | `wallis-product`, **`sine-product`**, **`euler-mascheroni`** | §2.7, §2.8, §2.9 |
| 9 | **The Bee** | no new technique — mixed papers at competition pace, real UKUIB rounds | — |

**Bold** = a lesson that does not exist yet and must be written.

Each unit ends in a **checkpoint**: 10 mixed problems drawn only from that unit's skills, no hints,
pass at 7/10. Passing a checkpoint you haven't earned yet (available from the path) skips the unit —
Duolingo's "jump here" test, and the right affordance for someone who is already strong at A-level
material and shouldn't be made to grind Unit 0.

---

## 4. Architecture

Everything new lives under `src/features/integrals/ukuib/` and `src/pages/Ukuib*.tsx`. Nothing in
the existing Integral Arena changes behaviour; the course is a new consumer of the same bank,
lessons and grader.

```
src/features/integrals/
  lessons/                     NEW — one module per new Technique, so parallel authors never
    leibnizRule.ts                  collide in a single file. techniques.ts imports them.
    seriesSwap.ts
    eulerReflection.ts
    namedSeries.ts
    eulerMascheroni.ts
    sineProduct.ts
  bank/ukuib/                  NEW — one module per source document family.
    round1.ts                       2021–2025 Round 1 papers
    qualifier.ts                    Qualifier + Virtual Competition samples
    crossnumber.ts                  Crossnumber R2 sets, 2021–2025/26
    groupRelay.ts                   Group / Relay / Shuttle R2 sets
    round3.ts                       2024 R3 Chainlink / Dichotomy / Tournament (has solutions)
  ukuib/                       NEW — the course itself.
    curriculum.ts                   units, skills, crown rules; pure data + lookups
    lesson.ts                       exercise assembly: (skill, crown, progress) → Exercise[]
    exercises.ts                    the Exercise union and per-type grading
    checkpoint.ts                   unit test assembly and pass rules
    ukuibProgress.ts                XP, crowns, hearts, unlocks — scoped, fail-soft localStorage
  hooks/
    useUkuibProgress.ts        NEW
    useUkuibLesson.ts          NEW — the lesson run state machine

src/pages/
  UkuibPath.tsx                NEW — the path: units, nodes, crowns, "START" bubble
  UkuibLesson.tsx              NEW — the player, full-bleed outside AppShell
  UkuibSkill.tsx               NEW — skill detail: crown level, lesson list, the reference lesson
  UkuibCheckpoint.tsx          NEW — unit test
```

**Routes** (`DashboardGuard`, no `BetaGate` — matching every other Integral Arena route), each with
its `import.meta.env.DEV` twin under `/dev/` so Playwright can drive them without auth:

```
/ukuib                        the path
/ukuib/skill/:skillId         skill detail
/ukuib/lesson/:skillId        the lesson player
/ukuib/checkpoint/:unitId     unit checkpoint
```

Plus a **"UK Bee"** entry in `AppShell`'s Practice nav group, beside Drills / Integrals / Firm OAs.
That is the "separate part of the UI for UKUIB" the brief asks for: the Arena stays exactly as it
is for free-form practice, and the course is its own front door.

### Storage

`ukuibProgress.ts` follows the pattern every store since `attempts.ts` uses — `scopedKey` from
`progress.ts`, fail-soft when storage is unavailable, a listener set, and a cache that
re-checks the scoped key on every read:

```ts
interface UkuibProgress {
  version: 1;
  skills: Record<SkillId, { crown: number; lessonsDone: number; lastAt: string }>;
  checkpoints: Record<UnitId, { passed: boolean; best: number; at: string }>;
  xp: number;
  // hearts are per-lesson and never persisted — they refill on exit by construction
}
```

XP also banks into the Arena's existing `progress.ts` so one streak and one level cover both
surfaces. A student should not have two competing notions of "how far along am I".

---

## 5. Content: 30 documents, ~464 problems

The owner supplied the complete UKUIB archive. Inventory (numbered problems per document):

| Family | Documents | Problems |
|---|---|---|
| **Round 1** | 2021, 2022, 2023, 2024, 2025 Online, Oxford 2022, MIT Tiebreaker 2022, Tiebreaker 2022 | ~240 |
| **Qualifier / samples** | Qualifier (20), Virtual Integration Competition (20) | ~40 |
| **Crossnumber R2** | 2021, 2022, 2023, 2024 (across/down), 2025/26 (across/down/grids) | ~90 |
| **Group / Relay / Shuttle R2** | 2021, 2022, 2023, 2024, 2025/26 | ~80 |
| **Round 3 (2024) — with full solutions** | Chainlink (5 games + answers + solutions), Dichotomy (3 segments + answers + solutions), Tournament (slides + solutions), 4 tiebreakers | ~30 |

**Mine the 2024 R3 set first** — it is the only material with printed worked solutions
(`Chainlink_Solutions`, `Dichotomy_Solutions`, `Tournament_Solutions`, 15–18k characters each), so
it is both the cheapest per problem and the best calibration for what this competition's answers are
supposed to look like. Everything else is problems-only and needs the full by-hand derivation.

Every problem gets a real source: `{ name: "UK University Integration Bee", year, round }` — so the
existing by-source practice view gains the actual UKUIB papers, sittable uncurated, which is exactly
what someone preparing for this competition wants.

### The bar for a problem entering the bank

Unchanged from `CLAUDE.md`'s Workflow, and non-negotiable:

1. Derive the closed form by hand.
2. Verify numerically in a throwaway script mirroring `problems.test.ts`'s `derivative()` /
   `quadrature()` **before** writing it into a bank file. Comfortable margin, not a squeaker.
3. `grep` the bank for the integrand first — duplicates get the **existing** entry re-attributed,
   never a second copy.
4. Write `integrandExpr` **in terms of `x`**, whatever letter the source used.
5. Full suite + `tsc -p tsconfig.app.json` + `eslint` on touched files, then commit.

Skips are logged with a reason, never silent. Expect real ones: this archive contains
fast-oscillation and sawtooth integrands the shared `n=4000` quadrature provably cannot resolve
(four such cases are already on record in `CLAUDE.md`), plus OCR ambiguity in the extracted text.

---

## 6. Workstreams, in order

- **WS-A · Curriculum engine.** `curriculum.ts`, `exercises.ts`, `lesson.ts`, `checkpoint.ts`,
  `ukuibProgress.ts` + hooks. Pure modules, unit-tested, no UI. The 21 existing techniques wire up
  immediately; the 6 new ones slot in as they land.
- **WS-B · The UI section.** Path, skill detail, lesson player, checkpoint, routes, nav entry.
  Playwright walkthrough mandatory — a lesson run is a UI mode and unit tests are not sufficient
  evidence for one.
- **WS-C · The six new lessons.** One agent per lesson, one file per agent under `lessons/`. Full
  WS-2/WS-8/WS-10 schema: `prerequisites`, `intuition`, graduated `examples`, `completions`,
  `selfExplain`, `checkYourself`, `pitfalls`. Every numeric claim carries an
  `integrandExpr`/`resultExpr` mirror so `lessonExamples.test.ts` checks it automatically.
- **WS-D · The content seed.** One agent per document family, one bank file per agent. R3-with-
  solutions first, then Round 1s, then R2 sets.
- **WS-E · Wiring and polish.** Aggregate the new lessons into `techniques.ts` and the new banks
  into `problems.ts`; extend `symmetry` with the general reflection property; `techniqueMap.ts`
  entries for the 6 new techniques so the recognition drill's distractors stay sharp.

Parallel-safety rule for every agent: **one owned file each, no shared-file edits.** Aggregation
into `techniques.ts` / `problems.ts` / `types.ts` happens in WS-E, by one writer, at the end.

---

## Progress log

- 2026-09-02: Scoped. Syllabus extracted and mapped item-by-item against the existing 21 techniques
  — 6 genuine lesson gaps found (`leibniz-rule`, `series-swap`, `euler-reflection`, `named-series`,
  `euler-mascheroni`, `sine-product`) plus one extension to `symmetry`. 30 UKUIB documents extracted
  to text (`pymupdf`; poppler is not installed in this sandbox), ~464 numbered problems inventoried,
  and the 2024 R3 set identified as the only material carrying printed solutions. Baseline
  reproduced before any edit: 2487/2487 passing across 44 files.

- 2026-09-03: **WS-A (curriculum engine) and WS-B (the UI section) are shipped.** Commits `6f78f19`
  (engine, 72 tests), `34c603b` (path, skill page, lesson player, checkpoint, routes, nav entry),
  `83f218b` (three bugs the browser walkthrough caught), `b6c7d53` (a numeric guard for the Leibniz
  lesson). Plus `c6f9920` and the Euler reflection lesson inside `34c603b` — **four of the six
  syllabus-gap lessons are written and verified**: `leibniz-rule`, `series-swap`, `named-series`,
  `euler-reflection`. `sine-product` and `euler-mascheroni` are in flight.
  - Every lesson's arithmetic is machine-checked before it ships. The integral claims go through
    `harness.local/verify.ts`, which mirrors `problems.test.ts` exactly (same `normalize()`, same
    five-point difference, same smoothstep quadrature, same tolerances) — 15 claims across the four
    lessons, all passing with three orders of magnitude of margin. The Leibniz lesson's `d/dt`
    claims cannot go through that harness by shape, so they get their own permanent test
    (`lessons/leibnizRule.test.ts`) that finite-differences a numerically-integrated `F(t)`.
  - **The browser walkthrough earned its place.** Driving one real lesson end to end in Chromium
    found three things no unit test could: multiple-choice feedback colours that never rendered
    (`.glass-card` sets the `border`/`background` shorthands, which beat any Tailwind
    border-color/background-color utility; and Tailwind's arbitrary-value parser does not reliably
    handle a nested `color-mix()` inside a shadow — both failures silent); two Check buttons on one
    screen; and completion exercises that asked for a sub-step while grading the whole closed form.
    All three fixed. Final run: lesson completed correctly, crown awarded, 22 XP banked, both solves
    landing in the shared attempt log as mode `"ukuib"`, next skill unlocked, zero console or page
    errors.
  - **Tooling notes for whoever is next.** `harness.local/` is gitignored (`*.local`) and holds the
    whole verification kit: `verify.ts` (the candidate gate), `render.ts` (strict-mode KaTeX sweep
    over a lesson module), `extract.ts` (pull a lesson's checkable claims into a candidates file),
    the two agent briefs, and `walk.mjs` (the Playwright walkthrough). The dev server needs
    `--host 127.0.0.1` (the default `::` bind fails in this sandbox). In-page links point at the
    guarded `/ukuib/*` routes, so a walkthrough must drive the `/dev/` twins directly and assert on
    hrefs rather than clicking through. `npx tsc --noEmit` at the repo root is still a no-op — use
    `-p tsconfig.app.json`.
  - **One pre-existing flake worth knowing about, not caused by this work:**
    `src/features/oa/oaPage.test.tsx > the hub > lists the firms…` times out at the default 5000ms
    when the machine is loaded (it ran five mining agents concurrently). In isolation it passes in
    2.5s — which is half the budget, so it is genuinely close to the line. Left alone: it is outside
    this task's scope, and the honest fix is a longer timeout on that test, which is its owner's
    call.
  - **Next:** WS-C's last two lessons, WS-D (the content seed — agents are working the 2024 R3 set,
    2021 Round 1 and the 2022 family now), then WS-E: aggregate `lessons/*` into `techniques.ts`,
    the new banks into `problems.ts`, place all six new ids in `techniqueMap.ts`, and update the
    `ALL_IDS.length` count guard in `techniqueMap.test.ts` from 21 to 27. That count guard is
    *designed* to fail when the curriculum grows; updating it is the intended maintenance, not a
    weakened assertion.

- 2026-09-03 (continued): **All six syllabus lessons wired in** (commit `cbee34a`) via a new
  `LESSON_ONLY_TECHNIQUES` list — teachable, deliberately outside the drill curriculum `TECHNIQUES`
  until each has a real practice pool (forcing them in now would mean either invented problems,
  which standing directive #2 forbids, or weakening the "every technique has 5+ problems" invariant
  `problems.test.ts` depends on). `lessonExamples.test.ts`/`mathText.test.ts` now sweep the union
  (`ALL_LESSONS`), so unrendered LaTeX in an unpractised lesson still fails loudly.
  - **Direct product feedback acted on** (commit `843d9ce`): the `recognise` ("which technique
    cracks this?") exercise was cut from every lesson shape — guessing a label before solving
    anything teaches guessing, not integration. Slots redistributed into `complete`/`solve`. The
    exercise type and its grader stay in `exercises.ts` (the standalone "Name the weapon" drill
    still uses the same distractor logic), only the lesson `SHAPES` stopped asking for it.
    Re-verified end to end against the real dev server after the change: full lesson completes
    correctly under the new shape, zero console errors.
  - **All five mining agents hit a shared session rate limit** (resets 3:20pm UTC) mid-run. Two had
    already written real, verified content to disk before being killed — `round1_2022.ts` (18
    problems, with a careful cross-document duplicate map worked out across the four overlapping
    2022 papers before mining) and `round3.ts` (42 problems from the 2024 Round 3 answer-key set).
    **Independently re-verified all 60 myself** with `harness.local/extractbank.ts` +
    `harness.local/verify.ts` before committing — never trusted an agent's own "all verified" report
    without re-deriving it from the file on disk. All 60 pass with real margin; structural checks
    (duplicate ids, missing steps/hints/source, definite problems without bounds, a `round` that
    looks like a per-problem citation locator) all clean.
  - Full suite: **2597/2597 passing across 48 files** (was 2487 at the start of this whole effort).
  - **Next**: relaunch the mining agents once the rate limit clears (2021 Round 1, the remainder of
    the 2022 family, 2023/2024 Round 1, and 2025/Qualifier/Virtual are all still unmined or
    partially mined), then WS-E's remaining piece — `techniqueMap.ts` placement for the six new
    technique ids and the `ALL_IDS.length` guard bump from 21 to 27 (deferred until the six either
    get a real drill pool or a deliberate call is made on whether a lesson-only technique belongs in
    that map at all — it's currently keyed to `TECHNIQUES`, not `ALL_LESSONS`, on purpose per its own
    header comment, and widening that scope is a judgment call worth making deliberately rather than
    as a side effect of an unrelated commit).

- 2026-09-08 (new session start, model switched to Sonnet by the owner mid-session to manage
  usage): Picked up after a run of container restarts and rate limits (a session limit, then a
  full weekly limit) had killed seven mining agents in a row without any of them writing a single
  problem to disk — confirmed by checking `src/features/integrals/bank/ukuib/` (still exactly the
  60 problems from the last real checkpoint) before doing anything else, rather than trusting the
  failure notifications' timing. No content was lost; nothing to recover.
  - **Closed the deferred `techniqueMap.ts` placement** (commit `cdf5909`) — this had been flagged
    as "a judgment call worth making deliberately" ever since the six syllabus lessons were wired
    into `TECHNIQUES`. Did it properly this time: read all six lessons' actual `prerequisites`/
    `intuition` text in full before placing any of them, rather than guessing. Found a real,
    grounded precedent already in the map (the `differentiate-under-integral` family already pairs
    a general technique with its own specific repeated instance — feynman + log-power-integrals) —
    that justified two genuine placements: `leibniz-rule` joins that same family, and a brand-new
    `series-expansion` family holds `series-swap` + `zeta-series` (zeta-series moved out of
    `STANDALONE_TECHNIQUES`, its existing cross-link to gamma-function untouched). The other four
    (`named-series`, `euler-reflection`, `euler-mascheroni`, `sine-product`) are standalone with
    real cross-links, each grounded in a specific derivation step cited in the lesson text, not a
    vague resemblance. Widened `techniqueMap.test.ts`'s totality check from `TECHNIQUES` (21) to
    `ALL_LESSONS` (27) so it actually covers what the map now claims to place. 2608/2608 passing
    (was 2597), tsc and eslint clean.
  - **Re-ran the full Playwright walkthrough from scratch** after all the churn (container
    restarts, the exercise-shape change, the techniqueMap change) — full lesson completes
    correctly end to end, crown awarded, XP banked, attempts logged, next skill unlocked, zero
    console errors. Also spot-checked two of the six lesson-only skill pages directly
    (`leibniz-rule`, `series-swap`) to confirm they render through the ordinary UKUIB skill route
    (they have real `Skill` entries in `curriculum.ts` pointing at their technique ids, and
    `TECHNIQUE_BY_ID` already resolves all 27) — both render the complete lesson correctly,
    prerequisites through check-yourself.
  - **Mining status**: relaunched all 7 outstanding mining agents (2021 Round 1, rest of the 2022
    family, 2023/2024 Round 1, 2025/Qualifier/Virtual, Group Round 2021-2026, Relay+Shuttle,
    Crossnumber) once real time had clearly moved past both the session-limit and weekly-limit
    reset windows — all seven were killed by the weekly limit on the first relaunch attempt,
    confirmed nothing had been written to disk by any of them. Sent a single test agent (2021
    Round 1 alone) after further real time passed to confirm the limit had actually cleared before
    relaunching the rest — cautious after two rounds of immediate kills, not wanting to burn seven
    launches on a wall that hadn't cleared yet.
  - **Newly scoped for the Group/Relay/Shuttle/Crossnumber families** (not in the original
    UKUIB_PATH.md content-seed section, discovered by reading the source documents directly this
    session): these Round Two formats are genuinely different from every Round One-style paper
    mined so far.
    - **Group Round** (5 documents, 2021-2026, ~54 problems): standalone integrals, but unusually
      hard ones — multi-integrals, infinite sums inside integrands, argmax, implicit-function
      definitions. Briefed the mining agent to use CLAUDE.md's existing "Nothing gets dropped"
      playbook (Cauchy's formula for iterated integrals, sum-to-closed-form substitution,
      continued-fraction fixed points) rather than force or skip wholesale.
    - **Relay and Shuttle rounds** (5 documents): a genuinely new pattern not seen in any
      previously-mined document — CHAINED puzzles, where a later question's stated integral
      literally contains a letter (`a`, `b`, ...) meaning "the numeric answer to the previous
      question in this chain." Briefed the agent to solve each chain in order and substitute the
      real, determined handoff value — not a free choice the way the existing "pick specific
      values" convention is, since the puzzle format itself fixes exactly one correct value at each
      step. A chain that can't be resolved with confidence skips the *entire remainder* of that
      chain, not just the unclear step, since every later value depends on it.
    - **Crossnumber round** (9 documents, some likely blank grids to be skipped outright): the
      hardest new case. A Crossnumber is a crossword-style puzzle where clues routinely reference
      EACH OTHER by grid position ("x = final digit of 4 DOWN"), which cannot become a standalone
      `Problem` — solving one requires solving the whole grid as a coupled system, a fundamentally
      different kind of puzzle than this bank's one-integral-one-answer schema. Briefed the agent
      to triage every clue into "self-contained integral" vs. "references another clue" BEFORE
      attempting any calculus, and mine only the former.
  - **Next**: once the weekly limit is confirmed clear (the single test agent's result will tell
    us), relaunch the remaining 6 mining agents (2021 Round 1 may already be done by the test
    agent) covering: rest of 2022 family, 2023/2024 Round 1, 2025/Qualifier/Virtual, Group Round,
    Relay+Shuttle, Crossnumber. Independently re-verify every problem any agent reports (never
    trust an agent's own "all verified" claim — re-run `harness.local/extractbank.ts` +
    `harness.local/verify.ts` against the actual file on disk, as done for the first 60) before
    committing. This is now the single largest remaining piece of the whole UKUIB task — the
    course engine, UI, and all six syllabus lessons are complete and verified; what's left is
    volume content.

- 2026-09-08: Rate limits killed several mining waves mid-run over the following sessions, but the
  incremental-write discipline held — every restart recovered real partial work rather than losing
  it. This session picked up from three files sitting on disk from the most recent kill
  (`round1_2022.ts` grown from 18→42 problems, plus two brand-new files `groupRound.ts` and
  `qualifier.ts`), independently re-verified everything via `harness.local/extractbank.ts` +
  `harness.local/verify.ts` (never trusting the agents' own now-unrecoverable reports, since they
  died before filing them), and fixed 4 real bugs the harness's approximate mirror can't catch on
  its own: 3 stray-`$`/unbraced-macro-arg LaTeX bugs (same class WS-8 hit in the main Arena) and
  one `domain` narrowed to `[0.05,0.95]` on a problem whose real bounds are `[0,1]` — for a
  *definite* problem `domain` **is** the actual integration range fed to quadrature, so narrowing
  it silently changes the value being checked (∫₀.₀₅^0.95 1 dx = 0.9, not the real ∫₀¹ 1 dx = 1).
  Added an explicit warning about this to `AGENT_BRIEF_MINING.md` so future mining agents don't
  repeat it, and added the incremental-write instruction to the brief itself (it had only ever
  been said verbally in each dispatch prompt, never written down for an agent to find on its own).
  - **The bigger find**: all six `bank/ukuib/*.ts` files that existed before this session — every
    problem mined across every prior wave — were exported but never *imported* anywhere. Nothing
    in `problems.ts`'s `PROBLEMS` aggregation pulled them in, which means (a) `problems.test.ts`'s
    numeric self-verification had never actually run on any of this content for real, only through
    the harness's approximate mirror, and (b) the UKUIB lesson engine (`ukuib/lesson.ts` sources
    its exercise pool from `PROBLEMS`/`problemsForTechnique`, both from `problems.ts`) could not
    reach a single one of these problems — every mined UKUIB integral was pedagogically inert.
    Wired all six files into `PROBLEMS`. Running the real suite for the first time surfaced 7 exact
    cross-file duplicate integrals the harness's per-file mirror structurally cannot catch (it
    never compares against the rest of the bank): 3 were genuine cross-competition coincidences
    (MIT/UKUIB reusing the same classic integral) — kept the pre-existing, correctly-sourced entry
    and dropped the UKUIB copy; 2 were the same UKUIB integral reused across different years of its
    own competition — kept the earlier year; 2 were pre-existing `{name: "original"}` entries that
    turned out to be the exact same integral as a real, dated UKUIB problem — re-attributed to the
    more specific real source instead of keeping two copies, matching this repo's established
    duplicate-handling convention throughout its whole history.
  - Also fixed two documentation-accuracy issues while integrating: `groupRound.ts`'s header
    claimed coverage of all 5 years 2021-2026, but the agent that wrote it was killed before
    reaching 2023-2025 — only 2021+2022 (11 problems after dedup) are actually in the file; the
    header now says so honestly instead of overclaiming, and flags the remaining 3 years for a
    future mining pass. `qualifier.ts`'s header referenced a `harness.local/report-qualifier.md`
    skip report that was never written (same kill-before-report-stage pattern) — replaced the
    dangling reference with the real final counts (40 problems shipped across
    Virtual-Integration-Competition/Qualifier-workshop/2025-26-Round-1 sources) and an honest note
    that the ~35 unshipped candidates' specific skip reasons weren't separately recorded.
  - Committed as `4dff6ff`, pushed. 2703/2703 passing in `src/features/integrals` (3006/3006 whole
    repo), `tsc -p tsconfig.app.json` clean, eslint clean on every touched file.
  - **Relaunched the three still-fully-unmined document families**, staggered as 3 concurrent
    agents (not 7 — a batch of 7 launched together tripped a burst/concurrency limit twice earlier
    in this task's history; 3 has been the largest batch size that's reliably succeeded):
    `groupRound2023_2026.ts` (2023/2024/2025-26 Group Round — a head start exists in
    `harness.local/gr-2023/2024/2025-candidates.json` from an earlier killed wave, agent briefed to
    re-verify rather than trust those), `relayShuttle.ts` (2021 Shuttle + 2022-2025/26 Relay —
    genuinely new chained-puzzle format, briefed to resolve each chain's handoff value in order
    using `round3.ts`'s already-shipped "Chainlink" section as a worked precedent for turning a
    chain into ordinary standalone `Problem` entries), `crossnumber.ts` (2021-2025/26 Crossnumber —
    briefed that each clue is just a standalone integral once you ignore the grid/digit-placement
    machinery entirely, and to skip the blank-grid-only files). All three still running as of this
    entry.
  - **Next**: when these land, independently re-verify (never trust an agent's own report — this
    session's own 7-duplicate/4-LaTeX-bug find is exactly why), wire into `problems.ts`, run the
    real suite, typecheck, lint, commit. If any of the three families needs a genuine engineering
    investment this session doesn't have runway for (a chain that can't be resolved, a Crossnumber
    clue that's irreducibly coupled to another), that will show up in each agent's own skip report
    rather than being silently forced. Once all three land, every UKUIB source document identified
    so far will have at least one completed mining pass — the lessons (all 6 syllabus-gap
    techniques) and the course engine/UI were already done in earlier sessions, so this closes out
    the "seed all ~464 problems" task's first full pass.

  - **All three landed. Every identified UKUIB document family now has a completed mining pass,
    independently re-verified and wired into the live pool.**
    - `groupRound2023_2026.ts` (18 problems, 2023-2026 Group Round) — clean run, no LaTeX/domain
      bugs, zero duplicates. One kept MARGINAL (`ukuib24gr-p7`, ratio 0.605 at the shipping n=4000)
      after confirming the derivation is airtight (a Fourier-series/Frullani argument) and that it
      converges cleanly at higher n (0.062 @ 20000, 0.023 @ 80000) — a real value that just
      converges slowly, not a wrong one. Committed `c77cd55`.
    - `crossnumber.ts` (8 of ~85 read clues — the lowest yield of any family, expected: most clues
      are grid arithmetic/cross-references/"solve for an unspecified f", not self-contained
      integrals). One more LaTeX bug of the by-now-familiar class (`\frac{...}xdx` — unbraced frac
      arg immediately followed by "dx" reads as one prose word to the auto-`\text{}` wrapper) found
      by the real suite and fixed. Zero duplicates. Also surfaced a real, unrelated test-timing
      issue: `floor-function`'s pool has grown to 28 problems across every mining session this
      year, and `integration.test.tsx`'s "ends the queue" test (which clicks Skip through the whole
      pool) was timing out at the default 5000ms under full-suite load — gave it an explicit 15s
      budget rather than weakening the assertion, same precedent as WS-1's ring-buffer test.
      Committed `5a2d77d`.
    - `relayShuttle.ts` (36 problems, 2021 Shuttle + 2022-2025/26 Relay) — the agent was killed by
      a rate limit right after finishing the file, before it could write a skip report; the file
      itself was genuine and complete (36/36 pass, none marginal), so it shipped with a report
      reconstructed from what survived rather than the agent's own account. Two duplicates found at
      integration time (impossible for either mining agent to have caught alone): the Shuttle's own
      chain-starting link was already in the bank as `feynman-log-squared` under `{name:
      "original"}` (re-attributed to the real 2021 Shuttle source); a 2023 Relay problem exactly
      repeated a 2022 Crossnumber problem mined by a sibling agent in the same parallel wave (kept
      the earlier, dropped the newer). Committed `a28c4a8`.
    - **Total UKUIB content now in the live pool: 259 problems** across 9 bank files
      (round1_2021: 30, round1_2022: 40, round1_2023_2024: 39, round3: 39, groupRound: 11,
      groupRound2023_2026: 18, qualifier: 40, crossnumber: 8, relayShuttle: 34), all reachable by
      the UKUIB lesson engine and the ordinary technique/source practice filters, all independently
      verified against the file actually on disk (never an agent's own report), zero cross-bank
      duplicates, zero LaTeX render failures. Whole-repo suite: 3126/3126 passing, `tsc -p
      tsconfig.app.json` clean.
    - **What's genuinely still missing, not silently dropped**: every skip report in this
      directory (gitignored, `harness.local/report-*.md`) documents specific unmined content with
      real reasons — mostly OCR-garbled source text, un-gradable special functions (Catalan's
      constant, Bessel functions), quadrature-resolution limits on verified-correct closed forms,
      and a recurring "integral equation, solve for f" schema mismatch this bank's `Problem` shape
      can't express. None of this is a good next target for another mining pass with the same
      brief — it's the genuine hard residue after several honest attempts, not low-hanging fruit
      left on the tree. The next content-volume lever, if the owner wants one, is re-attempting a
      specific hard case with more runway (e.g. the Crossnumber "integral equation" pattern, which
      recurred 6+ times and might warrant a deliberate schema extension) rather than a blind
      re-mine of the same documents.
