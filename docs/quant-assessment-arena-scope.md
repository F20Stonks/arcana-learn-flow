# Quant OA Arena — scope

**Status:** scoping only. Nothing in here is built yet.
**Branch:** `claude/quant-firm-assessments-353dbg`
**Goal:** replicate the online assessments a candidate actually receives when applying to quant
trading firms — Optiver, Jane Street, SIG, IMC, Flow Traders, Akuna, Citadel Securities, DRW,
G-Research and the rest — at the fidelity of the real thing: same module structure, same question
counts, same clocks, same scoring rules, same input constraints, same lack of feedback.

---

## 0. Two constraints stated up front

**Format is replicable; question sets are not.** Real OA question banks are confidential and
NDA-covered, and the vendor game suites (BrainsFirst NeurOlympics, Optiver's Zap-N) are branded
products. What this feature replicates is the *format and the experience* — counts, clocks,
scoring rules, input affordances, module ordering — with every item procedurally generated or
originally authored. No transcription of real assessment questions, no vendor logos or branding.
Firm names are used descriptively ("Optiver-style 80 in 8", "modelled on the Flow Traders math
test"), which is the same footing the existing prep market (JobTestPrep, TraderMath,
TradingInterview) operates on, plus a non-affiliation disclaimer.

**This inverts the integrals sourcing rule, deliberately.** `CLAUDE.md`'s "sourced content only,
no invented problems" directive is scoped to `src/features/integrals` and exists because integral
problems come from real competition papers. Here the opposite is true: transcribing sourced
questions is the thing we must *not* do, and generation is the only legitimate path. `CLAUDE.md`
also currently declares the whole repo out of scope except `src/features/integrals` — this request
supersedes that for a new feature directory, and `CLAUDE.md` should be updated to say so.

---

## 1. The landscape (researched, September 2026)

Formats are candidate-reported and **drift between recruiting cycles** — IMC swapped its 2026
trader screen for a shape-pattern test, SIG has been issuing a 60-minute variant of a 20-minute
test, Optiver added a "Likelihood Test" section. **Architectural consequence: firm specs are
versioned data, not code.** Every entry below becomes a record in a `firms/*.ts` catalog carrying
`lastVerified`, a `sourceNote`, and optionally more than one live variant, so a format change is a
data edit and old runs stay comparable against the spec they were taken under.

| Firm | Module | Items | Clock | Input | Scoring | Skip / back |
|---|---|---|---|---|---|---|
| **Optiver** | 80 in 8 (mental math) | 80 | 8 min | typed | +1 / −1 | no |
| | NumberLogic (sequences) | 26 | 25 min | typed | +1 / 0 | yes |
| | Beat the Odds (probability) | 10–30 | ~90 s **per question** | MCQ | +1 / 0 | no |
| | Zap-N | 9 mini-games | 2–15 min each, ~60 min | game | per-game metrics | n/a |
| | Likelihood Test (2026 variant) | — | — | rank 3 events | — | — |
| | Coding (QR / dev) | 3 (2 programming + 1 approximation) | 90 min | code | test cases | yes |
| | Personality | — | untimed | Likert / forced choice | none | yes |
| **Jane Street** | Mental math | 60 | 8 min | typed | ~70–80 % bar | no |
| | Probability / reasoning (HackerRank, 4 modules) | ~10 | 60 min | mixed | — | — |
| | Market-making game | live | live | two-sided quote | P&L | n/a |
| **Flow Traders** | Math test | 60 | 6 min | **MCQ** | +1 / −1 | no |
| | Sequences | 25 | 26 min | typed | +1 / 0 | yes |
| **Akuna Capital** | Math test | 80 | 8 min | typed | +1 / −1 | no |
| | Sequences | 24–30 | 12–16 min | typed | +1 / 0 | yes |
| | HackerRank coding (2nd OA) | — | — | code | test cases | yes |
| **SIG** | Quantitative Evaluation | 16 | 20 min (60 min variant reported) | MCQ | — | yes |
| | Problem Solving Assessment | — | — | MCQ | — | yes |
| **Citadel Securities** | OA | 15 | 30 min | MCQ | — | yes, any order |
| **DRW** | OA | 6 | 45 min | MCQ | — | yes |
| **IMC** | Trader quant screen | 15 | 60–75 min | MCQ | — | yes |
| | QR screen | 11 | 60–75 min | MCQ | — | yes |
| | BrainsFirst NeurOlympics | 4 games | ~45 min | game | cognitive profile | n/a |
| | "IMC Trader Assessment" (2026 variant) | — | — | shape patterns + personality | — | — |
| **G-Research** | Quant quiz (general or ML variant) | 10, five options each | 90 min | MCQ | — | yes; tab-switching tracked |
| **XTX Markets** | QR (ML + probability + data analysis) | — | ~90–120 min | mixed | — | yes |
| **HRT** | QR / trader prob-stat | — | ~90 min | mixed | — | yes |
| | SWE (HackerRank) | 2–3 hard | 90 min | code | test cases | yes |
| **Jump Trading** | QR / trader prob-stat | — | ~90 min | mixed | — | yes |
| **All Options** | Math test | 80 | 8 min | typed | +1 / −1 | no |
| **Five Rings** | Math screen | — | — | — | — | — |

Content areas reported across the MCQ screens: conditional probability and Bayes, expected value
and fair pricing, combinatorics, geometric / waiting-time distributions, variance of a density,
conditional expectation, limiting distributions, OLS, linear algebra, ODEs, GMAT-style data
sufficiency, chart and regression reading, options payoffs and put-call parity, directional greeks,
game theory and simplified poker.

---

## 2. The core insight: firms are configurations, not features

Twenty-plus firm assessments collapse into **twelve module archetypes**. Building twenty bespoke
tests is the wrong shape; building twelve engines and a catalog of firm configs is the right one.
Optiver's 80-in-8 and Akuna's 80-in-8 are the *same module* with different generator profiles.
Flow Traders' math test is that module again with `input: "mcq"` flipped on.

### A. Speed arithmetic battery
Covers Optiver, Akuna, Jane Street, Flow Traders, All Options, the SIG and IMC mental-math
components. Parameters: item count, total clock, `input: "typed" | "mcq"`, `negativeMarking`,
`allowSkip`, `allowBack`, `autoAdvance`, and an **arithmetic profile** — weighted mix over integer
add/sub ranges, 2×2-digit multiplication, division landing on integers, decimals, fractions,
percentages, and missing-operand forms (`7 × ? = 91`).

Direct extension of `src/features/drills/games/zetamac.ts`, whose generator already has the right
shape but a fixed operator set and integer-only output.

*Design problem worth naming:* the MCQ variant (Flow Traders) needs **plausible distractors**, not
random numbers — a wrong option set of `{91, 4, 7712, 0.03}` is free marks. Distractors must encode
the errors a rushed human actually makes: one digit off, sign flipped, decimal place shifted, digits
transposed, the other operand returned, off-by-a-power-of-ten. That is a per-profile distractor
function, and it is the difference between a real replication and a toy.

### B. Number sequences
Covers Optiver NumberLogic, Akuna, Flow Traders. Generator families: arithmetic, geometric,
polynomial / second-difference, Fibonacci-like recurrences, interleaved pairs, alternating sign,
digit-operation, prime- or index-driven, multiply-then-add, and letter sequences over alphabet
offsets. Difficulty ramps by family, coefficient magnitude and interleave depth.

*The hard part is ambiguity.* A generated sequence can legitimately admit two different "next"
terms, and a student marked wrong for a defensible answer is exactly the failure mode the owner
cares most about. Mitigation, and it mirrors the house style directly: a **verifier that runs a
battery of competing rule-fitters over each generated prefix and rejects any item where an
alternative rule of equal-or-lower complexity predicts a different next term.** This is the
sequences analogue of `problems.test.ts` numerically differentiating every stored antiderivative —
the bank grades itself, in CI, before a student ever sees it.

### C. Probability / EV multiple choice
Covers Citadel, DRW, SIG QE, Jane Street's probability round, IMC, Optiver Beat the Odds. Two clock
modes: whole-test (Citadel 15/30 min) and per-question (Optiver ~90 s), which the engine must both
support.

Content is **parameterised item templates**, not fixed questions: each template owns a closed-form
answer function of its parameters plus distractor functions encoding classic errors (dropped the
conditioning, multiplied dependent probabilities, off-by-one in a combinatorial count). Verification
is Monte Carlo — simulate each template at random parameter draws and check the closed form — which
is the same one-off, development-time numeric verification the integral bank already relies on, with
no runtime cost and no AI in the live path.

This is the largest content lift in the project.

### D. Data sufficiency, charts and tables
Covers the IMC QR screen, Optiver's Likelihood Test, and the Aon/cut-e-style numerical reasoning
several firms use. Synthetic tables and charts are generated (recharts is already a dependency) and
question templates run over the generated data — percent change, ratio, compound growth,
which-category-largest, rank-these-three-by-probability. Self-verifying by construction, since the
answer is computed from the data that was generated.

### E. Non-numeric logic and pattern
Covers SIG problem-solving, the 2026 IMC shape-pattern screen, Optiver's logic section.
Raven's-style matrix reasoning generated by composing rules over shape attributes (shape, count,
fill, rotation, size, position), plus a small authored logic-puzzle bank.

### F. Options and market intuition
Covers SIG's options basics and Akuna's options theory: payoff diagrams, put-call parity, directional
greeks. All computable in closed form from a small pure-function Black-Scholes module — verifiable,
offline, no service dependency.

### G. Market-making game
Covers the Optiver trading game, Jane Street's coin-settled contract game, SIG game theory. A
contract settles from a known distribution; the candidate quotes two-sided markets; a **seeded,
deterministic counterparty bot** hits or lifts when the quote is mispriced, with a noise term and an
optional information advantage. Information reveals arrive mid-game. Scoring is P&L against an
optimal-quoting benchmark, plus spread discipline and inventory control as separate reported
metrics.

Highest-signal module in the whole project, and the one no static bank can substitute for. Fully
deterministic and offline — a seeded bot policy, not a model.

### H. Estimation / Fermi
Interval answers scored by a proper interval rule (Estimathon-style: a ratio score on `hi/lo`, with
a penalty when the truth falls outside). **This archetype genuinely needs sourced data** — real
quantities with citable true values — so it is the one place the integrals sourcing discipline
applies rather than inverts.

### I. Cognitive and reaction mini-games
Covers Optiver Zap-N (9 games, ~60 min) and IMC's NeurOlympics (4 games, ~45 min). Built as generic
cognitive tasks, not vendor clones: choice-reaction, task-switching, BART balloon risk, n-back and
spatial working memory, anticipation/interception, go/no-go inhibition, trail-making, dual-task
divided attention, Mastermind-style deduction, digit span.

Report **per-game metrics** — reaction-time mean and SD, d-prime, lapse rate, risk policy
consistency — rather than one composite score. That is both what the real vendors do and the only
version that makes practice useful.

### J. Long-form quantitative written test
Covers G-Research (10 items, five options, 90 min), XTX, HRT, Jump. Authored MCQ bank with LaTeX
rendering (KaTeX already present), long per-question budgets, an explicit calculator-policy flag,
and the ML-variant split G-Research runs.

### K. Coding assessment
Covers the Optiver coding section, Akuna's second OA, HRT and Citadel SWE screens.
**Recommend deferring to a stretch phase, explicitly rather than silently:** executing untrusted
candidate code needs a sandboxed runner, which is a real backend cost and a real security surface,
and the market is already well served by HackerRank and LeetCode. If built, the cheap path is
browser-only — JS natively, Python via Pyodide — against fixed test cases, with zero server
execution.

### L. Personality and behavioural questionnaire
Covers Optiver's untimed personality section, IMC's long questionnaire, SIG's. Replicate the
*format* — forced-choice ipsative blocks, "most like me / least like me", no clock — and give a
debrief explaining what these instruments measure and that there is no answer key.
**Do not fabricate a personality score.**

---

## 3. The proctor shell — the part that makes it "exactly how you'd get them"

The modules are the content; the shell is the fidelity. A 60-question arithmetic test that lets you
pause, skip back and see your score climb is not the Flow Traders test.

- **Full-screen takeover.** No `AppShell` sidebar, no app chrome. `ResourceReader` already
  establishes this pattern in the router.
- **A pre-test instruction screen** carrying the real rules verbatim in tone: item count, clock,
  scoring, whether skipping is allowed, calculator policy, "you cannot pause once started".
- **One clock that does not stop.** `useDrillRun` already gets this right for the right reason —
  `setInterval` against a wall-clock deadline rather than `requestAnimationFrame`, so a backgrounded
  tab doesn't silently freeze the countdown. Carry that decision forward.
- **Tab-blur logged.** G-Research literally tracks browser tab switching; recording it (and showing
  it in the debrief) is part of the replication.
- **No back navigation and no skip where the real test forbids them.** Forced auto-advance on submit.
- **Per-question clocks** as a first-class mode, for Optiver's ~90 s probability items.
- **Section chaining.** A *battery* is an ordered list of modules with independent clocks, scoring
  rules and inter-section breaks. Optiver's full OA is five modules; the battery is the unit a
  candidate actually experiences, and the unit worth replicating.
- **No feedback during the run.** This is a genuine behavioural difference from the existing drills,
  where the correct/incorrect border flash is load-bearing. Real OAs tell you nothing. Results are
  withheld until the whole battery ends.
- **Then a full debrief** — per-item review with worked explanations, timing distribution, score
  against that firm's known competitive bar (~72/120 Flow Traders, ~70 Akuna, ~70–80 % Jane Street),
  and a weak-tag breakdown.

---

## 4. Architecture

```
src/features/assessments/
  types.ts                 AssessmentItem, ModuleSpec, BatterySpec, FirmSpec, RunResult
  engine/
    useAssessmentRun.ts    battery/section state machine, clocks, no-feedback scoring
    rng.ts                 seeded RNG (reuse the integrals seeded-shuffle approach)
    scoring.ts             +1/−1, per-section rollup, pass-bar comparison
    persistence.ts         Supabase writes, mirroring drills/engine/persistence.ts
  modules/
    arithmetic/            generator + profiles + distractor functions
    sequences/             rule families + the ambiguity verifier
    probability/           parameterised item templates + Monte-Carlo verification
    dataSufficiency/
    patternLogic/
    options/
    marketMaking/
    cognitive/
    estimation/
  firms/
    optiver.ts  janeStreet.ts  flowTraders.ts  akuna.ts  sig.ts
    citadel.ts  drw.ts  imc.ts  gResearch.ts  ...
    registry.ts
  components/
    ProctorShell.tsx  InstructionScreen.tsx  ItemRenderer.tsx
    ChoiceInput.tsx   FreeNumericInput.tsx   SectionBreak.tsx  Debrief.tsx
  *.test.ts              generator self-grading, mirroring problems.test.ts
```

Routes: `/assessments` (firm catalog), `/assessments/:firmId` (battery overview and rules),
`/assessments/:firmId/:moduleId` (single-module practice), `/assessments/:firmId/run` (full
battery), plus the `import.meta.env.DEV` unguarded twins the integrals routes already use for
screenshotting behind `DashboardGuard`.

### What already exists and carries over

| Asset | Verdict |
|---|---|
| `drills/games/zetamac.ts` | Generator shape is right; extend to config-driven profiles (currently fixed operators, integers only) |
| `drills/engine/useDrillRun.ts` | Clock handling and weak-spot biasing carry over. **Do not bend it** — its immediate correct/incorrect flash is correct for drills and wrong for OAs. New `useAssessmentRun` |
| `drills/types.ts` `DrillProblem` | `AssessmentItem` extends it with `choices`, `perQuestionMs`, `explanation` |
| `drills/components/NumericAnswerInput.tsx` | Reusable, but its guard is `/^-?\d*$/` — **integers only**. Decimals and fractions need a variant |
| `drills/engine/persistence.ts` | Direct template for the new tables (RLS, `REVOKE ... FROM anon`, live aggregation view) |
| `drill_weak_spots` view | `problem_tag` semantics transfer unchanged — weak-spot targeting works on day one |
| `MathRenderer`, KaTeX, recharts, framer-motion, `glass-card` | All present, no new dependencies |
| `MathSymbolPalette`, `RichMathField` | Relevant to the long-form quant module, and to the owner's structured-answer-input directive |

**No new npm dependencies are required** for phases 0–4. Pyodide would be the only addition, and
only if the coding module is ever built.

### Data model

New migration; **do not overload `drill_sessions`/`drill_attempts`.** A battery has multiple
sections with different scoring rules, and the debrief needs the actual item and the given answer,
which `drill_attempts` deliberately does not store (it holds only `problem_tag`, `correct`,
`latency_ms`).

- `oa_runs` — one row per battery attempt: `user_id`, `firm_id`, `battery_id`, `spec_version`,
  `started_at`, `finished_at`, `abandoned`, `tab_blur_count`.
- `oa_section_results` — one per section: `run_id`, `module_id`, `raw_score`, `items_seen`,
  `items_correct`, `items_wrong`, `duration_s`, `percentile_vs_bar`.
- `oa_items` — one per question answered: `section_id`, `user_id`, `problem_tag`, `prompt`,
  `given`, `expected`, `correct`, `latency_ms`.

RLS, grants and the anon revoke mirror `20260818120000_drill_engine.sql` exactly. `spec_version` on
the run is what keeps a 2026 result comparable when a firm changes its format in 2027.

---

## 5. Phasing

| Phase | Ships | Rough effort |
|---|---|---|
| **P0** | Proctor shell + assessment engine + Optiver 80-in-8 end to end + migration. Proves the whole spine on one module. | 2–3 days |
| **P1** | Arithmetic profiles → all six speed batteries (Optiver, Akuna, Jane Street, Flow Traders, All Options, IMC), including the MCQ variant and distractor functions. | 2 days |
| **P2** | Sequences engine + ambiguity verifier → Optiver NumberLogic, Akuna, Flow Traders. | 3–4 days (the verifier is most of it) |
| **P3** | Probability / EV template bank + Monte-Carlo verification → Citadel, DRW, SIG QE, Jane Street probability round, IMC. | 1–2 weeks, content-bound |
| **P4** | Battery chaining, firm catalog pages, pass-bar benchmarking, debrief analytics. This is the point it stops being drills and becomes "the Optiver OA". | 3 days |
| **P5** | Market-making game. | 4–5 days |
| **P6** | Cognitive game suite, data-sufficiency/charts, options MCQ, G-Research long-form, personality format. | 1–2 weeks |
| **Stretch** | Coding module (Pyodide, browser-only); estimation/Fermi (needs a sourced fact bank). | — |

P0–P2 are the minimum that delivers something a candidate would recognise as the real screen.
P0–P4 covers every firm whose OA is a timed math/probability screen, which is most of them.

---

## 6. Decisions that need the owner

1. ~~**Where does this live?**~~ **DECIDED (2026-09-02, project owner):** inside Cortexed, at
   `/assessments`, as a **standalone section built without regard to or integration with the rest
   of the app** — its own shell rather than `AppShell`, no sidebar entry, no XP, no concepts, no
   shared drill tables, `ProtectedRoute` rather than `DashboardGuard`. See
   `src/features/assessments/README.md` for the full list of what that rules out, and treat it as a
   standing constraint rather than a stage to grow out of.
2. **Firm naming.** Real names used descriptively ("Optiver-style"), which is the whole value
   proposition and the industry norm, versus generic labels. Recommendation: real names, no logos or
   brand colours, explicit non-affiliation disclaimer.
3. **Formally lift the `CLAUDE.md` integrals-only scope lock** and record that the sourcing rule is
   integrals-scoped and inverts here.
4. **How far into the cognitive games (P6) to go.** They are the most build-heavy archetype and the
   least transferable to genuine skill — they measure reaction time, and practice mostly buys
   familiarity with the interface.
5. **Coding module: build or link out?** Recommendation above is link out, at least initially.

---

## 7. Explicitly not dropped

Per the standing "nothing gets waved off" directive, the items deferred rather than delivered, with
reasons: the **coding module** (sandboxed execution cost and security surface — deferred to stretch,
with a browser-only Pyodide path costed); **estimation/Fermi** (needs a sourced fact bank, which is
data collection rather than engineering); **personality scoring** (deliberately not scored — there
is no defensible key, so the format is replicated and the debrief explains why no score is shown);
**Five Rings** (format not publicly reported in enough detail to replicate — it is in the catalog
as a stub pending a candidate report).

---

## Progress log

- **2026-09-02** — P0 through P3 plus P5 shipped on `claude/quant-firm-assessments-353dbg`.
  **Ten firms, fifteen modules playable** at `/assessments`: the six speed batteries (Optiver,
  Jane Street, Flow Traders — multiple choice, Akuna, All Options, IMC), three sequences papers
  (Optiver NumberLogic, Flow Traders, Akuna), four probability screens (Citadel, DRW, SIG,
  G-Research) and the market-making game (Jane Street, Optiver). 1223 tests passing, lint and
  build clean.

  Built as four parallel worktree agents against a hand-built P0 spine. What that cost, recorded
  because it should inform the next batch: agents died on session rate limits three times, losing
  two full runs; the sequences module was recovered from an agent's uncommitted worktree rather
  than re-run. Every merge needed review — the merges surfaced six real bugs no agent could have
  caught from inside its own worktree (choice ids recorded instead of labels; `abandon()`
  discarding the live section; option formatting leaking the answer; "exactly 1 heads"; three
  firms promising back-navigation the engine refused; `custom` modules not rendering at all).

  **Not built:** the cognitive/reaction game suites (P6, archetype I), data-sufficiency and chart
  reading (D), options and market intuition (F), the G-Research long-form written variant (J),
  the coding module (K — still recommended as link-out), estimation/Fermi (H — needs a sourced
  fact bank), and the personality format (L). SIG's options and game-theory content was
  deliberately left out of its probability screen because it could not be verified to the same
  standard as the rest; it is noted in `firms/sig.ts`'s `sourceNote` rather than silently dropped.

  **Next:** archetypes D and F are the cheapest remaining wins (both self-verifying by
  construction), then the P6 cognitive suite, which is the largest single block left.
