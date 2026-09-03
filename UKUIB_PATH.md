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
| 0 → 1 | `teach`, 2× `recognise`, 2× `order`/`complete`, 2× `solve` | 1–2 |
| 1 → 2 | 1× `recognise`, 2× `complete`, 4× `solve` | 2–3 |
| 2 → 3 | 1× `value`, 5× `solve`, 1 interleaved review from an earlier skill | 3–4 |
| 3 → 4 | 6× `solve`, 2 interleaved reviews | 4–5 |
| 4 → 5 ("legendary") | 8× `solve`, no hints, a clock | 4–5 |

Scaffolding falls away as the crown rises — that progression *is* the pedagogy, and it's the thing
a flat "pick a technique and grind" training room can't express.

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
