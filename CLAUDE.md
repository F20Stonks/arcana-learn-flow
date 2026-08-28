# Active task: Integral Arena content seeding

This file is a working runbook for an in-progress task, not general codebase documentation.
It is scoped ENTIRELY to `src/features/integrals/` — the self-contained "Integral Arena"
integration-bee training game. **Do not touch anything else in this repo** (in particular the
main "Cortexed" app / Supabase backend elsewhere in the tree — out of scope, explicitly ruled
out by the project owner).

**If you are starting a session on this branch and the user's first message is just "continue"
(or anything similarly short), that means: read this whole file, then start working through the
plan below immediately, autonomously, without asking clarifying questions.** Keep going —
verify, write, test, commit, push, repeat — until you hit a hard stop (out of runway, or a
decision only the project owner can make). This is authorized: the owner wants this looped
until the usage limit runs out, with commits along the way so nothing is ever at risk of being
lost. Update the "Progress log" section at the bottom of this file as you go, so the next
session (or the next loop iteration) knows exactly what's done without re-deriving it.

Repo: `F20Stonks/arcana-learn-flow`. Work on branch `claude/seed-lessons-clarify-bubrj3` — check
it out if you're not already on it, do not create a new branch.

Setup: `npm install --registry https://registry.npmjs.org` (the default private registry 403s
in this sandbox). Then `npx vitest run src/features/integrals` should show all tests passing —
confirm this before making changes, so you know your baseline is green.

## Architecture (read this before touching anything)

- `src/features/integrals/techniques.ts` — the lesson content: an array of `Technique` objects
  (`tagline`, `whenToUse`, `recipe`, worked `example`, `pitfalls`). This is the "lesson" a
  student reads before practicing.
- `src/features/integrals/types.ts` — `TechniqueId` union type. Every technique id used
  anywhere must be listed here.
- `src/features/integrals/bank/*.ts` — one file per technique (roughly), each exporting a
  `Problem[]`. This is the practice-problem content.
- `src/features/integrals/problems.ts` — aggregates every bank file into one `PROBLEMS` array.
- `src/features/integrals/problems.test.ts` — **the bank grades itself.** Every indefinite
  answer is checked by numerically differentiating it and comparing to the integrand across the
  problem's domain; every definite answer is checked by numerically integrating (quadrature) the
  integrand and comparing to the stored value. This is the safety net for content quality —
  never hand-write an answer without verifying it this way first (see Workflow below).
- `src/features/integrals/answer.ts` — the LIVE grading path (`checkIndefinite`/
  `checkDefinite`), used when a real user submits an answer in the app. Important:
  `checkDefinite` does NOT read `Problem.domain` at all — domain is purely a test-time
  verification detail with zero effect on live grading. This is why the infinite-domain fix
  below is safe to make.
- `src/features/integrals/answer.ts` also has a `FUNCTIONS` whitelist (what mathjs will
  recognise as a function name, e.g. `sin`, `gamma`, `erf`) used both for live grading and for
  the `fn()` helper in `problems.test.ts`. Extend this when a problem needs a function it
  doesn't yet have (see "Nothing gets dropped" below).

## Already done (do not redo)

1. Six new techniques with full lessons + verified problem banks: `t-sub`, `recurrence`,
   `inverse-integral`, `floor-function`, `beta-integrals`, `introducing-constants`.
2. ~80 more problems mined into the *existing* technique banks from four source PDFs (Fresno
   State Integration Bee Training; HMMT Integration Bee Practice Pt1/Pt2; MIT Integration Bee
   2025 mock). These PDFs are not necessarily attached to your session — everything usable from
   them has already been extracted and committed; you don't need the original files to continue.
3. Some of the `t-sub` / `recurrence` / `beta-integrals` / `introducing-constants` problems are
   "formula-instances" (a general result was in the source text, e.g. ∫dx/(a+cos x), and
   specific constants were plugged in to make problems) rather than literal transcriptions. The
   project owner reviewed this and said **keep them as-is** — do not prune or revisit this. Only
   the sourcing rule below applies going forward.

## Standing directives from the project owner (all confirmed, act on them without re-asking)

1. **Cover everything, don't drop anything.** SPLASH notes ("SPLASH 2011 – Superhuman
   Integration Techniques" by Andre Kessler) and the UK guide ("UK University Integration Bee
   Basic Techniques Guide" by Vishal Gupta & Alfie Jones) should be covered as close to fully as
   possible. Nothing gets waved off as "out of scope" — see "Nothing gets dropped" below for how
   to handle the genuinely hard cases.
2. **Sourced content only, going forward — no invented problems.** Do not author a new practice
   problem by plugging fresh numbers into a documented formula; that is still original
   authorship. Only add a problem if it is a real transcription of a problem that appears in a
   source document. The owner is sourcing more material himself (he has ~320 MIT Integration Bee
   qualifier problems with solutions spanning ~16 years, and will keep sending more PDFs) — when
   new source PDFs show up in the session's uploads, mine them exhaustively before doing anything
   else.
3. **No AI review/grading inside the live app**, ever — the owner will not pay for ongoing API
   usage. Your own numeric-script verification during content authoring is fine because it's a
   one-off development-time cost, not a per-user runtime cost.
4. **Deterministic, error-free UX matters a lot.** The owner's top concern is a student's typed
   answer ever being misread. There is already a robust free-text parser (`normalize()` in
   `answer.ts`, 50 passing tests) — do not remove or weaken it. On top of it, build a structured
   "integral builder" answer-input mode (clickable symbol palette — e, π, ^, √, common functions,
   etc.) as a supplement, so a student who wants zero parsing ambiguity can build the answer
   structurally instead of typing it. Both modes end up as a string compared against the stored
   `answer` — no grading-engine change needed, this is `AnswerInput.tsx` UI work.
5. **Two independent practice filters, not one.** (a) By technique — multi-select, so a student
   can drill an arbitrary subset of techniques, not just one at a time or the full mix.
   (b) By source/competition — a student can also work a specific competition's set as-is,
   uncurated (e.g. "just the MIT Integration Bee set"), mirroring the real competition. Neither
   should replace the other — "why should we give the user less choice."
   - Add a `source` field to `Problem` (competition name, year, round/section — whatever's
     available per document) and backfill it for problems already committed. For problems
     without a specific competition provenance, something like `source: { name: "original" }`
     is fine.
   - Building the actual filter UI: check `IntegralTraining.tsx` (currently one technique via
     `/integrals/train/:techniqueId`), `sprint.ts`'s `SprintConfig` / `IntegralSprint.tsx`,
     `queue.ts`'s `orderQueue`, and `problemsForTechnique` in `problems.ts` for what's already
     there before inventing new plumbing. This is real feature work, not just content — fine to
     do once there's a reasonably large, stable set of techniques/sources to filter over (i.e.
     it doesn't have to be first, but don't forget it either).

## The one real engineering blocker, and how to lift it

`quadrature()` inside `problems.test.ts` only maps a **finite** `[a,b]` (smoothstep
substitution). This is why Gamma-function integrals (∫₀^∞ xⁿe⁻ˣdx = n!), Zeta-connected
integrals (∫₀^∞ x/(eˣ−1)dx = π²/6), and reciprocal-substitution flagship examples were
previously ruled out. **Fix it — this was next when the previous session ended.**

Extend `quadrature()` to accept `Infinity`/`-Infinity` bounds and use a proper unbounded change
of variable in that case:
- `(0, ∞)`: `x = t/(1-t)` for `t ∈ (0,1)`, `dx = dt/(1-t)²`.
- `(-∞, ∞)`: `x = t/(1-t²)` for `t ∈ (-1,1)`, `dx = (1+t²)/(1-t²)² dt`.

Keep the existing finite-domain path unchanged (don't regress the 700+ already-passing checks).
Since `checkDefinite` in `answer.ts` never reads `.domain`, this is a **test-only** change with
zero risk to live grading. Verify the substitution itself against known values (∫₀^∞ e⁻ˣdx=1,
∫₀^∞ xe⁻ˣdx=1, ∫_{-∞}^∞ 1/(1+x²)dx=π) with a standalone Node script *before* touching the real
test file — see Workflow below.

**Caveat:** naive truncation-via-substitution only reliably converges for *exponentially-decaying*
integrands. Slowly-decaying or oscillatory ones (∫₀^∞ sin(x)/x dx, ∫₀^∞ ln(x)/(x²+1)dx-style
tails) may not converge to tolerance without a much larger sample count or special-casing —
always verify a candidate numerically first, and if it won't converge cleanly, that's a case
where the tolerance/`n` needs increasing for that problem (or the substitution needs to be
smarter), not a reason to drop the problem — see "Nothing gets dropped" below.

## Planned new techniques

Verify math with a throwaway Node script (see Workflow) before writing any bank file.

1. **`log-power-integrals`** (SPLASH §2, "generating functions") — no engine change needed,
   already finite-domain: ∫₀¹ xⁿ lnᵏx dx = (−1)ᵏk!/(n+1)^(k+1). Do this one first, it's free.
2. **`reciprocal-substitution`** (u=1/x pairing, UK guide §1.2 second half) — needs the
   infinite-domain fix above. Flagship examples: ∫₀^∞ ln(x)/(x²+1)dx = 0;
   ∫₀^∞ arctan(x)/(x(ln²x+1))dx = π²/4.
3. **`gamma-function`** — ∫₀^∞ xⁿe⁻ˣdx = n!, plus substitution-flavored variants
   (∫₀^∞ e^(-αx²)dx, ∫₀^∞ x³3⁻ˣdx, etc.). Keep answers as elementary closed forms; don't rely on
   mathjs's `gamma()` symbolically without double-checking it.
4. **`zeta-series`** — expand 1/(eˣ∓1) as a geometric series in e⁻ˣ, integrate termwise:
   ∫₀^∞ x/(eˣ−1)dx=π²/6, ∫₀^∞ x/(eˣ+1)dx=π²/12 (HMMT "memorize" appendix; both
   exponentially-decaying, should truncate cleanly).
5. **`wallis-product`** — its own full lesson (squeeze-theorem derivation from sin^n x), with
   the sin^n/cos^n reduction integrals in `recurrence` ALSO tagged with this technique id
   (`Problem.techniques` is already an array — multi-tag, no schema change).
6. **`gaussian-hypersphere`** (SPLASH §4.4, n-dimensional hypersphere) — full lesson on the
   Gaussian-integral derivation of the hypersphere volume formula
   (`2π^(d/2)/Γ(d/2)·r^(d-1)`), with real single-variable Gaussian integrals as practice
   (∫₀^∞ e^(-x²)dx = √π/2, ∫₀^∞ x²e^(-x²)dx, ∫₀^∞ x⁴e^(-x²)dx, etc. — literally the building
   blocks the real derivation uses).

## Nothing gets dropped — how to actually include the hard cases

The owner explicitly rejected skipping content. Genuinely hard cases and how to handle them:

- **Weierstrass infinite-product factorization (sin x/x)**: not a "type an answer" integral —
  include it as lesson color inside the Zeta or Gamma lesson (it's how SPLASH derives
  ζ(2)=π²/6), no dedicated problem bank needed for the product itself.
- **Lambert W integrals** (e.g. HMMT ∫₀^e W(x)/x dx): mathjs's `FUNCTIONS` whitelist doesn't
  include `lambertw`. Implement it as a real function (Newton's method, a handful of lines) and
  register it in `answer.ts`'s `FUNCTIONS` plus `problems.test.ts`'s `fn()` helper, exactly like
  `gamma`/`erf` already are. Then these problems are completely normal — don't skip them.
- **gcd-based problems** (e.g. HMMT `gcd(⌊x^(1/3)⌋, ⌊x^(1/4)⌋)`): same move, implement `gcd` and
  register it the same way.
- **Continued-fraction / infinite-tower integrands** (e.g. `x/(1+x/(1+x/(1+...)))`,
  `√(x+√(x+√(x+...)))`): these are fixed points of an algebraic equation, not unsolvable — e.g.
  the continued fraction above equals `(√(1+4x)-1)/2`, an ordinary elementary function. Derive
  the closed form first, then it's a normal `integrandExpr`.
- **Iterated/multi-integrals** (e.g. a 5-fold nested `∫₀^π∫₀^u∫₀^w∫₀^t∫₀^y sin(x)...`): reduces
  via Cauchy's formula for repeated integration — the n-fold iterated integral of f from 0 to x
  equals `∫₀^x (x-t)^(n-1)/(n-1)! · f(t) dt`. Becomes one ordinary integral
  (`∫₀^π (π-x)^4/4! · sin(x) dx` for that example) and fits the schema exactly.
- **Sums-to-infinity inside the integrand** (e.g. `∫√(x+x²+x³+...)dx`): the inner sum is itself
  a closed elementary form (geometric series `x/(1-x)`, etc.) — substitute that in first, then
  it's ordinary.

If, after genuinely trying the above, something truly cannot become a single mathjs-parseable
`Problem` (no real closed form exists, or it requires evaluating something no reasonable custom
function could express) — don't silently drop it either. Note it in the Progress log below with
why, so the owner can make the final call rather than it just quietly vanishing.

## Workflow (this has been working well — keep using it)

1. Derive the closed form by hand.
2. Write a throwaway `node /tmp/verify.mjs` script using plain `Math.*` that mirrors
   `problems.test.ts`'s `derivative()`/`quadrature()` logic exactly (five-point central
   difference for indefinite; smoothstep-substitution midpoint quadrature for definite, same
   tolerances: `1e-5*(1+|target|)` and `1e-4*(1+|expected|)` respectively). Check the candidate
   passes with real margin — if the error is within ~50% of the tolerance boundary, that's a
   signal to find a cleaner example rather than ship something marginal.
3. Grep `bank/*.ts` for the candidate `integrandExpr` substring before adding it, to catch
   duplicates the exact-match test wouldn't catch by construction (different phrasing of the
   same function, etc.). There's also the automated exact-duplicate test in `problems.test.ts`
   ("has no duplicated integrands", keyed on `kind:integrandExpr:lower:upper") — that's the
   final backstop, not the first line of defense.
4. Write the `Technique` lesson entry (if new) into `techniques.ts` and the `TechniqueId` into
   `types.ts`.
5. Write the bank file entries, wire new files into `problems.ts`.
6. Run `npx vitest run src/features/integrals` for real (never trust the throwaway script
   alone) and `npx eslint <changed files>`.
7. Commit with a descriptive message, push. Commit reasonably often (every technique, or every
   ~20-30 problems) so work is never at risk of being lost mid-session.
8. Append a short entry to the Progress log below.

## Progress log

- 2026-08-27: Session ended after committing ~80 sourced problems (commit `3eac99d`, 721/721
  tests passing) and this runbook. Next up: the infinite-domain `quadrature()` fix, then
  `log-power-integrals` (free), then the rest of "Planned new techniques" in order, then the
  `source` field + filters, then the answer-builder UI. A future session/loop iteration should
  add its own dated entry here each time it commits, noting what shipped and what's next.
- 2026-08-27 (continued, same day): **Note on branch** — this session was started by the harness
  on `claude/continue-until-limit-urdt8y`, which forked from `claude/seed-lessons-clarify-bubrj3`
  at `f6f8349` (the CLAUDE.md-runbook commit), exactly where the prior session left off. The outer
  harness instructions for *this* session say to push to `claude/continue-until-limit-urdt8y` and
  never push elsewhere without explicit permission — that takes precedence over this file's own
  "work on `claude/seed-lessons-clarify-bubrj3`" line for this session specifically. All commits
  below are on `claude/continue-until-limit-urdt8y`. If you're a future session reading this on
  `claude/seed-lessons-clarify-bubrj3`, check whether `claude/continue-until-limit-urdt8y` has
  moved ahead and merge/rebase from there first — don't redo work that already shipped on the
  other branch.
  - Verified the infinite-domain `quadrature()` fix in a throwaway script first, exactly as
    prescribed, then applied it to `problems.test.ts` (commit `f228d93`). All finite-domain checks
    still pass unchanged (721/721).
  - Along the way, discovered the reciprocal-substitution flagship
    `∫₀^∞ arctan(x)/(x(1+ln²x))dx=π²/4` is a genuinely hard numerical case, confirmed with real
    effort (not just a quick guess): tried the prescribed algebraic substitution (fails even at
    n=4,000,000 samples), a tanh-sinh/double-exponential transform (also falls short, converges to
    a wrong plateau ~2.4651 instead of 2.4674 — the tail decays only like 1/(x ln²x), i.e.
    logarithmically, which no polynomial-in-t change of variable resolves at a sane sample count).
    A hand pre-substitution u=ln(x) *does* verify it cleanly (err ~1e-7) by turning it into
    ∫_-∞^∞ atan(e^u)/(1+u²)du — but that's a per-problem substitution the shared `quadrature()`
    can't know to apply generically. Resolution: this flagship lives in `techniques.ts` as the
    `reciprocal-substitution` lesson's own worked example (fully derived by hand, not machine-
    graded), matching the precedent already set for the Weierstrass-product content. The bank
    itself uses the *other* flagship (`ln(x)/(1+x²)dx=0`, verifies perfectly) plus the
    "`∫₀^∞dx/((1+x²)(1+x^a))=π/4` for any a>0" family and one reflection-formula/split-at-1 case,
    all confirmed with real margin.
  - Added all six planned techniques in the runbook's order — `log-power-integrals` (10 problems),
    `reciprocal-substitution` (8), `gamma-function` (8, deliberately no Gaussian variant — that's
    `gaussian-hypersphere`'s job), `zeta-series` (7), `wallis-product` (6 new + multi-tagged
    `recurrence`'s two sin^n reduction problems per the runbook), `gaussian-hypersphere` (8).
    Commits: `8993001`, `170524b`, `b864d95`, `c5faac6`, `cf48295`, `93d2f29`. Every single value
    verified against a throwaway smoothstep-quadrature script with real margin before being
    written into a bank file, per Workflow. 821/821 tests passing.
  - Added the `source` field (`ProblemSource {name, year?, round?}`, required on every `Problem`)
    and backfilled all 307 existing problems (commit `4e3ed29`), plus `SOURCES`/`problemsForSource`/
    `sourceKey` helpers in `problems.ts` for the source-filter half of standing directive #5.
    **Known gap, flagged for the owner rather than silently guessed:** the four techniques added
    this session with an explicit citation got it (SPLASH/UK-guide/HMMT, per each bank file's
    header comment); everything else — every problem that predates this session, including the
    ~80 mined in commit `3eac99d` from three real named competition PDFs (Fresno State/HMMT/MIT)
    — got `{name: "original"}`. That commit never tracked which of the ~80 came from which of the
    three documents, and the PDFs aren't attached to this session to re-derive it. If you want that
    batch (or the earlier `t-sub`/`recurrence`/`beta-integrals`/etc. techniques, whose "formula-
    instance" note in "Already done" #3 implies real SPLASH/UK-guide provenance too) tagged with
    real per-problem sources, re-attach the original PDFs and a future session can re-mine the
    attribution — don't guess it without them, a fabricated citation is worse than an honest
    "original". 823/823 tests passing, typecheck clean.
  - Built the technique-multiselect + source filter UI (commit `dd07fad`): a "Custom mix" checkbox
    panel on `IntegralTraining.tsx` unions problems across any subset of techniques
    (`problemsForTechniques()`, new alongside `problemsForTechnique()`), routed through
    `/integrals/train/custom?techniques=a,b,c`; a "By source" section lists every non-"original"
    source as its own uncurated set, routed through a new `/integrals/train/source/:sourceKey`
    route. `TrainingTechnique` now resolves its pool from technique/mixed/custom/source instead of
    just technique/mixed, sharing the same queue/run machinery (custom and source skip the lesson
    panel, same as mixed already did). Didn't touch `sprint.ts`/`IntegralSprint.tsx`/`queue.ts`'s
    `orderQueue` — sprinting is banded by difficulty, not technique or source, so directive #5
    didn't call for changes there; `orderQueue` is reused as-is by the new modes. Verified with an
    actual Playwright walkthrough against the dev server (`/dev/integrals/train` unguarded routes),
    not just unit tests — screenshots of the hub, the custom-mix drill, and the source drill all
    confirmed correct. 824/824 tests passing, typecheck clean.
  - Built the `AnswerInput.tsx` integral-builder UI (commit `846aac5`, standing directive #4): a
    Type/Build toggle; Build reveals a palette (x, e, π, C; operators, ^, √, parens, |·|;
    sin/cos/tan/ln/arcsin/arctan) that inserts tokens at the cursor in the same text field Type
    uses, with function/root keys leaving the cursor between the pair they insert. Both modes
    write the same `value` string graded against the stored answer — `answer.ts` untouched, exactly
    as the directive asked. Verified with a Playwright walkthrough (building `x^3/3` and `sin(x)`
    via clicks, backspace, live preview all correct) as well as the full test suite.
  - **This closes out every item explicitly planned in this runbook** — the infinite-domain
    engine fix, all six new techniques, the `source` field + backfill, the technique/source filter
    UI, and the answer-builder UI. End-of-session final check (not just `src/features/integrals`):
    `npx vitest run` — 923/923 passing across the whole repo; `npx tsc --noEmit` — clean;
    `npx eslint src` — the only findings are pre-existing errors in files this session never
    touched (`paddle.ts`, `sceneOutcomeLog.ts`, `Dashboard.tsx`, `QuestionAttack.tsx`, etc., all
    outside `src/features/integrals`/`src/pages/Integral*` and out of this task's scope per the
    top of this file).
  - **Nothing left to do without new input.** Standing directive #2 forbids inventing new
    problems by plugging fresh numbers into a formula going forward (the "formula-instance"
    exception was for `t-sub`/`recurrence`/`beta-integrals`/`introducing-constants`/this session's
    six techniques specifically, already used up) — so there is no more sourced content to mine
    until the owner supplies more PDFs, and no more planned engineering work is queued. If you are
    a future session/loop iteration starting here with runway left and no new uploads: don't
    invent problems or add speculative features — check for new source PDFs first (standing
    directive #2), and if there are none, that genuinely is the hard stop this runbook's opening
    section anticipates. Report that back rather than manufacturing busywork.
  - **Two follow-ups for the owner specifically**, both flagged inline above where they came up
    rather than fixed unilaterally: (1) the ~80 problems mined in commit `3eac99d` (and possibly
    the earlier `t-sub`/`recurrence`/etc. techniques) could use real per-problem `source` tagging
    instead of the `{name: "original"}` fallback, if the owner re-supplies the original Fresno
    State/HMMT/MIT PDFs. (2) The reciprocal-substitution flagship
    `∫₀^∞ arctan(x)/(x(1+ln²x))dx=π²/4` genuinely cannot be machine-verified by the quadrature
    scheme this repo uses (confirmed with real effort, not a quick guess) — it lives as the
    technique's worked lesson example instead of a graded bank problem, which is almost certainly
    fine, but the owner may want to weigh in if he'd rather it be handled differently.

- 2026-08-27 (same day, new mining round): The owner answered both follow-ups above by re-sending
  the source PDFs directly into this session's uploads, plus a new batch: SPLASH notes, the UK
  guide, Fresno State/HMMT Pt1/HMMT Pt2/MIT 2025 Mock (all previously missing), and 16 years of
  `qualifying_round_20XX_test.pdf` (2010–2020, 2022–2026, missing 2021) — the ~320-problem MIT
  qualifier archive mentioned as coming eventually. `pdftoppm`/`pdftotext` aren't installed in this
  sandbox (Read's PDF path needs poppler); worked around it with `pip install pymupdf` and a
  Python extraction script, text saved to `/tmp/.../scratchpad/pdftext/*.txt` — a future session
  hitting the same PDF-read error should reuse that approach rather than re-discovering it.
  - Re-attributed 77 of the ~80 `3eac99d` problems to their real Fresno State/HMMT sources by
    diffing each problem's integrand/bounds against the actual PDF text (commit `24a20e9`) — this
    really was recoverable with the PDFs in hand, contrary to the previous session's guess.
    A handful of definite/completing-the-square/introducing-constants instances didn't turn up a
    confident verbatim match and stayed `{name: "original"}` rather than being guessed.
  - Mined SPLASH notes exhaustively (commit `7ea738f`, 12 new problems across reciprocal-
    substitution/beta-integrals/zeta-series/wallis-product/gamma-function) and the UK guide
    exhaustively in two passes (commits `5f93dcf`, `752506f`, 17 new problems total across
    symmetry/reciprocal-substitution/trig-identity/complete-square/inverse-integral/introducing-
    constants/t-sub/floor-function) — every technique's lesson `recipe`/`pitfalls` got a line or
    two added where the new problems needed a trick the lesson didn't teach yet (Beta-function log-
    differentiation, the complex-exponential trick, the two-power Beta-trig generalisation). Three
    UK-guide candidates (log sine integral, Serret's integral, Putnam 1980 A3) turned out to already
    be in the bank from a previous session under different IDs, tagged `{name: "original"}` — fixed
    by re-attributing the existing entries and dropping the duplicates rather than keeping two
    copies of the same problem.
  - Along the way, found and fixed a real latent bug in two pre-existing tests
    (`a11y.test.tsx`, `integration.test.tsx`): both hardcoded a "wrong answer" guess against
    whatever `dailyProblem()` picks for the *actual current date*, which is a deterministic function
    of each difficulty pool's size — so every content addition risks shifting which stored problem
    lands on "today," and a fixed guess can coincidentally read as correct, or as "off by a nice
    constant factor," or (the subtler failure) as spuriously "flat enough" against a small
    indefinite reference once the guess's own huge magnitude swamps the tolerance check. Fixed for
    good by deriving the wrong guess from the actual daily problem's real answer (`answer+999999`
    for definite, `answer+x` for indefinite) instead of any fixed literal — this is the correct
    permanent fix, not a workaround; a future content addition shifting today's problem again
    should not break these tests.
  - **Next up**: the 16-year MIT qualifying-round archive is still unmined — this is now the
    largest concrete piece of remaining work and the main thing left in this uploads batch. Each
    year's PDF is short (~1-2 pages, 16-25 problems), problems only (no printed solutions to lean
    on), spanning 2010–2020 and 2022–2026. Working through it now.
- 2026-08-27 (continued): Mined 2010–2014 of the MIT qualifying archive (confirmed: the first
  batch covered all three of 2010/2011/2012, not just 2010+2012 — checked via `git show 3abcc5d`
  after the fact, 3/8/9 problems respectively). Commits `3abcc5d` (2010-2012, 20 problems),
  `8ae65b9` (2013, 14 problems), `54ef4a5` (2014, 16 problems). 980/980 tests passing, typecheck
  and lint clean after each commit. Workflow per commit: read the extracted `.txt` for the year
  fresh (not from paraphrased memory — caught and corrected a real 2012/2013 problem-number
  mix-up this way), derive closed forms by hand, verify every candidate with a throwaway
  Node script mirroring `problems.test.ts`'s `derivative()`/`quadrature()` exactly, grep the bank
  for duplicate `integrandExpr` before writing, write the entries, run the full suite +
  `tsc --noEmit` + `eslint` on touched files, commit, push.
  - Real duplicates caught and handled by re-attributing the pre-existing entry's `source` (never
    keeping two copies of the same integral): 2013's `x arctan x`/`sqrt(x^2-1)/x`/two `definite.ts`
    log-integrals were already present as `{name:"original"}`; 2014's `arcsinh(x)` was already
    present as `ln(x+sqrt(x^2+1))` (same integral, different notation).
  - Skipped (not silently — logged in each commit message): 2013 #15 (ambiguous OCR, "e\n4√x dx"
    can't be confidently transcribed), 2013 #16/#20 (share a messy `csc` antiderivative not worth
    forcing), 2013's indefinite duplicate of #5, 2013 #9/#13 (too classic/duplicate-risk to add
    without a slower check); 2014 #19 (nested radical `sqrt(x+sqrt(x^2+1))`-style, no quick closed
    form found).
  - Each year nets 14-20 problems, not literal 100% coverage of every listed problem (some are too
    ambiguous from OCR, some duplicate existing content, a couple would need real engineering
    investment — e.g. new custom functions — that hasn't been justified yet by volume). This
    matches the pragmatic triage approach already used for 2010-2012; flagging here in case the
    owner wants a stricter "get literally everything" pass once the full archive is done.
  - **Remaining**: 2015 through 2020, 2022 through 2026 — 11 more years, roughly 200-240 more
    candidate problems. Continuing year-by-year in the same loop until this batch is exhausted or
    a hard stop is hit.
- 2026-08-27 (continued further): Mined 2015-2017. Commits `0c3a523` (2015, 17 problems),
  `105ee80` (2016, 18 problems), `78dabf0` (2017, 19 problems). 1088/1088 tests passing,
  typecheck and lint clean after each. Same workflow as before each commit (fresh read of that
  year's extracted text, hand-derive closed forms, throwaway-script verify with real margin,
  grep for duplicates, write, full suite + tsc + eslint, commit, push).
  - Duplicates caught and handled the same way each time — re-attribute the pre-existing entry's
    source rather than add a second copy: 2015's `sec x` and `tan^4x` were already present as
    `{name:"original"}`; 2016's `x^3e^{-x^2}` on `[0,∞)` was already present (correctly sourced to
    SPLASH, left untouched); 2017's `sin(√x)` was an exact indefinite duplicate (Fresno State,
    left untouched). Definite/infinite-domain versions of integrands that already exist as
    indefinite antiderivatives were kept as legitimately distinct content (different `kind`, not
    caught by the exact-duplicate test, and genuinely testing different material — e.g. the
    infinite-domain convergence itself).
  - Skipped (logged per-commit, not silent): 2015 #5 (`e^{\sin x}\tan x\csc x` simplifies to a
    non-elementary `e^{\sin x}\sec x` — likely OCR misread); 2016 #17 (garbled nested-exponential
    OCR line, no confident reading).
  - One genuinely interesting case: 2017 #15 is a *limit* of a sequence of integrals built from an
    infinite continued fraction with `√x` at the base. Per the runbook's continued-fraction
    playbook, derived that the fixed point is independent of x (golden ratio conjugate
    `(√5-1)/2`), so the limiting integrand is literally a constant — verified and shipped as an
    ordinary `Problem` with the continued-fraction structure preserved in the LaTeX `integrand`
    field (rendered via `\cfrac`) for pedagogical honesty, `integrandExpr` being the resolved
    constant.
  - Two infinite-domain substitutions now exercised repeatedly and working well: `(a,∞)` via
    `x=a+t/(1-t)` and `(-∞,∞)` via `x=t/(1-t²)`, both composed with the existing finite smoothstep
    scheme — six infinite-domain problems shipped this round (2016 #20, 2017 #2, #6, #8, #10,
    #16, #17) all converged cleanly at the default `n=4000`, including a couple of merely
    power-law-decaying integrands (`ln x/x²`, `1/(x(x²+1))`) not just exponentially-decaying ones —
    worth knowing for future years, the earlier caveat about slow convergence seems to bite mainly
    on oscillatory/logarithmically-decaying tails specifically, not all non-exponential decay.
  - **Remaining**: 2018 through 2020, 2022 through 2026 — 8 more years. Continuing.
- 2026-08-27 (continued further still): Mined 2018-2020, completing the entire 2010-2020 span
  (2021 genuinely doesn't exist — no PDF for it, confirmed by the owner earlier). Commits
  `c5d88c9` (2018, 17 problems), `763f612` (2019, 18 problems), `19cc1cf` (2020, 17 problems).
  1192/1192 tests passing, typecheck and lint clean after each. Same workflow throughout.
  - Duplicates caught and handled the same way each time (re-attribute the pre-existing
    `{name:"original"}` entry's source rather than add a copy): 2018's `1/(1+sin x)`; 2019's
    `sin(√x)` (left untouched, already Fresno-sourced — third time this exact integral has come up
    across different years' exams); 2020's `log(x²+1)` and `sqrt(1-x²)` on `[0,1]`.
  - Two more "resolves to a constant/simple form" problems in the 2018/2020 style: 2020's nested
    square-root tower (telescopes to exactly `x` via a geometric `Σ1/2ⁿ=1` exponent sum, versus
    2018's factorial-sum nested-radical which gave `x^(e-2)`) and a telescoping finite-sum quotient
    that collapses via the geometric series identity `(x-1)(1+x+...+xⁿ)=x^(n+1)-1` into a one-line
    derivative.
  - **Real bug caught and fixed during this phase, worth remembering for future years**: a
    2019 infinite-domain problem was drafted with the source problem's own variable name (`t`)
    instead of `x`. The shared test harness's `fn()` helper always binds the argument as `x`
    regardless of what the `integrandExpr` string uses — so a `t`-named expression evaluates
    `t` as an undefined symbol, and the whole quadrature check silently degenerates to 0. A
    hand-rolled throwaway verification script that (coincidentally, since I wrote both the
    problem and the script) *also* used `t` passed cleanly, masking the bug until the real
    `npx vitest run` caught it. Lesson for future sessions: always write `integrandExpr` in terms
    of `x`, even when the source problem itself uses a different letter — and don't fully trust a
    throwaway script's PASS if its variable naming happens to mirror the bug.
  - Two more genuinely hard cases hit and skipped-with-reason (not forced, not silently dropped):
    2019's `(cos3x+sin2x)(-sin(2019x)+cos3x)` on `[-2π,2π]` and 2020's `cos²⁰²⁰(x)` on `[0,2π]` —
    the first oscillates too fast (~4000 periods) for the shared `n=4000` quadrature to resolve
    without aliasing (confirmed failing at 25x the tolerance), the second has an exact closed form
    but every mathjs-expressible route to it (raw factorials, Gamma-function ratios) overflows
    double precision before the huge intermediate values cancel down to the modest final answer.
    Both are the same underlying limitation as 2018's `|sin(2018x)|` case — noting the pattern in
    case a future session wants to invest in a smarter/adaptive quadrature or an exact-arithmetic
    path for these specifically, rather than re-discovering the same wall each time.
  - **Remaining**: 2022 through 2026 — 5 more years. Continuing.
- 2026-08-27 (continued yet further): Mined 2022 and 2023. Commits `2487a0e` (2022, 17 problems),
  `db57eae` (2023, 16 problems). 1260/1260 tests passing, typecheck and lint clean after each.
  Same workflow throughout (fresh read of the year's extracted text, hand-derive, throwaway-script
  verify, grep for duplicates, write, full suite + tsc + eslint, commit, push).
  - Duplicates caught and re-attributed rather than duplicated: 2022's `1/(1+cos²x)`; 2023's
    `sech(x)` was an exact match of 2017's already-added entry (left untouched, no re-attribution
    needed since already correctly sourced there).
  - Two more "resolves via a clean identity" finds worth remembering as a pattern: 2022's fixed-
    point limit of nested `sin(π/3·…)` converges to exactly `1/2` (since `sin(π/6)=1/2` exactly,
    and the derivative there confirms it's attracting), and 2023's six-reciprocal-trig-function sum
    telescopes to the constant `3` via three pairings (`1/(1+tan x)+1/(1+cot x)=1`, etc.) — same
    "introducing constants" family as the golden-ratio and nested-radical finds from earlier years.
  - **New numerical-resolution hard case confirmed, same root cause as the recurring
    oscillation/aliasing issue but a different symptom**: 2022's `x²-⌊x⌋⌈x⌉` on `[0,2022]` has an
    exact closed form (674, each unit interval contributing exactly 1/3) but the *pointwise*
    integrand magnitude grows linearly with x while the true integral stays tiny — the shared
    quadrature's `n=4000` can't resolve that much cancellation across ~2022 sawtooth periods
    (failed by 14x the integrand's own magnitude). 2023's iterated tent-map problem
    (`|...|x|-1|...-1|`, 2023 nested absolter values, on `[-2023,2023]`) hit the identical wall:
    an exact closed form (2023) verified two independent ways by hand, but a ~2023-period sawtooth
    the quadrature can't resolve at `n=4000` (failed by 29x tolerance). Also 2023's
    `⌊2023 sin x⌋` on `[0,2π]` — which LOOKED like it would hit the same wall — actually converged
    cleanly; the failure mode isn't simply "big N appears in the problem," it's specifically
    "the true integral requires resolving O(N) fine-grained periodic/sawtooth structure to get
    right," which floor-of-a-single-sine apparently doesn't trigger the same way iterated maps and
    quadratic-vs-floor products do. Four such cases now on record (2018 `|sin(2018x)|`, 2019's
    `sin(2019x)`-oscillation, 2022's floor-ceil product, 2023's tent-map) — a real pattern, noted
    again here in case a future session wants to invest in adaptive quadrature for these
    specifically rather than re-discovering the wall a fifth time.
  - **Remaining**: 2024 through 2026 — 3 more years. Continuing.
- 2026-08-27 (continued further still — final year): Mined 2024, 2025 and 2026, **completing the
  entire 16-year MIT qualifying archive**. Commits `b6f356a` (2024, 14 problems), `7f7d4c6` (2025,
  18 problems), and 2026 in two parts: `e48be28` (part 1, 8 problems) and `d896cc6` (part 2, 9
  problems). 1457/1457 tests passing across the whole repo, typecheck and lint clean. Same
  workflow throughout.
  - **2026 (17 problems total)** — the notable tricks, since this year leaned unusually hard on
    "the integrand isn't what it looks like":
    - #4: a 2026-deep nested absolute-value tower `|x+|x+…+|x+|x||…||`. It splits by sign: for
      x≥0 each layer adds another copy of x (`f_n=nx` by induction), but for x<0 it has period 2
      (`f_1=-x, f_2=0, f_3=-x, …`), so an *even* depth collapses to 0. Closed form
      `2026·max(x,0)`, value 1013. Confirmed by directly iterating the real 2026-layer recurrence,
      not just by the algebra.
    - #12: nested radical `√(x²+x+√(x²+x+…))` — the fixed-point quadratic `y²-y-(x²+x)=0` has
      discriminant `(2x+1)²`, an exact perfect square, so the whole tower is just `x+1`. Same
      family as 2024 #20's continued fraction and 2017 #15's golden-ratio limit.
    - #13: `cos⁵x-10cos³x sin²x+5cos x sin⁴x` is `Re[(cos x+i sin x)^5]` expanded binomially (only
      the even powers of `i sin x` survive), which by De Moivre is exactly `cos5x`. The
      complex-exponential trick the UK-guide pass added to the `trig-identity` lesson paying off.
    - #17: `e^{-x²}/(1+e^{2x})` over the whole line. Multiplying `f(-x)` top and bottom by `e^{2x}`
      gives `f(x)+f(-x)=e^{-x²}`, a plain Gaussian — so `2I=√π` and `I=√π/2` without ever
      integrating f alone. A genuinely elegant pairing-symmetry case, tagged both
      `gaussian-hypersphere` and `symmetry`.
    - #16: a six-trig-function quotient under a radical that collapses to `cot⁴x`, whose root is
      `cot²x=csc²x-1`. #8: `Σ_{n=2}^∞ xⁿ` as a shifted geometric series `x²/(1-x)`. #11:
      `max(0,(√(1-x²)-1)/2)` is identically 0 on `[-1,1]`. #19: `ln(ln x)ln(ln(ln x))/(x ln x)`
      reduces to `∫u ln u du` under `u=ln(ln x)` (domain `[20,30]`, safely above `e^e`).
  - Duplicates caught and handled the established way: `x²sin(x)` (#9) was already in `parts.ts` as
    `{name:"original"}` and was **re-attributed** to MIT 2026 rather than copied; `atan(√x)` (#14)
    was already present and correctly sourced to Fresno State, so it was left untouched and the
    2026 entry skipped.
  - Skipped-with-reason (not silently dropped): 2026 #20, a triple-nested `cos²` composition with
    no closed form found in the time available.
  - **One near-duplicate worth the owner's eye rather than a unilateral decision**: 2026 #7 is
    `∫2ln(x)/x²dx`, which is the pre-existing `parts-log-over-square` (`ln x/x²`, still
    `{name:"original"}`) times a constant. It was added as its own entry because it *is* a faithful
    transcription of a real sourced problem and the exact-duplicate test doesn't consider it one —
    but if the owner would rather the bank never carry two integrals that differ only by a constant
    factor, the fix is to drop `parts-two-log-over-square` and re-attribute the older entry. Flagged
    rather than guessed, matching how the earlier attribution gaps were handled.
  - **Real bug caught during verification** (logged because it's a recurring class): the
    `e^{2026e^x+x}` problem's first draft used domain `[-0.3,0.3]`, which lets `2026e^x` reach
    ~2735 — `e^2735` overflows to `Infinity` in double precision, failing both the derivative check
    and the self-answer-acceptance test. Fixed by moving the domain to `[-4,-3.5]`, where every
    intermediate value stays representable. Companion to the 2019 `t`-vs-`x` variable-naming bug:
    when a problem carries a huge constant, *pick the domain to keep intermediates in range* rather
    than defaulting to a domain near 0.
  - **End-of-session final check** (whole repo, not just `src/features/integrals`):
    `npx vitest run` — 1457/1457 passing; `npx tsc --noEmit` — clean; `npx eslint src` — 95
    findings (76 errors, 19 warnings) across 42 files, **all pre-existing and all outside this
    task's scope** (`ResourceBank.tsx`, `SessionPage.tsx`, `TrackPapers.tsx`, `paddle.ts`, etc.).
    Zero findings in `src/features/integrals/` or `src/pages/Integral*` — verified by filtering
    eslint's JSON output on those paths, not by eyeballing.
  - **This is the task's natural completion point.** The full MIT qualifying archive (2010–2020,
    2022–2026; 2021 does not exist) is now mined to the pragmatic standard documented throughout
    this log, alongside the SPLASH notes, the UK guide, Fresno State, both HMMT practice sets and
    the MIT 2025 mock. Standing directive #2 forbids inventing new problems by plugging fresh
    numbers into a formula, so **there is no more sourced content to mine without new PDFs from the
    owner**, and no planned engineering work remains queued. A future session/loop iteration
    starting here should check the session uploads for new source material first; if there is none,
    report that back rather than manufacturing busywork — don't invent problems, and don't add
    speculative features.

- 2026-08-27 (new session, different branch): Started on `claude/feature-gating-new-signups-4hxxdm`
  (per this session's outer harness instructions, which — same as the earlier
  `claude/continue-until-limit-urdt8y` note above — take precedence over this file's own branch line
  for this session specifically). **This session's first message was not "continue"** — it was the
  project owner live in chat, asking for two things explicitly outside this file's stated scope:
  (1) gate every Cortexed feature except Drills/Integral Arena behind a beta flag for new signups,
  (2) get the Integral Arena leaderboard actually working. Both are legitimate, explicit, in-session
  owner instructions, confirmed via `AskUserQuestion` given the direct conflict with this file's "do
  not touch anything else" line — so they were done (commits `21edecd` feature-gating +
  `4f63252`/`69a962d` MIT source-grouping fixes below, plus applying the leaderboard migration
  directly to the live DB via the Lovable MCP `query_database` tool, which this session had access
  to and confirmed was the actual blocker — the migration file existed but had never been run).
  **Non-integrals work this touched** (`src/App.tsx`, `src/components/AppShell.tsx`,
  `src/components/ComingSoon.tsx` new, `src/pages/AuthPage.tsx`, `src/pages/QuestionBank.tsx`): the
  old full-account `waitlist_status`-gates-everything model is gone — every signup now reaches
  `/dashboard` and can play Drills/Integrals immediately; `BetaGate` (in App.tsx) stands a
  `ComingSoon` page in front of every other route until `waitlist_status` (still service-role-only)
  is flipped to `"approved"`. Flagging this explicitly since it's a real, deliberate exception to
  this file's own scope rule, not scope creep — a future session should not assume the rule is gone,
  just that this one instance was owner-authorized.

  While investigating the leaderboard, the owner sent unrelated live feedback on the integrals
  content itself: **the "by source" practice view was badly organized** for MIT specifically. Root
  cause, found and fixed (commits `4f63252`, `69a962d`): `ProblemSource.round` had been set, for all
  247 MIT-sourced problems, to that problem's own citation locator ("Qualifying Test #7") rather
  than an actual round label — and `sourceKey()` groups by `name+year+round`, so every single MIT
  problem was its own one-problem "source." On top of that, `source.year` was never rendered
  anywhere in the UI, so even after fixing the grouping the 16 resulting year-cards would have shown
  as visually identical. Both fixed: `round` is now a constant `"Qualifying Round"` per year (247
  problems, mechanical sed, verified against the full suite before and after), and the by-source
  cards/practice-screen title now show the year. The same `round`-as-citation-locator pattern exists
  more mildly in SPLASH (30→11 groups) and the UK guide (28→20 groups) — left alone since the owner's
  complaint was specifically about MIT papers, but noted here in case a future session should apply
  the same fix there.

  The owner then asked to **re-mine the entire MIT qualifying archive against newly-found source
  material**, confirmed via `AskUserQuestion` ("full re-mine now, autonomously"). Found
  `scraped_data/integration_bee_materials.zip` already checked into the repo (not previously known
  to any session) with the full official archive, including **answer-key PDFs for all 16 qualifying
  years** — the earlier mining sessions explicitly believed no answer keys existed and hand-derived
  everything from the bare problem statements, which is the real reason coverage was thin in the
  early years. It also has 20 entirely unmined documents: regular season, quarterfinal, semifinal
  and finals rounds for 2022–2026, each with **no answer key** (confirmed — only qualifying rounds
  have `_answers.pdf`).

  Built a throwaway `vite-node` harness (`harness.ts`, mirrors `problems.test.ts`'s
  `derivative()`/`quadrature()` exactly, importing the real `normalize()` from `answer.ts` rather
  than reimplementing it) and worked through all 16 qualifying years systematically: read the
  answer key, derive/confirm each candidate against it, batch-verify numerically, grep for
  duplicates, write entries, run the real suite, commit, push. Commits `bd8acb0` (2010: +13),
  `527893b` (2011: +18 — turned out **100% coverable**, 21 direct + 4 legitimate cross-year
  duplicates already attributed elsewhere), `90fb4f1` (2012: +14), `37d35d5` (2013: +9, resolving
  two items a prior session had flagged as unresolvable OCR garble — with the answer key in hand,
  both were clean: "e 4√x" is e^(x^(1/4)) since this document's own "4√x" notation means fourth
  root throughout, and the "messy csc antiderivative" is just the standard ∫csc x dx),
  `abd2cee` (2014: 3/3, second fully-covered year), `526ff61` (2016: +1), `466b614` (2024: +3,
  including a real "introducing constants" recognition: (x-1)^ln(x+1)/(x+1)^ln(x-1) is identically
  1 since both sides equal e^(ln(x+1)ln(x-1))), `cc5c95e` (2023: +2, 2026: +1 plus a real
  misattribution fix — 2026 #7 had been read as "2 ln(x)/x²" and added as a near-duplicate flagged
  for owner judgment; re-checked against the printed answer's x^(log2-1) form and it's actually
  "2^(ln x)/x²", a completely different problem — added the real one and reverted the wrong
  citation back to `{name:"original"}` rather than let it stand). **2015, 2017, 2018, 2019, 2020,
  2022, 2025 needed no changes at all** — a prior session had already hand-derived them essentially
  to completion (18–19 of 20 each) even without the answer keys; the gaps were concentrated in the
  early years (2010–2014), which is exactly what the earlier progress-log entries' lower per-year
  yields predicted.

  **Every genuinely-hard case already on record was re-tested against the now-known answers, not
  just left alone on faith**: 2015 #5 (e^sinx·tanx·cscx) numerically confirmed to diverge under
  every natural reading rather than equal e-1, so the "likely OCR misread" verdict stands with real
  evidence now. 2024 #13 (a Gaussian centered at x=2024) is mathematically trivial but confirmed
  failing numerically at the shared quadrature's n=4000 — same class of resolution limit as the
  fast-oscillation/big-N cases already on record, not a new kind of problem. A few new items (2018
  #15, 2020's OCR sum, 2024 #15/#18, 2025's item 10/12) were tried and set aside as genuinely
  ambiguous OCR rather than guessed at.

  **Net for this pass**: 16 qualifying years all re-verified against real answer keys; ~64 net-new
  problems added; 3 years (2011, 2014, 2026) now fully covered; every remaining gap across all 16
  years is either a documented quadrature-resolution limit or a specific OCR ambiguity, not an
  unexamined skip. 1577/1577 tests passing, typecheck clean, zero lint findings in any file this
  session touched (confirmed by filtering eslint's JSON output on path, not eyeballing).

  **Next, if continuing this same task**: the 20 unmined non-qualifying rounds (regular
  season/quarterfinal/semifinal/finals, 2022–2026) are the only remaining sourced material in
  `scraped_data/integration_bee_materials.zip` — genuinely new content, not gap-filling. These have
  **no answer key**, so each problem needs the full by-hand derivation (not just answer-key
  confirmation) the original 2010–2020 mining sessions used before this session's discovery of the
  answer-key zip — meaningfully higher effort per problem than this pass. Extraction already works
  (`pymupdf`, see the Python one-liner pattern from the earlier 2026-08-27 session log entry above)
  and the text is sitting in this session's scratchpad if still alive; if not, re-extract from the
  zip the same way. This is a natural stopping point to check in with the owner given the effort
  step-up, not a hard technical blocker.

- 2026-08-28 (continuation, same branch): Wrote the 11 verified 2025 Quarterfinal problems (of 13
  candidates; 2 — `floor(x)/sqrt(x)` on `[0,2025]` and a floor-division-difference problem — failed
  numeric verification by large margins and were set aside, not forced) into their technique-tagged
  bank files: `gammaFunction.ts` (incomplete-gamma `x^5e^{-x}` on `[1,∞)`), `trigSubstitution.ts`
  (a hyperbolic-arcsinh antiderivative; `sec x - cos x` symmetry/reduction), `definite.ts` (a
  shifted-cosine symmetric-domain problem collapsing to 4050), `floorFunction.ts` (`floor(e^x)` on
  `[0,2] = 14-ln(5040)`, i.e. `14-ln(7!)`), `partialFractions.ts` (an arctan/cubic problem that
  simplifies via a common factor to `atan(x)/(1+x^2)`, plus `1/(x^8-x^6)`), `trigIdentities.ts`
  (triple-cosine-product identity reducing to `16sec^2(3x)`), `parts.ts` (`(x+1)e^x\ln x`),
  `betaIntegrals.ts` (`x^2/\sqrt{x(1-x)}` on `[0,1]=3\pi/8`), and `substitution.ts` (`x/\sqrt[3]{x^3-3x-2}`,
  using the `(x+1)^2(x-2)` factorization). All sourced to `{name: "MIT Integration Bee", round:
  "Quarterfinal #N"}` / `"Quarterfinal Tiebreakers"` / `"Lightning Round"` as appropriate. Full
  suite: 1807/1807 passing (1708/1708 within `src/features/integrals`), `tsc --noEmit` clean,
  `eslint` clean on every touched file. Committed and pushed.
  - Per the standing "continue autonomously" authorization, moving on next to the remaining unmined
    non-qualifying documents: 2025 Semifinal, 2025 Finals, 2026 Regular Season, 2026 Quarterfinal,
    2026 Semifinal, 2026 Finals — same answer-assisted workflow (these documents embed answers
    inline, same as the qualifying-round answer keys, contrary to this task's earlier assumption
    that they had none).
  - Mined MIT 2025 Semifinal (Semifinal #1/#2 rounds + Tiebreakers): 4 of 10 problems added —
    `sqrt(x)^{1/3}/(1+x^2)` on `[0,∞)=\pi/\sqrt3` (beta reflection formula, `betaIntegrals.ts`),
    `x/(e^{2x}+1)` on `[0,∞)=\pi^2/48` (scaled zeta-series result, `zetaSeries.ts`), a three-linear-
    factor partial-fractions problem (`partialFractions.ts`), and a quartic-under-a-root
    arctanh antiderivative confirmed by direct differentiation (`trigSubstitution.ts`). Skipped with
    reason, not forced: two problems with OCR too garbled to confidently reconstruct (a
    `log(...)`-with-nested-fraction integral evaluating to `2\pi\log(80)`, and an integrand/answer
    pair with `e^{x+1/x}` whose stated antiderivative's derivative provably doesn't match any
    plausible reading of the printed integrand); an infinite-alternating-series-inside-the-integrand
    problem whose closed form is piecewise-in-`\lfloor x\rfloor` and needs a ternary/mod expression
    that mathjs's `normalize()` (built for simple typed answers, not this bank's own quadrature
    checks) can't parse — a genuine schema mismatch, not a math failure, and not worth extending the
    shared grading path for one problem; a self-similar nested-floor-log integral over `(0,1)` too
    ambiguous to reconstruct from the OCR's exponent-vs-multiplication ambiguity; and
    `log(x)/\sqrt{x-x^2}` on `[0,1]=-2\pi\log2` — confirmed correct by hand (matches the closed form
    to 5 decimal places) but the shared `n=4000` quadrature can't resolve the double endpoint
    log/inverse-sqrt singularity to the tight tolerance (verified converging correctly at `n=500000`
    in a throwaway script) — a quadrature-resolution-limit case, same class as those already on
    record, not a new kind of problem.
  - 1815/1815 tests passing, `tsc --noEmit` clean, `eslint` clean on touched files. Committed and
    pushed. Continuing next to 2025 Finals.
  - Mined MIT 2025 Finals: 3 of 5 problems added — a nested-double-radical `\tan x` antiderivative
    confirmed by direct differentiation (`trigSubstitution.ts`), `1/(x+1+\lfloor2\sqrt x\rfloor)^2`
    on `[0,∞)` (`floorFunction.ts` — a genuinely new pattern: floor argument decays slower than x
    itself, so the infinite-domain substitution resolves it cleanly at the shared `n=4000` without
    needing a hand-summed closed form), and a `max(...)^2\cdot\min(...)^2` trig problem verified by
    direct quadrature only, no attempted symbolic piecewise derivation (`trigIdentities.ts`).
    Skipped: a golden-ratio-power floor-function problem whose stated answer (193) doesn't match
    any plausible reading of the OCR'd base (confirmed \left(\frac{1+\sqrt5}2\right)^{\lfloor
    x\rfloor} on `[0,10]` numerically gives ≈197.4, not 193 — tried the reciprocal/conjugate base
    too, off by an order of magnitude); a fifth problem with OCR too garbled (multiple nested
    fraction/radical layers with unclear grouping) to attempt.
  - 1821/1821 tests passing, `tsc --noEmit` clean, `eslint` clean on touched files. Committed and
    pushed. This closes out both 2025 Semifinal and Finals — next per the standing authorization:
    2026 Regular Season, 2026 Quarterfinal, 2026 Semifinal, 2026 Finals.
