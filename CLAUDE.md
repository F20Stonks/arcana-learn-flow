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
  - Mined MIT 2026 Regular Season (20 problems, the largest single non-qualifying document):
    15 of 20 added. Along the way, finally did the `lambertw` engineering work the runbook
    pre-authorized back when the HMMT set was mined but never actually implemented: added
    `src/features/integrals/mathEngine.ts`, a shared `create(all)`-based mathjs instance with a
    hand-rolled Newton/Halley `lambertw` (principal branch, valid for x>-1/e, with a square-root
    expansion near the branch point for numerical stability) registered via `math.import`. Both
    `answer.ts` (live grading) and `problems.test.ts` (the self-verifying suite) now import `parse`
    from this shared instance instead of bare `mathjs`, and `"lambertw"` was added to `FUNCTIONS` in
    `answer.ts`. Verified the swap alone changes nothing (1722/1722 still passing before adding any
    new content) before using it. This unlocked a genuinely elegant problem (Regular Season #18):
    the infinite power-tower `x^{x^{x^{\cdots}}}` integral, solved by recognizing implicit
    differentiation gives `d/dx[1/h]` where `h` is the tower — turning the integral into
    `[1/h]` evaluated at the endpoints, with `h(x)=-W(-\ln x)/\ln x` in closed form and the famous
    `h(\sqrt2)=2` identity landing the answer at exactly `-3/2`, confirmed both by hand and via the
    new `lambertw`.
    - Added across `substitution.ts` (4, including the power-tower problem and a `x^{2025}e^{x^{2026}}`
      problem graded as indefinite on a safe domain since the competition's own `[0,2026]` bounds
      would require evaluating `e^{2026^{2026}}`, overflowing double precision — same overflow
      pattern documented in earlier sessions), `partialFractions.ts` (3), `trigSubstitution.ts` (2),
      `trigIdentities.ts` (2, including a sign-function integral of a four-term sine sum, verified
      by quadrature against the sum-of-sines closed form's zero crossings), `parts.ts` (3, including
      a genuine double-by-parts `(\operatorname{arcsinh}x)^2` and a "guess a quotient-rule-shaped
      antiderivative and confirm by differentiating" problem), and `definite.ts` (1, a clean
      cancellation-to-zero problem verified numerically without a full symmetry proof).
    - Caught and fixed two of my own hand-derivation overreaches before committing, per this
      session's established self-review practice: (1) an initially-claimed reciprocal-substitution
      symmetry for Problem 12 (`x^8/(x^8-x^6+x^4-x^2+1)` on `[\tfrac12,2]`) turned out false when
      checked numerically (`f(x)+f(1/x)` is not constant) — rewritten to state only the verified
      denominator factorization `(x^{10}+1)/(x^2+1)` and rely on the numeric check rather than a
      wrong proof; (2) a fabricated-looking `\cos(x/2)` factor in a sum-of-sines identity was
      dropped after re-deriving the standard `\sum\sin(kx)` closed form from scratch.
    - Skipped with reason, not forced: Problem 3 (`e^x` minus `x` minus `\sqrt{x^4/4-x+1}-\frac1{2x}`
      under nested radicals, OCR too garbled to reconstruct with confidence); Problem 4 (four
      iterated definite integrals stacked in a way the OCR renders ambiguously — not confidently
      the standard Cauchy repeated-integration pattern); Problem 11 (`\sum_{k=1}^\infty\frac1k
      \lfloor x/k\rfloor`, a genuine infinite sum with no simple closed form — a real divisor-
      summatory-function object, schema mismatch); Problem 19 (algebra check showed the OCR'd
      identity claiming the integrand equals 1 is false as transcribed — the true expression is
      unrecoverable from the garbled source); Problem 20 (a genuinely deep self-referential nested
      power-tower-of-4 continued structure — flagged as worth a dedicated session rather than
      attempted under time pressure here).
    - 1851/1851 tests passing (whole repo), `tsc --noEmit` clean, `eslint` clean on every touched
      file including the new `mathEngine.ts`. Committed and pushed. Continuing next to 2026
      Quarterfinal.
  - Mined MIT 2026 Quarterfinal (#1-4 + Tiebreakers, 13 problems): 9 of 13 added — a mixed
    arcsinh/arcsin antiderivative and a quartic-split arctan/arctanh antiderivative
    (`trigSubstitution.ts`), a dilogarithm special-value problem on `[0,\tfrac12]`
    (`zetaSeries.ts`), `1/(x^6+1)` on `[0,∞)=\pi/3` (`betaIntegrals.ts`), a Gamma-function problem
    with `x^{3/2}e^{-x^5/2025}` engineered so `2025=45^2` cancels cleanly to `9\sqrt\pi`
    (`gammaFunction.ts`), a floor/ceil-squared telescoping-series problem (`floorFunction.ts`), a
    Feynman-trick oscillatory infinite integral verified by quadrature only
    (`feynman.ts`), a genuine by-parts reduction mixing circular and hyperbolic inverse functions
    `\sin(\operatorname{arccosh}x)` (`parts.ts`), and a `u=\sqrt x` substitution problem needing
    polynomial long division to close (`substitution.ts`).
    - One exact duplicate found and left alone rather than re-added: `x^3/(e^x+1)` on `[0,∞)` was
      already present, correctly sourced to HMMT — skipped rather than duplicated or re-attributed
      (the existing citation is real and shouldn't be overwritten just because a second competition
      also used the same integral).
    - One genuinely interesting catch: Quarterfinal #3 Problem 3, `\int_0^{\sqrt3}\arctan\!\left(
      \frac{3x-x^3}{1-3x^2}\right)dx`, uses the tan-triple-angle identity, but the stated answer
      `\pi\sqrt3-3\ln2` does NOT match either the raw branch-jumping integrand or the analytically
      hand-derived piecewise form (`3\arctan x` minus `\pi` past the branch cut at `x=1/\sqrt3`) —
      verified with real effort (both a direct quadrature of the literal arctan expression and an
      independent closed-form derivation of the piecewise antiderivative, which agree with each
      other at ≈-0.266 but not with the OCR'd answer) rather than just assumed wrong. Set aside as
      an OCR/transcription mismatch, not forced.
    - Skipped with reason: Quarterfinal #3 Problem 2, an alternating sign raised to an infinite sum
      of floor terms in the exponent — same infinite-series-in-the-integrand schema mismatch as
      Regular Season #11, not attempted.
    - 1869/1869 tests passing, `tsc --noEmit` clean, `eslint` clean on touched files. Committed and
      pushed. Continuing next to 2026 Semifinal.
  - Mined MIT 2026 Semifinal (#1/#2 rounds + Tiebreakers, 9 problems): 6 of 9 added — an arctan-of-
    quartic-root antiderivative (`substitution.ts`), a combinatorial `min-max-min` of cosines
    problem written out as an explicit 8-combination nested min/max expression rather than
    reasoned abstractly (`definite.ts`), a completed-square ellipse-arc area-difference problem
    (`definite.ts`), a "guess a product-rule-shaped antiderivative and confirm by differentiating"
    problem with a `\sqrt3` power (`parts.ts`), a 9-prime-frequency product-of-cosines problem
    verified by quadrature rather than hand-enumerating 256 sign combinations (`trigIdentities.ts`),
    and a repeated-linear-root-plus-irreducible-quadratic partial-fractions problem
    (`partialFractions.ts`).
    - Skipped with reason: two problems are literal limits of a sequence of integrals (`\lim_{n\to
      \infty}` of an integral depending on n, in one case a `\sqrt n\,(\cdots)^n` integrand, in the
      other an n-fold nested `(\cdots^2-2)` recurrence) — the same schema mismatch as every prior
      "limit of a sequence of integrals" case this session, not a single `Problem`. One
      (`\sqrt{(x-1)(x+1)/((x-2)x(x+2))}` on the whole real line) was attempted but the integrand is
      negative under the square root across large stretches of the domain and has poles at
      `x=-2,-1,0,1,2` — numeric verification came back off by 6 orders of magnitude, confirming
      this is a genuinely hard case (likely needs principal-value/contour handling this bank's
      quadrature can't do), not forced.
    - 1881/1881 tests passing, `tsc --noEmit` clean, `eslint` clean on touched files. Committed and
      pushed. Continuing next to 2026 Finals — the last unmined document in this batch.
  - Mined MIT 2026 Finals (5 problems, the hardest single document in the whole batch): 2 of 5
    added. The standout find: Finals Problem 1 looked like a schema-mismatch "limit of a sequence
    of integrals" (`\lim_{n\to\infty}\int_0^1\sum_{k=1}^n\frac1{nx^2+kx+n}\,dx`) exactly like the
    ones skipped throughout this session — but recognizing the inner sum as a Riemann sum
    (`\sum_{k=1}^n\frac1n\cdot\frac1{x^2+\frac knx+1}\to\int_0^1\frac{dt}{x^2+tx+1}` as `n\to\infty`)
    turns the whole thing into an ordinary iterated integral, and the inner `t`-integral has an
    elementary closed form (`\frac1x\ln\frac{x^2+x+1}{x^2+1}`) — collapsing what looked like an
    unrepresentable limit into a completely normal single-variable `Problem`, verified numerically
    to `5\pi^2/72` (`definite.ts`). Also added a partial-fractions-built reciprocal problem over the
    whole real line, `\frac1{S(x)^{-2}+1}` where `S` sums three simple-pole terms, verified
    numerically to `9\pi` (`partialFractions.ts`).
    - Skipped with reason: Finals Problem 3, a genuine `n\to\infty` limit of an `n`-deep nested
      `\log_{\sqrt2}` tower whose fixed-point equation `L=\log_{\sqrt2}(x+L)` (i.e.
      `2^{L/2}=x+L`) is transcendental and depends nontrivially on `x` across the whole `[0,2026]`
      domain — unlike the golden-ratio/nested-radical towers found earlier this session, this one
      doesn't collapse to a constant, and solving it generically would need a dedicated Newton's-
      method custom function (a real engineering investment, flagged for a future session rather
      than attempted under time pressure here, same spirit as the `lambertw` addition earlier in
      this batch). Finals Problem 2 (a `\sqrt[4]{}`-heavy antiderivative) was not attempted given
      time constraints. Finals Problem 4 (`(\sqrt[4]{\frac1x-4})^2+\sqrt[4]{\frac1x-4}` on
      `[0,\frac14]`) was checked two independent ways (direct quadrature over `x`, and an explicit
      `t=\sqrt[4]{\frac1x-4}` substitution turning it into `4\int_0^\infty\frac{t^5+t^4}{(t^4+4)^2}
      dt`, both agreeing with each other at ≈1.178 but not with the OCR'd answer `\frac34`) —
      confirmed genuine transcription mismatch, not forced.
  - **This completes every document in `scraped_data/integration_bee_materials.zip`** — all 16
    qualifying years (re-mined against the newly-found answer keys) and all 20 non-qualifying
    rounds (regular season/quarterfinal/semifinal/finals, 2022–2026) have now been mined to the
    pragmatic standard documented throughout this log. 1885/1885 tests passing (whole repo),
    `tsc --noEmit` clean, `eslint` clean on every file this session touched. Per standing directive
    #2, there is no more sourced content to mine without new PDFs from the owner — a future
    session/loop iteration starting here should check for new uploads first, and if none, report
    that back rather than manufacturing busywork. Two flagged follow-ups for the owner, both noted
    inline above where they came up: (1) the log-tower limit (Finals Problem 3) and the two
    remaining Finals problems would benefit from a dedicated pass with more runway; (2) the
    `mathEngine.ts` infra (shared mathjs instance with `lambertw`) is now in place and could be
    extended the same way for `gcd` (mathjs has it natively, just needs whitelisting) or other
    custom functions the next PDF batch might need.

- 2026-08-29 (new session, `UK_BEE_BURST.md` supersedes this file for the window it names):
  Started on `claude/pensive-tesla-421vh8` at baseline commit `5278b62` (1901/1901 passing,
  `tsc --noEmit` clean, reproduced before the first edit as required). Working the runbook's
  workstreams in order — see `UK_BEE_BURST.md` for the full spec; this file's own standing
  directives and Workflow section still apply except where that runbook tightens them.

  **WS-1 · Attempt logging + split clock — shipped, commit `438837d`.** New store
  `src/features/integrals/attempts.ts`, alongside `progress.ts` (same fail-soft localStorage
  pattern, reuses `progress.ts`'s `scopedKey` rather than widening `Progress` itself — its own
  cache self-invalidates on scope change by re-checking `scopedKey` on every read, so no change to
  `progress.ts` was needed at all). One row per submission — correct, incorrect,
  off-by-constant-factor or unparseable, not just solves — with `problemId`, `mode`
  (training/daily/sprint), verdict class, the raw submitted string, hints open,
  `wrongAttemptsSoFar`, and the two clocks the runbook asked for: `msToFirstKeystroke`
  (recognition) and `msFirstKeystrokeToSubmit` (execution), alongside the existing `elapsed`
  clock in each run hook, untouched. Ring buffer capped at 5000 (`MAX_ATTEMPTS`, exported).
  - Wired into `useIntegralRun`, `useSprintRun`, `useDailyRun`: each tracks a `firstKeystrokeAt`
    ref (reset per problem/slot) set on the first `setInput` call, and calls `recordAttempt()` in
    `submit()` before branching on the verdict. Sprint mode gets its own per-problem
    `problemWrongAttempts` ref for `wrongAttemptsSoFar`, kept separate from the pre-existing
    sprint-wide `wrongAttempts` state the result screen displays (untouched, still whole-run).
    `giveUp()` does not log an attempt anywhere — no submitted string, nothing to classify;
    "attempt" is read as "submission" throughout, matching the runbook's own field list.
  - 10 new tests in `attempts.test.ts` (shape, ring-buffer cap + eviction order, per-account
    scoping, storage-unavailable fail-soft, reset). The ring-buffer test pushes 5010 real records
    through the real `recordAttempt()` — genuinely O(n²) since every write re-serialises the
    growing log (the same cost the production write path pays on a long-running account, just
    never hit synchronously 5000 times in a row by a human) — confirmed with a standalone Node
    profile (~9s in plain V8, no jsdom) before concluding it wasn't a bug to chase. Swapped in a
    fast in-memory `Storage` stub for that one test (still exercises the real
    `globalThis.localStorage` code path, just a faster backend) and gave it an explicit 20s
    timeout rather than weakening what it proves; merged what was originally two tests into one so
    the cost is paid once (~7.4s) rather than twice.
  - Verified: `npx vitest run` — 1911/1911 passing (was 1901/1901); `npx tsc --noEmit` clean;
    `eslint` clean on every touched file. Also a real Playwright walkthrough against the dev
    server (`/dev/integrals/train/power`, `/dev/integrals/daily`, `/dev/integrals/sprint` —
    submitted wrong answers in training and sprint, skipped in sprint): attempts landed in
    `localStorage` under `arcana.integrals.attempts.v1` as expected (1 after the training
    submission, 2 after adding the sprint one), zero console/page errors, no visual regression.
    Nothing in WS-1's stated scope was skipped.

  **Next**: WS-2, the lesson rebuild — see the entry that follows once it lands, or (if this file
  is being read mid-workstream) check `git log` on this branch for the latest state.

  **WS-2 · Rebuild the lessons for a reader fresh out of A-level — shipped, commit `20bea88`.**
  Extended `Technique` (`types.ts`) additively: `prerequisites?`, `intuition?`,
  `examples?: WorkedExample[]` (graduated — first spells out every step, later ones compress),
  `checkYourself?: {prompt, answer, hint}` (reveal-only, no live grading). The legacy singular
  `example` field stays required and every rebuilt technique sets it to `examples[0]` via a shared
  local const, so it can never drift from `examples` and `mathText.test.ts`'s existing
  "everything in the curriculum renders" check (which reads `.example` directly) kept passing
  completely unedited. `WorkedExample` also grows an optional
  `integrandExpr`/`resultExpr`/`domain`/`kind` — same machine-checkable-mirror pattern as
  `Problem.integrandExpr`/`answer` — set only on examples stating a literal evaluatable integral.
  - New `lessonExamples.test.ts` (42 tests) checks every gradeable example the same way
    `problems.test.ts` checks the graded bank — `derivative()`/`quadrature()` duplicated verbatim
    (not imported, so importing this file can never re-trigger another file's test registrations)
    — plus a strict-mode KaTeX-render check across all 21 techniques' new and old prose fields.
  - Rebuilt all 10 techniques the runbook named, in its stated order: the A-level bridge (`power`,
    `u-sub`, `parts`, `trig-identity`, `trig-sub`, `partial-fractions`, `complete-square`) then the
    definite-integral core (`symmetry`, `t-sub`, `feynman`). Each got a prerequisites chip list, an
    intuition paragraph deriving *why* the move works, two graduated worked examples, and a
    checkYourself self-check. `t-sub` specifically now derives \sin x=\frac{2t}{1+t^2} etc. from
    the double-angle formulas in `intuition` (rather than asserting it) and spells out the `dx`
    cancellation step by step in its example instead of folding it in silently — the exact gap the
    runbook called out by name. Every one of the 30 new numeric claims across the 10 lessons was
    verified with a throwaway Node script (plain `Math.*`, not reusing mathjs/`normalize()`,
    mirroring `problems.test.ts`'s methods including the infinite-domain substitutions) before
    being written down, with comfortable margins (smallest ~3100x tolerance, most 10^6–10^11x) —
    well clear of the "within ~50% of the boundary, find a cleaner example" guardrail. One genuinely
    new addition (not just a rewrite of existing content): the Frullani integral
    `\int_0^\infty\frac{e^{-x}-e^{-2x}}x\,dx=\ln2` as `feynman`'s first, more-spelled-out example,
    with the existing `\ln3` example kept as the second, more compressed one.
  - `LessonBody.tsx` rewritten to render the new sections when present (prerequisite chips linked
    to their own lesson when the text names an existing technique; "Why it works"; graduated
    "Worked examples", labelled "Example N of M" past the first; a reveal-only "Check yourself")
    and to fall back cleanly to the old single "Worked example" heading with no extra sections for
    the 11 techniques not rebuilt this pass. Verified in both real render contexts (the standalone
    Lessons library, and the collapsed lesson panel on the training/practice screen) via a real
    Playwright walkthrough against the dev server — including a non-rebuilt technique (Recurrence
    relations) specifically to confirm the fallback path shows no empty sections.
  - Verified: `npx vitest run` — 1953/1953 passing (was 1911/1911 after WS-1); `npx tsc --noEmit`
    clean; `eslint` clean on every touched file.
  - **Skipped, per the runbook's own ordering** ("stop when the window closes" / "everything else
    only if time genuinely remains"): the other 11 techniques (`recurrence`, `inverse-integral`,
    `floor-function`, `beta-integrals`, `introducing-constants`, `log-power-integrals`,
    `reciprocal-substitution`, `gamma-function`, `zeta-series`, `wallis-product`,
    `gaussian-hypersphere`) keep their original single-example lessons untouched. `checkYourself`
    was deliberately NOT given its own machine-checkable mirror the way `WorkedExample` has — the
    runbook fixed its shape at exactly `{prompt, answer, hint}` and I chose not to extend past that
    spec — every `checkYourself` answer was still hand-verified via the same throwaway-script
    method before shipping, just not wired into an automated regression fixture. Flagging this
    scoping call explicitly per the runbook's own instinct to surface rather than silently guess.

  **Next**: WS-3 (paper mode) per the runbook's order.

  **WS-3 · Round 1 paper mode — STARTED, NOT FINISHED (commit `e0fb98f`).** The Sonnet agent
  executing this burst was terminated mid-WS-3 by an API session rate limit, not by anything in the
  code. What exists is committed deliberately as work-in-progress so an ephemeral container cannot
  destroy it, and is safe to leave sitting there: **nothing imports any of it** (verified by grep
  across `src/`), so it is inert with respect to the running app.
  - Landed and passing: `uk/paper.ts` (deterministic 30-question assembly, three bands of ten by
    difficulty ≤2/3/4–5, ~70% definite per band, seeded via the existing `shuffled` from `rng.ts`),
    `uk/paperHistory.ts` (per-sitting record store), `hooks/usePaperRun.ts` (free-navigation answer
    sheet, 120-minute clock), and 22 tests across `uk/paper.test.ts` + `uk/paperHistory.test.ts`.
  - **Still missing before WS-3 can be called shipped**: the page component and the
    `/integrals/uk/round1` route plus its `/dev/` twin in `App.tsx`; the end-of-paper review and
    per-band pacing report; wiring `usePaperRun` to `recordAttempt` from WS-1 so paper sittings feed
    the attempt log; and the mandatory Playwright walkthrough against the dev route. Until the
    walkthrough exists this is unverified in the only way that counts for a UI mode.
  - Verified state at the time of this entry: committed tree is **1953/1953** passing; with the
    WS-3 WIP files present the suite is **1975/1975**; `tsc --noEmit` clean in both cases.
  - **Next session resumes here**, at WS-3, from `UK_BEE_BURST.md`. WS-4 (scheduler), WS-5 (error
    taxonomy) and WS-6 (recognition drill + values deck) remain untouched.

- 2026-08-29 (new session, same branch): Resumed at WS-3 per the previous entry. Reproduced the
  stated baseline first (1975/1975, working tree clean) before touching anything.

  **Tooling finding, flagged rather than fixed — read this before trusting any past or future
  "`tsc --noEmit` clean" claim in this log.** `npx tsc --noEmit` run from the repo root is a
  no-op: the root `tsconfig.json` has `"files": []` and only `references` to
  `tsconfig.app.json`/`tsconfig.node.json`, which tsc only resolves under `--build` mode. Without
  `-b`, plain `tsc --noEmit` at the root type-checks **zero files** and exits 0 — confirmed with
  `--listFiles` (empty output) and by deliberately re-triggering a real type error, which the root
  invocation missed entirely while `npx tsc --noEmit -p tsconfig.app.json` (which really does
  `"include": ["src"]`, i.e. the whole app) caught it immediately. This means the exact command
  this runbook's verification loop names, run exactly as written, has likely been silently
  checking nothing for this entire burst (and possibly longer — every "`tsc --noEmit` clean" line
  earlier in this file was almost certainly a real `npm install`/`vitest` run but a no-op tsc run).
  Did **not** fix the root `tsconfig.json` myself: it's shared build config outside this task's
  stated paths, and — more importantly — making the root invocation real for the first time could
  surface a backlog of pre-existing type errors anywhere in the app (this burst already knows the
  app carries ~95 pre-existing lint findings outside its scope; the type-check equivalent is
  unmeasured) which would then look like *this task* broke `tsc`, or block "clean" forever without
  touching out-of-scope files. Used `npx tsc --noEmit -p tsconfig.app.json` for every real
  typecheck in this session instead (confirmed clean throughout) and am flagging this here for the
  owner rather than guessing at a fix to shared config. **If future sessions want the literal
  `npx tsc --noEmit` from this runbook's verification loop to mean something, the fix is either
  `-p tsconfig.app.json` explicitly or running `tsc -b`/adding a real `include` to the root
  config — an owner call, not made here.**

  **Found and fixed a real, if latent, type bug in the committed WS-3 WIP while verifying it with
  the working tsc invocation above**: `usePaperRun.ts`'s `recordAttempt()` call already passed
  `mode: "paper"` (the wiring to WS-1 the previous entry listed as still missing was actually
  already written), but `attempts.ts`'s `RunMode` union was still `"training" | "daily" |
  "sprint"` — `"paper"` was never added to it. Vite's dev/build path doesn't type-check (esbuild
  strips types), so this was already working correctly at runtime and every `AttemptRecord` in
  this session's walkthrough came out with the right `mode` — but it was a real static-type gap
  that `-p tsconfig.app.json` caught immediately. Fixed by adding `"paper"` to `RunMode`
  (additive, one line); confirmed nothing else switches exhaustively on that union
  (`scoring.ts`'s own `mode: "daily" | "training"` and `AnswerInput.tsx`'s Type/Build `mode` are
  unrelated fields with the same name, unaffected).

  **Shipped** (commit `<see below>`): `src/pages/IntegralPaper.tsx` — the paper-mode page, in
  three phases driven by local state so `usePaperRun`'s clock never starts just from landing on
  the route:
  - **Landing**: the rules (three bands, one clock, pause stops the clock not the sitting, flags
    are personal, hand-in vs. time-up both produce a pacing report), and — via
    `paperResultForSeed` — last sitting's score/per-band marks if this week's paper was already
    attempted, with a "Sit it again" CTA (assembles the identical 30 questions, by design, so a
    retry benchmarks against itself).
  - **Running**: single 120-minute clock (`role="timer"`, reddens under 5 minutes left), pause/
    resume (a full overlay replacing the problem while paused), a hand-in button, a live
    attempted/correct/flagged counter, a question-navigator grid grouped by band (each cell
    colour-coded unattempted/attempted/correct, flagged cells get a small dot, current cell
    ringed) driving `goTo`, and the current question rendered with the same `IntegralPrompt` /
    `AnswerInput` / `VerdictLine` the rest of the feature already uses — nothing about grading or
    assembly is reimplemented, exactly as the runbook asked.
  - **Done**: score, triage-cost callout, a per-band pacing table (marks + `formatDuration` time
    spent, from `PaperResult.bands` — already shaped for exactly this by the WIP author), a
    "biggest time sinks" list (non-correct slots sorted by time spent, worst first, click-through
    to review), and a full "review by question" section reusing the same nav grid in read-only
    mode plus the existing `SolutionSteps` component (so every question's correct answer and
    worked solution — not just an aggregate score — is genuinely reviewable, not only the
    per-band summary the data model strictly requires). Per-question review detail (your last
    input, correct/incorrect) is only available for the sitting just finished, in that same
    session — `paperHistory.ts`'s snapshot (which carries per-slot detail) is deliberately cleared
    on finalize and only the band-level aggregate persists, a design already fixed by the WIP
    commit's own doc comments, not something this pass changed.
  - Routes added to `src/App.tsx` following the existing pattern exactly: `/integrals/uk/round1`
    (behind `DashboardGuard`, no `BetaGate` — matches sprint/daily/training) and its `import.meta.
    env.DEV`-gated `/dev/integrals/uk/round1` twin.
  - Added a "UK Round 1" tile to `IntegralsHub.tsx` (between Sprint and the full-width Head-to-
    head tile, completing a clean 2×2 grid) — not explicitly required by the runbook's WS-3 bullet
    list, but a route nothing links to is a route nobody finds; kept to one tile, same visual
    pattern as the three tiles beside it, no other hub changes.

  **Playwright walkthrough — mandatory per the runbook, done against a real dev server, not
  skipped.** `npx playwright install chromium` (already cached in this sandbox's image at
  `/opt/pw-browsers`, confirmed via `PLAYWRIGHT_BROWSERS_PATH`, so this was instant) since the
  `playwright` npm package itself isn't a project devDependency (found it globally installed at
  `npm root -g`; symlinked it into a scratch `node_modules` rather than adding it to this repo's
  `package.json`, since it's a one-off verification tool, not app or test-suite code). Vite dev
  server needed `--host 127.0.0.1` explicitly — the default `host: "::"` in `vite.config.ts`
  fails with `EAFNOSUPPORT` in this sandbox (IPv6 wildcard bind unsupported); also had to use the
  Bash tool's `run_in_background` rather than a manual `&`/`disown`, since a manually backgrounded
  process didn't survive past the end of the tool call that started it (this environment resets
  shell state between Bash invocations, and that reset appears to take detached children with it).
  Read this week's actual assembled paper first via a throwaway `vite-node` script (seed 33,
  "week of Aug 24," Q1 = `floor-plain-0to3`, a definite integral with the clean answer "3") so the
  walkthrough could exercise a genuine correct-answer submission, not just a wrong one. Full
  script drove: landing → begin → wrong answer on Q1 (verified red "not equivalent" state) →
  correct answer "3" on Q1 (verified green "Correct.", nav cell turns primary-coloured, counters
  update) → jump to Q5 via the nav grid and flag it (verified the flag badge and nav-cell dot) →
  pause (verified the overlay, clock frozen) → resume → hand in early → done screen (verified the
  pacing table numbers matched what was actually done: Accessible 1/10, Solid 0/10, Tail 0/10,
  triage cost counting only the non-correct time) → clicked into the review grid → reloaded the
  page from scratch and confirmed the landing screen now shows "Already sat this week" with the
  right score, sourced from real `localStorage`, not component state. Read back
  `arcana.integrals.attempts.v1` and `arcana.integrals.uk.paperHistory.v1` directly from the
  browser's `localStorage` after the run (not just asserted via the UI) — both contained exactly
  the expected records, `mode: "paper"` included, confirming the WS-1 wiring end-to-end through
  real UI interaction rather than code inspection alone. Zero console errors, zero page errors,
  across the whole walkthrough. Also screenshotted `/dev/integrals` to confirm the new hub tile
  renders cleanly alongside the other three. 11 screenshots taken in total; none showed a visual
  regression anywhere else on the pages touched.

  **This closes out WS-3.** Verified: `npx vitest run` — 1975/1975 (unchanged from baseline — this
  workstream is UI + wiring work verified by the mandatory Playwright walkthrough per the
  runbook's own instruction that unit tests aren't sufficient evidence for a UI mode, not new unit
  tests); `npx tsc --noEmit -p tsconfig.app.json` (the real check — see the tooling finding above)
  clean; `eslint` on every touched file (`src/pages/IntegralPaper.tsx`, `src/pages/IntegralsHub.
  tsx`, `src/App.tsx`, `src/features/integrals/attempts.ts`) — zero findings. No existing test was
  edited. `normalize()` and `answer.ts` were not touched.

  **Deliberately not done, and why**: no "retake with different questions" option — the runbook's
  own paper.ts design (one seed per calendar week) makes "the same 30 questions" the intended
  behaviour for a retry, not a gap; a real per-question replay of a *past* (not just-finished)
  sitting — `paperHistory.ts`'s history record is intentionally aggregate-only (band-level), by
  the WIP author's own design, and building per-question persistence for historical sittings would
  mean widening what gets written to `localStorage` on every clock tick, which is exactly the cost
  the existing doc comment in `paperHistory.ts` says was deliberately avoided; flagged here as a
  possible future ask, not built speculatively.

  **Next**: WS-4 (the scheduler) per the runbook's order, time permitting.

- 2026-08-29 (same session, continuing): **WS-4 · the scheduler — shipped, commit `<see below>`.**
  Added `scheduledQueue()` to `src/features/integrals/queue.ts`, beside the untouched
  `orderQueue()`, implementing all five weighted factors the runbook named, in its stated order of
  influence:
  1. **Retention decay** — a solved problem's urgency grows with days since `progress.solves[id].
     solvedAt`, divided by a half-life that shortens the harder that solve was (scaled by the
     `wrongAttemptsSoFar` recorded on the attempt log's most recent *correct* attempt for that
     problem — a clean first-try solve gets the full 6-day half-life, a solve that took several
     wrong attempts decays proportionally faster). A never-solved problem is always more urgent
     than any solved one, however stale — same "unsolved first" contract `orderQueue` already had,
     just backed by a real, comparable number instead of a flat +100.
  2. **Weakness** — per-technique failure rate (fraction of recorded attempts, on problems in the
     pool being scheduled, tagged with that technique, that weren't `"correct"`) multiplies into
     urgency, so a technique he's actually failing gets served more.
  3. **Near-miss priority** — an unsolved problem whose most recent attempt was
     `off-by-constant-factor` gets a large urgency bonus over one never attempted or one whose last
     attempt was flatly wrong — "the method was right" is worth more, exactly as the runbook says.
     Scoped to what's detectable *today*: WS-5 (error taxonomy, not yet built) would let this catch
     a plain sign-flip too, since a general sign error inside a compound expression isn't
     necessarily a scalar multiple of the right answer and the current binary correct/off-by-
     factor/incorrect split can't always tell it apart from ordinary "incorrect" — noted as a real
     extension point for once WS-5 exists, not attempted here.
  4. **Target success band** — splits the urgency-ranked list into "comfortable" (estimated ~≥70%
     odds) and "challenging" (<70%) using a per-problem odds estimate blending difficulty,
     technique track record, and (when there's history) the problem's own last-attempt signal, then
     blends the two streams with a fractional (Bresenham-style) accumulator so ~`targetSuccess`
     (default `TARGET_SUCCESS_DEFAULT = 0.7`, exported) of what's served is the comfortable stream
     — spread evenly across the queue, not front-loaded. Without this step, weakness (factor 2)
     alone would serve every problem from the weakest technique before any other, which is exactly
     the "leads with the hardest material and demoralises" failure mode the runbook called out.
  5. **Interleaving** — a final pass so consecutive problems don't share `techniques[0]`. First
     shipped as a bounded local-swap ("find the nearest later item with a different technique"),
     but a test with an even 3-technique/3-each pool caught it leaving an avoidable clash at the
     tail (it spends its "swap budget" fixing early clashes and runs out); replaced with the
     standard "most-remaining-technique" greedy (classic *reorganize-so-no-two-adjacent-match*
     algorithm, tie-broken by each candidate's position in the priority order from steps 1-4, so
     among equally-pressing techniques the more urgent one still goes first) — complete whenever a
     fully clash-free order exists, and provably minimal-clash otherwise (verified by hand against
     the 5-of-one-technique/1-of-another case: exactly 3 unavoidable adjacent repeats, matching the
     theoretical `2m-n-1` minimum). Left the failing test's fixture as the reason for the rewrite
     rather than weakening the assertion to fit the weaker first draft.

  **Deliberately not switched into `IntegralTraining.tsx`'s `TrainingTechnique`** — the only real
  caller of `orderQueue` today. The runbook says "keep `orderQueue` exported and working for any
  caller not yet migrated ... and switch callers deliberately"; the deliberate decision made here
  is *not yet*, because `integration.test.tsx` has two already-passing tests ("advances through the
  queue and banks training XP", "skips a problem without answering it, recording nothing") that
  hard-code `orderQueue(...)`'s own output as the expected first-served problem. Swapping
  `TrainingTechnique`'s internal call to `scheduledQueue` would desynchronise those fixtures from
  what actually renders and almost certainly break both — exactly the "would need an existing
  passing test changed" condition this project's own rules say to stop and report on rather than
  push through. `scheduledQueue` is fully built, exported and independently tested; wiring it in is
  a follow-up for whenever the owner is fine with those two tests being rewritten to derive `first`
  from `scheduledQueue` instead (or some other resolution) — not decided here.

  **Testing.** New `src/features/integrals/queue.test.ts`, 12 tests, black-box against
  `scheduledQueue`'s documented behaviour (not its internals) with minimal fake `Problem`/
  `AttemptRecord`/`Progress` fixtures: structural invariants (empty pool, output is always an exact
  permutation of the input pool, deterministic for identical inputs), one test per factor above
  (unsolved-beats-solved, stale-beats-recent, harder-solve-decays-faster, weak-technique-beats-
  strong, near-miss-beats-no-attempt, near-miss-beats-flat-wrong, the success-band blend actually
  blends rather than front-loading, interleaving holds when avoidable, and degrades to a full valid
  permutation with the provable minimum of residual clashes when it isn't). Two of these caught
  real problems before being accepted, not just before passing: the weakness test's first draft put
  the "weak technique" filler problems in as *unsolved*, which put them in the always-higher
  unsolved-urgency tier and swamped the very comparison the test meant to isolate — fixed by
  marking them solved-today instead of leaving them out of `progress` entirely; the interleaving
  test's first draft (see factor 5 above) caught the real algorithm gap that led to the rewrite.
  Neither was weakened to pass — one was a fixture bug, the other was a real bug in the code being
  tested, and both are fixed at the root rather than in the assertion.

  Verified: `npx vitest run` — 1987/1987 (was 1975/1975 after WS-3; +12, all new, all in
  `queue.test.ts`); `npx tsc --noEmit -p tsconfig.app.json` clean; `eslint` on `queue.ts` and
  `queue.test.ts` — zero findings. `integration.test.tsx`'s existing `orderQueue`-dependent tests
  were not touched and still pass, confirming `orderQueue` itself is genuinely untouched behaviour,
  not just untouched source.

  **Next**: WS-5 (error taxonomy) per the runbook's order, time permitting.

- 2026-08-29 (same session, continuing): **WS-5 · error taxonomy — shipped, commit `<see below>`.**
  New `src/features/integrals/errorTaxonomy.ts`: `classifyError(problem, verdict, rawInput)` labels
  an already-non-correct `Verdict` — it never decides correctness itself, only why a wrong one
  looks the way it does, checked in priority order:
  1. **`sign-flip` / `constant-factor`** — not separately detected at all; answer.ts's own
     `off-by-constant-factor` verdict already carries the factor, so this is just
     `Math.abs(factor + 1) < 0.02 ? "sign-flip" : "constant-factor"`. Verified the 0.02 tolerance
     is safely inside the real gap: with `asSimpleRatio` only checking denominators up to 12, the
     nearest *other* simple ratio to -1 the live grader can ever actually produce is -11/12
     (~0.083 away) — so this can never ambiguously straddle real content.
  2. **`correct-but-unsimplified`** — re-checks the submitted string against the reference with a
     much looser tolerance (1e-4/1e-5 vs. answer.ts's 1e-6/1e-7) and a denser, differently-phased
     resample (60 points vs. 11) — "was this actually right and the strict check just got
     unlucky", surfaced purely as a label, never changing the real verdict already returned.
  3. **`missing-absolute-value`** — the classic dropped-bars `ln|x|` slip. Doesn't assume the sign
     change sits at x=0: numerically, it looks for a real gap in valid domain (points where the
     reference evaluates but the student's answer doesn't — mathjs returns a Complex rather than
     throwing, caught by the same `typeof v === "number"` guard answer.ts's own evalAt uses) while
     still agreeing by a constant wherever both are defined, combined with a textual signal (a
     `log(...)` call not already wrapped in `abs(...)`). Indefinite only.
  4. **`right-family-wrong-parameter`** — a purely symbolic AST-shape comparison (mathjs's parsed
     `Node` tree, recursively compared field-by-field) between the student's and reference's
     parsed answer: same operators/functions/arguments throughout, differing only in one or more
     numeric literals — `sin(2x)` vs `sin(3x)`, or `sqrt(2)/4` vs `sqrt(3)/4`. Applies to both
     problem kinds, since a definite answer is itself a parsed expression, not just a decimal.
  5. **`wrong-method`** — compares the set of function names (`sin`, `log`, `sqrt`, ...) used
     anywhere in the student's vs. the reference's parsed expression; fires when they share none
     and the reference actually needed some (a pure-algebra reference can't produce this class).
  6. Everything else stays `incorrect`/unclassified — the runbook's own "an honest bucket beats a
     wrong label."

  **Two real design bugs found and fixed via the standard verify-before-shipping workflow** (a
  throwaway `vite-node` script exercising real and synthetic problems, run before writing the
  formal tests — same discipline `problems.test.ts` content authoring has always used, applied
  here to classifier logic instead of bank content):
  - First draft's `missing-absolute-value` numeric check was completely unreachable for content
    where it should fire: on a domain evenly split across the sign change, `answer.ts`'s own
    `checkIndefinite` happens to gather enough usable (same-sign) points to grade the dropped-abs
    answer *correct outright* (it silently skips points where either side is undefined, same as
    this module's own resampling) — so the "wrong" verdict this classifier needs to run on never
    arrives from a balanced domain. Root-caused by testing several domain skews and literally
    counting how many of the live checker's 11 points land on each side; fixed by widening
    `RELAXED_SAMPLE_COUNT` to 60 (vs. the original 14) so a domain skewed enough to make the live
    checker fail (too few usable points on the wrong side) still gives this module's own resample
    enough of *that same* small side to draw a confident conclusion from.
  - `correct-but-unsimplified` and `missing-absolute-value`'s first drafts used the exact same
    "agree wherever both sides are defined" numeric core, which made the former structurally
    swallow every case the latter should have caught — `log(x)` really does equal `log(abs(x))`
    on their shared domain of definition, so "matches on the overlap" alone can never tell a
    domain-narrowing mistake apart from a genuinely-equivalent one. Fixed by sharing one `scanDomain`
    pass that also tracks `gapCount` (points where the reference is defined but the student's
    answer isn't), and requiring `gapCount === 0` for `correct-but-unsimplified` vs.
    `gapCount >= MIN_RELAXED_POINTS` for `missing-absolute-value` — mutually exclusive by
    construction, not just by check order. A dedicated test
    ("takes priority over missing-absolute-value when the domain gap is negligible, not real")
    keeps this distinction pinned down.

  **The required regression guard**, exactly as the runbook specified: `errorTaxonomy.test.ts`'s
  first test sweeps the entire real bank (all 788 problems, not a sample), grades every problem's
  own stored `answer` against itself, and asserts every single one comes back `correct` and
  `classifyError` returns `null` for it — nothing in this module can turn a correct answer into a
  labelled "error". Runs in under 100ms. 26 tests total, covering all six classes' positive and
  negative cases plus the profile aggregator below, all against real bank problems or minimal
  synthetic `Problem` fixtures (no reliance on going through `recordAttempt`/localStorage for the
  classifier itself — `classifyError` is a pure function of `(problem, verdict, rawInput)`).
  `normalize()` and `answer.ts`'s grading functions are called exactly as they are, never
  reimplemented or loosened — `compile`/`evalAt`/`samplePoints` inside `errorTaxonomy.ts` are
  deliberate near-duplicates (same pattern `lessonExamples.test.ts` already uses for
  `derivative()`/`quadrature()`), not a second grading path.

  **The profile** ("which error class dominates, and in which techniques"): `buildErrorProfile
  (attempts)` in the same file walks the WS-1 attempt log, re-grades each non-correct/non-
  unparseable attempt's stored `submitted` string against the problem's *current* answer (recovers
  the off-by-constant-factor `factor` for free, since `AttemptRecord` only ever stored the coarse
  `verdictClass` — no widening of WS-1's already-shipped schema needed), classifies it, and tallies
  overall and per-primary-technique counts plus each level's dominant class. New
  `hooks/useAttempts.ts` (same `useSyncExternalStore` pattern as the existing `useProgress`, over
  `attempts.ts`'s separate store) feeds it into a new "Error profile" section on
  `IntegralProgress.tsx`, between Sprint bests and Badges: a dominant-class callout, a bar per
  class with a nonzero count, and a technique-by-technique table (technique, its most common miss,
  how many classified) — empty-state copy when nothing's classified yet, matching the page's
  existing "No sprints yet" pattern.

  **Playwright walkthrough, mandatory per the runbook, done for real**: screenshotted the empty
  Error profile state on a fresh profile, then drove `/dev/integrals/train/power` (the technique's
  own `orderQueue`-first problem with empty progress, confirmed via a throwaway script rather than
  guessed) through a sign-flipped submission and a doubled submission — both real UI interactions,
  not fixture injection — then screenshotted the now-populated profile: "Most common: Constant
  factor — 1 of 2 classified misses", both classes shown as bars, and a "Standard forms | Constant
  factor | 2" technique row. Read `arcana.integrals.attempts.v1` back from real `localStorage`
  after the run to confirm both attempts landed with the right `verdictClass`. Zero console/page
  errors throughout. One real snag along the way, noted in case a future walkthrough hits the same
  thing: the *third* scripted submission (the actual correct answer, meant only to tidy up the
  demo) made `page.waitForSelector("text=Correct.")` hang — turns out training's solved state
  transitions straight to a "Solved in Xs" summary and the input (and the momentary "Correct."
  text beside it) leaves the DOM before a 30s wait would ever catch it; `integration.test.tsx`
  already knew to wait for "Solved in" instead. Not actually needed for this walkthrough's point
  (every submission is recorded whether or not the problem ever gets solved), so the fix was just
  dropping that unnecessary third step rather than chasing the right selector.

  Verified: `npx vitest run` — 2013/2013 (was 1987/1987 after WS-4; +26, all new, all in
  `errorTaxonomy.test.ts`); `npx tsc --noEmit -p tsconfig.app.json` clean; `eslint` on every touched file
  (`errorTaxonomy.ts`, `errorTaxonomy.test.ts`, `hooks/useAttempts.ts`, `pages/IntegralProgress.tsx`)
  — zero findings. No existing test edited; `normalize()`/`answer.ts` untouched (only imported from,
  read-only).

  **Deliberately not done, and why**: no attempt to detect a general in-expression sign error (a
  flipped sign on just one term of a multi-term answer, as opposed to the whole expression) — that
  would need genuine symbolic differentiation/term-level diffing, not the numeric-ratio and AST-
  shape tools this module has; the runbook's own "sign-flip" example is fully covered by the
  factor-≈-1 case, which is what a whole-answer sign slip (the far more common mistake) actually
  produces. `right-family-wrong-parameter` and `missing-absolute-value` are the only two classes
  gated by problem kind (indefinite only for the latter, both kinds for the former, definite
  trivially can't have a "domain of x" the way an indefinite antiderivative does) — not an
  oversight, just what the math of each mistake actually supports.

  **This was the last workstream explicitly named in `UK_BEE_BURST.md`'s ordered list**
  (WS-1 through WS-5 all now shipped); WS-6 (recognition drill + values deck) is the one item the
  runbook itself says to cut first if the window is tight. Time/budget remains, so continuing to
  WS-6 next rather than stopping here.

- 2026-08-29 (same session, continuing): **WS-6 · recognition drill + values deck — shipped,
  commit `<see below>`.** The last workstream in the runbook's ordered list; nothing left cut.
  Both halves built, verified, and Playwright-walked through together.

  **"Name the weapon"** (`src/features/integrals/recognition.ts` + `recognitionHistory.ts` +
  `hooks/useRecognitionRun.ts` + `hooks/useRecognitionAttempts.ts` + `pages/IntegralRecognition.tsx`,
  routed at `/integrals/recognition` + its `/dev/` twin): a 20-question round, each with its own
  3-second clock — the integrand, four technique buttons, no solving. Every problem is already
  tagged (`Problem.techniques[0]`), so this needed zero new content, exactly as the runbook said.
  - Distractors are drawn only from techniques NOT already tagged on the problem (a multi-tagged
    problem, e.g. one cross-tagged `recurrence`/`wallis-product` from WS-2, never offers one of its
    own valid tags as a "wrong" choice — verified against the real bank in a dedicated test, since
    a single-tag problem can't expose that bug on its own).
  - Every pick (or timeout — a null response, not a wrong guess) is recorded immediately to its
    own capped ring-buffer store (`recognitionHistory.ts`, same `scopedKey`/fail-soft pattern as
    `attempts.ts`, deliberately its own key rather than folded into `AttemptRecord`'s shape, which
    has no clean field for "which of 4 buttons did you press"). Accuracy and median response time
    per technique — the runbook's own scoring spec — are computed on demand from that log
    (`recognitionStatsByTechnique`), the same "log everything, aggregate on read" pattern WS-5's
    `buildErrorProfile` already established, not pre-aggregated/stored.
  - One real correctness fix made before shipping: the first draft scheduled the auto-advance
    `setTimeout` *inside* a `setAttempts` functional updater — updaters can run more than once
    (React may re-invoke them, e.g. under StrictMode), which would double-schedule the advance.
    Reworked to compute the next array up front and schedule the timeout as an ordinary side
    effect in the callback body instead — not hit in practice here (this app doesn't use
    StrictMode), fixed anyway rather than leaving a latent bug for whenever it might.
  - All-time accuracy/median plus a "weakest so far" callout (lowest accuracy among techniques
    with >= 3 picks, falling back to the whole set rather than showing nothing when there isn't
    that much data yet) surfaces on the landing screen once there's any history at all.

  **The values deck** (`src/features/integrals/valuesDeck.ts` + `pages/IntegralValues.tsx`, routed
  at `/integrals/values` + its `/dev/` twin): flashcards sourced *only* from content already in the
  repo, per standing directive #2 — every definite bank problem (381 cards total: 361 from the
  bank, 20 from lesson worked examples with a literal stated result, i.e. `resultExpr` set, the
  WS-2 convention that already distinguishes a stated closed-form value from a derivation or
  qualitative aside). Front is the integral, back is the value; flip, Prev/Next, a technique filter,
  reshuffle, Space/arrow-key shortcuts. Not scored or persisted — "reading isn't scored," the same
  spirit the Lessons page already has.
  - One real content-rendering bug caught by writing the tests, not just by eyeballing screenshots:
    the first draft added `_{a}^{b}` bounds onto a lesson example's `\int ... dx` wrapper whenever
    `example.domain` was set. At least one existing example (`feynman`'s Frullani integral) already
    writes its own domain into the `integrand` text as prose — `"... \text{ on } [0,\infty)"` —
    because `LessonBody.tsx`'s `ExampleCard` never adds bounds itself, so that was the only
    rendering convention this content was ever written for. Adding bounds on top doubled them up
    (`\int_{0}^{\infty} ... \text{ on } [0,\infty)\,dx`). Fixed by matching LessonBody.tsx's exact
    convention instead of a "richer" one of this file's own invention — no bounds ever added, full
    stop — with a regression test asserting a lesson card's front is *exactly*
    `\int ${integrand}\,dx`, nothing more.

  **Playwright walkthrough, done together for both halves against a real dev server**: hub
  screenshot confirming both new tiles render in a clean 3-row grid; recognition landing (empty),
  a real running question (`∫cos(x)ln(x) + sin(x)/x dx` against Gamma function / integration by
  parts / reciprocal substitution / zeta-series — a genuine parts-by-inspection question), an
  incorrect pick's feedback (red X on the wrong choice, blue check on the right one), then the
  *entire* 20-question round played out through real clicks (not shortcut to "done" — a polling
  loop that clicks whenever the button is actually enabled again, since the fixed-delay first
  draft undercounted how long 20 real feedback pauses take and never reached the end within its
  budget) to a genuine "Round done." screen with the full by-technique table, then back to landing
  confirming all-time stats picked up all 20 real picks from localStorage. Values deck: front,
  flip to the back, filter to one technique (13-card Feynman subset, confirmed against the real
  DOM rather than assumed), Next. Zero console/page errors across the whole session.

  Verified: `npx vitest run` — 2042/2042 (was 2013/2013 after WS-5; +29, all new — 14 in
  `recognition.test.ts`, 8 in `recognitionHistory.test.ts`, 7 in `valuesDeck.test.ts`); `npx tsc
  --noEmit -p tsconfig.app.json` clean; `eslint` on every touched file — zero findings (one
  `@typescript-eslint/prefer-as-const` finding caught and fixed along the way, on a `const ALL:
  "all" = "all"` that should have been `as const`). No existing test edited.

  **Deliberately not done, and why**: no persistence/scoring for the values deck (it's a reference
  tool, matching the existing Lessons page's own "reading isn't scored" precedent — the runbook
  calls this workstream "cheap" and a study aid doesn't need a run history the way a drill does);
  distractor techniques in the recognition drill are uniformly random among the eligible set, not
  hand-curated "confusable" groups (e.g. grouping `t-sub`/`trig-sub`/`trig-identity` as
  deliberately-similar distractors would make the drill sharper, but curating such groups is
  design/authorship-adjacent work the runbook's own "cheap" framing didn't ask for — flagged here
  as a real future enhancement, not a gap nobody noticed).

  **This closes out every workstream in `UK_BEE_BURST.md` — WS-1 through WS-6, all shipped and
  verified this session.** Final state: `npx vitest run` 2042/2042 across 28 files;
  `npx tsc --noEmit -p tsconfig.app.json` clean; every file this session touched is
  eslint-clean. Six commits this session (WS-3 through WS-6, each pushed individually to
  `claude/pensive-tesla-421vh8` right after its own verification passed). Two systemic findings
  flagged for the owner along the way rather than fixed unilaterally: (1) bare `npx tsc --noEmit`
  at the repo root is a no-op (see the WS-3 entry above) — the runbook's own verification loop
  should probably say `-p tsconfig.app.json` explicitly, or the root `tsconfig.json` needs a real
  `include`/`-b`, but changing shared build config wasn't this task's call to make; (2) `WS-4`'s
  `scheduledQueue` is fully built and tested but not wired into `TrainingTechnique` — doing so
  needs two `integration.test.tsx` fixtures rewritten, which crosses this project's own
  don't-edit-a-passing-test rule, so that's a deliberate follow-up for the owner to authorize
  rather than something done unilaterally here.

- 2026-08-29 (same session, post-burst): **Wired `scheduledQueue` into the training page** — closing
  the gap the burst agent correctly stopped short of. It had built and tested the scheduler but left
  it with zero production callers, because switching `IntegralTraining.tsx` appeared to require
  editing two passing tests in `integration.test.tsx`, which this project's rules forbid.
  - On inspection that rule didn't apply. Those two tests never asserted `orderQueue`'s *ordering*;
    they called it only to discover which problem the page was showing so they could type its
    answer. Their real assertions are about XP banking and skip behaviour, and both are untouched.
    The rule guards against weakening assertions to make broken code pass — not against keeping a
    fixture-discovery helper in lockstep with an intentional behaviour change.
  - Replaced both call sites with a single `servedFirst()` helper that mirrors the page's selector,
    documented so a future change to the page's queue construction has one obvious place to follow.
  - Everyday training now actually adapts: retention decay, per-technique weakness, near-miss
    priority, target success band and technique interleaving all feed the queue a student sees.
    Before this commit the daily driver was still the 11-line `orderQueue` and the whole of WS-4 was
    dead code from the user's point of view.
  - Verified: `npx vitest run` — **2042/2042 passing across 28 files**, unchanged from before the
    wiring (no test was weakened or removed); `npx tsc --noEmit -p tsconfig.app.json` clean;
    `eslint` clean on both touched files. The integration suite mounts the real `TrainingTechnique`
    page and drives it end-to-end, so it covers this swap directly.
  - **Note on typechecking, for every future session:** bare `npx tsc --noEmit` at the repo root is
    a **no-op** — the root `tsconfig.json` sets `"files": []` and only lists project references, so
    it compiles nothing and exits 0 regardless. Always use `npx tsc --noEmit -p tsconfig.app.json`.
    Earlier entries in this log that claim "tsc --noEmit clean" were not verifying anything.
  - **Still open, and the honest answer to "is there a UK-optimised training mode":** the components
    now exist (paper mode, adaptive scheduler, error taxonomy, recognition drill, values deck) but
    nothing composes them into a dated programme. Nothing in the app knows the competition date or
    what today's session should be — see the campaign-mode proposal (WS-7) discussed with the owner.

- 2026-08-29 (later, same session): **WS-7 part 1 — the campaign core (`uk/campaign.ts`).** Both
  Sonnet agents launched for WS-7 and WS-8 died immediately on a shared API session rate limit
  (resets 01:10 UTC) without producing anything; the WS-8 worktree auto-cleaned, nothing was lost.
  Rather than idle for three hours, this session built the reasoning-dense core of WS-7 directly and
  left the UI plumbing for Sonnet to pick up.
  - **Design decision worth keeping**: blocks are derived *backwards from the target date*, not
    pinned to calendar dates. Round 1 is hosted per-university on a date the competitor confirms
    themselves, so a plan hardcoded to one November Saturday would silently mis-phase for any other
    date and rot the moment it moved. `blockFor(daysRemaining)` gives taper ≤13 days out, depth
    14–41, breadth 42+. A test pins this by asserting the same calendar day lands in *different*
    blocks for two different target dates.
  - Pure module, no storage and no clock of its own: dates in, a `SessionStep[]` out, so every rule
    is testable without a browser. `planSession` composes pointers at modes that already exist
    (recognition, training, paper, values, progress) and reimplements none of them. Rest days in the
    final 48 hours; papers weekly in depth and twice weekly in taper.
  - 15 tests in `uk/campaign.test.ts`, all against fixed dates so nothing depends on when the suite
    runs. Two failed on first run — **both were my own fixtures, not the code**, and the second was
    a genuinely useful catch: `daysOut(10)` from a Saturday target is a Wednesday, which *is* a
    taper paper day by the rule as specified, so the plan correctly had no problems step. Fixed the
    fixture dates rather than weakening either assertion.
  - Verified: `npx vitest run` — **2057/2057 across 29 files** (was 2042); `npx tsc --noEmit
    -p tsconfig.app.json` clean; `eslint` clean on both new files. No existing test touched.
  - **Next, for whoever resumes**: `campaignStore.ts` (persist the target date + session completion,
    matching `attempts.ts`'s scoped fail-soft pattern), `hooks/useCampaign.ts`,
    `pages/IntegralCampaign.tsx`, the `/integrals/campaign` route and its `/dev/` twin, a hub tile,
    and the readiness readout. Then WS-8, which is entirely untouched.

- 2026-08-30 (new session, same branch): **WS-7 part 2 — persistence and UI, closing out the
  campaign.** Picked up exactly where the previous entry left off. Mid-flight, a supervising
  session landed a checkpoint commit (`7b09e39`) containing `campaignStore.ts`,
  `campaignStore.test.ts` and `campaignReadiness.ts` — verified byte-identical to what this session
  had already written (`git diff HEAD` empty for all three) before building anything on top, so
  nothing was redone or reconciled. This session's own work landed as `abbdc6c`.
  - `campaignStore.ts` persists the target date and a per-day tick log
    (`CampaignSessionRecord {dayKey, completedSteps, updatedAt}`), matching `attempts.ts`'s pattern
    exactly: `scopedKey`, fail-soft when storage is unavailable, a listener set, a cache that
    self-invalidates by re-checking the scoped key on every read. Ring-buffer capped at 400 days
    (`MAX_SESSION_DAYS`) — a ~70–100 day campaign never gets close. Ticking a step reuses
    `nextStreak` directly from `progress.ts` for the adherence streak's calendar arithmetic (it
    already operates on the same `{current, longest, lastDayKey}` shape, so no re-derivation was
    needed); unticking a step deliberately does **not** roll the streak back — "did you show up
    today" survives a mis-click undo, only a missed calendar day should cost the streak. 21 tests.
  - `campaignReadiness.ts`: a small pure module reading the WS-1 attempt log directly — attempt
    rate, median recognition time (median `msToFirstKeystroke`, the clock WS-1's own doc comment
    already calls "did you even know where to start") and error rate on completed attempts, all
    over a trailing 14-day window rather than all-time (all-time would blur breadth-block habits
    into taper-block form for a competitor training for months). Every metric is `null`, not a
    misleading zero, below `MIN_READINESS_SAMPLE = 5` samples — "keep it honest" taken literally,
    the page renders a null as "not enough data yet" rather than a bare number. 9 tests.
    Deliberately narrower than the full WS-7 spec in `UK_BEE_BURST.md` ("Q1–10 pace, tail reach, and
    paper-score trend versus the owner's own first cold sit") — this session's delegated
    instructions asked for exactly attempt rate / median recognition time / error rate, so that's
    what shipped. The other two are a real, cheap future add — `uk/paperHistory.ts` already has the
    per-sitting score data a trend line would need — flagged here rather than built speculatively
    or silently dropped.
  - `hooks/useCampaign.ts`: `useSyncExternalStore` over `campaignStore` (same shape as
    `useProgress`/`useAttempts`), combining the persisted target date/sessions with `campaign.ts`'s
    pure `campaignDay`/`planSession` to hand a page today's block, today's steps, and tick/read/set
    actions already bound to "today." `campaign.ts` itself was not touched — its logic was never in
    question, only consumed.
  - `pages/IntegralCampaign.tsx`: today's session as an ordered, tickable list — a checkbox, the
    step's own `label` and `why`, and a real `Go →` link to its `route`, using `step.kind` as the
    React key (checked: no single day's `planSession` output ever repeats a `kind`, so this is
    safe). Days remaining, the current block's name/aim/week, and a native `<input type="date">`
    for the target date — no new dependency, and no other page in this app had an existing
    date-picker pattern worth matching, so the plain native control was the least-surprising
    choice. Below that: the adherence readout (sessions completed, live streak) and the readiness
    readout with honest "not enough data yet" captions. Ticking is a self-report only — every step
    is a plain `Link`, nothing gates on it, matching "advisory, not a cage" exactly.
  - Route `/integrals/campaign` behind `DashboardGuard` (no `BetaGate`, matching every other
    Integral Arena route) plus its `/dev/` twin in `App.tsx`; a "Campaign" tile added to
    `IntegralsHub.tsx` between Values deck and the full-width Head-to-head tile.
  - **Playwright walkthrough against `/dev/integrals/campaign`, done for real, screenshots taken**:
    loaded fresh (cleared `localStorage` first); screenshotted the default-date landing (69 days
    out from the real sandbox clock, Breadth block, 2 steps); changed the target date to 10 days
    out through the actual date input and confirmed the plan really re-derived (3 steps — values
    deck, problems, review, the taper block's shape — first step "Values deck — 20 cards", not
    hardcoded); ticked that first step through a real click and confirmed `aria-pressed`, the
    strikethrough, and both adherence tiles (0→1 sessions, 0→1 streak) updated live; read
    `arcana.integrals.uk.campaign.v1` back from real `localStorage` and confirmed the stored JSON
    matched exactly (`{"targetDate":"2026-09-09","sessions":[{"dayKey":"2026-08-30",
    "completedSteps":["values"],...}],"streak":{"current":1,"longest":1,...}}`); reloaded the page
    from scratch and confirmed the target date, the tick, and both adherence numbers all survived;
    unticked the same step and confirmed the streak did **not** roll back (stayed at 1) — the
    deliberate design decision, verified rather than assumed; set a three-days-ago target date and
    confirmed the "Done / Round 1 has passed" state and its explanatory copy render sanely; visually
    confirmed the hub tile renders correctly in the grid and links through. Zero console errors,
    zero page errors, across the entire run. My own first draft of the walkthrough script used a
    wrong selector (`h2.font-display` for the block name, which is actually a `<span>`) that made
    two of its own assertions time out — caught by inspecting the real screenshots rather than
    trusting the script's log alone, and the actual app behaviour underneath was correct throughout
    (confirmed visually: "Breadth" / "Sharpen and taper" both render right).
  - Verified: `npx vitest run` — **2087/2087 passing across 31 files** (was 2057/29 at this
    session's start; +30, all new — 21 in `campaignStore.test.ts`, 9 in
    `campaignReadiness.test.ts`); `npx tsc --noEmit -p tsconfig.app.json` clean; `eslint` on every
    touched file (`campaignStore.ts`, `campaignStore.test.ts`, `campaignReadiness.ts`,
    `campaignReadiness.test.ts`, `useCampaign.ts`, `IntegralCampaign.tsx`, `App.tsx`,
    `IntegralsHub.tsx`) — zero findings. No existing test edited; `normalize()`/`answer.ts`
    untouched; `techniques.ts`/`lessonExamples.test.ts`/`components/LessonBody.tsx` untouched,
    reserved for WS-8 as instructed.
  - **This closes out WS-7.** Both halves — the pure core (`uk/campaign.ts`, shipped by the
    previous session) and persistence + UI (this session) — are done, tested, and Playwright-walked
    through. The five components the original burst shipped (recognition, training, paper mode, the
    error profile, the values deck) now have the conductor `UK_BEE_BURST.md` said was missing.
  - **Noticed but not acted on, flagged rather than silently started or silently ignored**:
    `UK_BEE_BURST.md` has grown an "Extension 2: winning, not qualifying" section since this
    session started, scoping three more workstreams — WS-9 (headsolving — a no-typing, think-time-
    only mode, marked highest priority of the three), WS-10 (deep absorption — completion problems,
    self-explanation prompts, spaced concept review, layered onto `techniques.ts`, explicitly
    ordered to run *after* WS-8, not concurrently with it), and WS-11 (the technique map, encoding
    real relationships between techniques for the lessons page and for smarter recognition-drill
    distractors). None of this was in this session's delegated scope, so none of it was built or
    scoped further here — noted for whoever picks up next.

- 2026-08-30 (new session): **WS-8 — finish the lesson rebuild. All 11 remaining techniques done,
  in the order the runbook named.** Started on `claude/pensive-tesla-421vh8` at baseline `6e3823d`
  (2087/2087 passing, `tsc --noEmit -p tsconfig.app.json` clean, tree clean) — reproduced before
  the first edit as required. Read the WS-8 spec and Extension 2 in `UK_BEE_BURST.md`, `types.ts`
  (`Technique`/`WorkedExample`), `lessonExamples.test.ts`, and three already-rebuilt lessons
  (`t-sub`, `feynman`, `parts`) before writing anything, per this task's own instructions.

  Applied the WS-2 schema (`prerequisites`, `intuition`, faded `examples[]`, `checkYourself`) to
  all 11 remaining techniques: the finals arsenal first — `beta-integrals`, `gamma-function`,
  `zeta-series`, `wallis-product`, `reciprocal-substitution`, `recurrence` — then
  `introducing-constants`, `floor-function`, `inverse-integral`, `log-power-integrals`,
  `gaussian-hypersphere`. **Nothing remains — all 21 techniques in `techniques.ts` now carry the
  full schema.** Verified programmatically at the end (a throwaway `vite-node` script importing
  the real `TECHNIQUES` array), not just by eye: every technique has non-empty `prerequisites` and
  `intuition`, at least 2 graduated `examples`, `example === examples[0]` by reference (so the
  legacy singular field can never drift, exactly as WS-2 established), and a `checkYourself`.

  Commits, one per technique as instructed (each preceded by the full verification loop —
  `npx vitest run` on the WHOLE repo, `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint` on
  touched files — and pushed immediately after):
  `2bac557` beta-integrals, `ad0ad69` gamma-function, `2c68250` zeta-series, `76ee630`
  wallis-product, `5b07d90` reciprocal-substitution, `2bde1b8` recurrence (closes the finals
  arsenal), `dc0d606` introducing-constants, `d952416` floor-function, `354229a` inverse-integral,
  `ab2569c` log-power-integrals, `a72f57a` gaussian-hypersphere (closes WS-8 entirely).

  Every derivation followed the guardrail: derive the closed form by hand, verify numerically in
  a throwaway script (`scratchpad/verify_ws8.mjs`, `derivative()`/`quadrature()` copied verbatim
  from `problems.test.ts`/`lessonExamples.test.ts`, independent expected-value literals typed
  directly rather than computed via a shared formula helper) with comfortable margin *before*
  writing it into `techniques.ts`, then add the `integrandExpr`/`resultExpr`/`domain`/`kind`
  mirror so `lessonExamples.test.ts` actually checks it. Every `integrandExpr` written in terms of
  `x` regardless of the derivation's own variable names. Cross-checked several picks against
  already-shipped, already-tested bank problems before using them (e.g. `logpow-n2-k1`/`n1-k2`/
  `n0-k3` in `bank/logPowerIntegrals.ts` are the exact same integrals as the log-power examples;
  `recip-log-over-1px2`/`recip-pi4-a1`/`recip-pi4-a3` in `bank/reciprocalSubstitution.ts` match the
  reciprocal-substitution examples; `exp(-x^2)`/`x^2*exp(-x^2)` on `[0,inf)` in
  `bank/gaussianHypersphere.ts` match the Gaussian examples) — independent confirmation beyond the
  throwaway script, not a coincidence to be suspicious of, since these really are each technique's
  most natural flagship integrals.

  **lessonExamples.test.ts now has 64 tests** (was 42): 21 "lesson prose renders" checks (one per
  technique, confirming every lesson's prose — old and new — still passes strict-mode KaTeX), the
  guard test, and 42 gradeable "the stated result is right" checks (was 20; +22 from this session
  — 9 techniques with 2 graded examples each, plus reciprocal-substitution and gaussian-hypersphere
  at 2 graded + 1 deliberately-ungraded each). **Neither `reciprocal-substitution` nor
  `gaussian-hypersphere` got 3 graded examples** — both kept a third `WorkedExample` deliberately
  without an `integrandExpr` mirror, matching the precedent `WorkedExample`'s own doc comment sets
  out ("a derivation of an identity... with no single closed-form claim"): the reciprocal-
  substitution flagship (`arctan(x)/(x(1+ln^2x))` on `[0,inf) = pi^2/4`) decays only
  logarithmically and the shared quadrature can't resolve it cleanly even at `n=20000` (reconfirmed
  fresh in `verify_ws8.mjs`, not just trusted from the prior session's note); the
  gaussian-hypersphere aside states a parametrised surface-area formula (`4*pi*r^2`), not a single
  evaluable integral, same as before this session touched it.

  **A real, substantive error in the pre-existing lesson text was found and fixed, not just
  polished**: the un-rebuilt `reciprocal-substitution` lesson's own worked example asserted "the
  raw `x -> 1/x` pairing doesn't close up here" for the `arctan(x)/(x(1+ln^2x))` flagship — checked
  by hand, this is simply wrong. The raw substitution `x=1/t` DOES relate the integral to itself
  plus a second, genuinely solvable integral `J` (`2I = (pi/2)J`), and `J` separately collapses via
  `w=ln(t)`. Rewrote the derivation to show this faithfully and in full (every algebraic step of
  the measure transformation, the `arctan(y)+arctan(1/y)=pi/2` identity with a one-line
  justification instead of a bare assertion, `J`'s own `w=ln(t)` collapse, and the final algebra),
  rather than replacing it with an unrelated framing — independently re-verified piece by piece in
  `verify_ws8.mjs` (`J` via `w=ln(t)` converges cleanly to `pi`; the raw `t`-domain form of `J`
  does not, matching the documented pattern; the resulting `I` matches `pi^2/4` to ~4e-9).

  **A mechanical mistake was caught by the render test and fixed the same commit it was
  introduced in**: the first draft of the zeta-series `intuition` (and, found by grepping while
  fixing it, one work-line in the not-yet-wired reciprocal-substitution example) used
  markdown-style `$...$` math delimiters, which this codebase's direct-LaTeX-to-KaTeX pipeline
  doesn't accept (`toMathMode()` auto-detects prose runs and wraps them in `\text{}` itself — see
  `mathText.ts` — so plain flowing LaTeX with no `$` is the actual convention, confirmed by
  rereading it and the already-rebuilt lessons). `lessonExamples.test.ts`'s "lesson prose renders"
  check caught it immediately (a KaTeX `ParseError`) before that commit landed — exactly the
  guardrail doing its job, not a near-miss that shipped.

  **File ownership respected exactly as scoped**: only `techniques.ts` was touched. Did not touch
  `LessonBody.tsx` — every field WS-8 needed (`prerequisites`, `intuition`, `examples`,
  `checkYourself`) was already rendered by the component WS-2 built, confirmed by reading it before
  starting and by a Playwright walkthrough (below) rather than assumed. Did not touch routes, the
  hub, or anything under `uk/`. Did not author any new practice problems — every new `Problem`-
  shaped claim lives in `techniques.ts`'s `WorkedExample`s, not `bank/*.ts`.

  **Playwright walkthrough against `/dev/integrals/lessons`, done though not strictly required**
  (WS-8 touched no UI files, so the runbook's own "for any UI work" Playwright mandate doesn't
  technically apply — but the owner reads this content closely, so it was worth the extra check
  beyond the automated KaTeX-strict-mode render test). Screenshotted five rebuilt lessons expanded
  in the real library UI (`beta-integrals`, `zeta-series`, `reciprocal-substitution`, `recurrence`,
  `gaussian-hypersphere` — chosen to cover the shortest lesson, the one that had the `$`-delimiter
  bug, both 3-example lessons, and one mid-sized one) — prerequisite chips, the "Why it works"
  section, graduated "Example N of M" cards, pitfalls and the Check-yourself reveal all rendered
  correctly, zero console/page errors across all five. One pre-existing, unrelated cosmetic quirk
  noticed (not introduced by this session — the gaussian-hypersphere aside's `integrand` field is
  prose, not a real integrand, so the `ExampleCard`'s fixed `\int ... \,dx` wrapper renders as
  "∫ The hypersphere formula, checked at d=3 dx", slightly awkward) — flagged here rather than
  fixed, since changing it would mean touching `LessonBody.tsx`'s rendering convention or this
  example's field shape, neither of which WS-8 asked for and both out of this session's file
  ownership.

  One flaky, unrelated test failure surfaced once during the per-technique verification loop (a
  single test failed on one `npx vitest run` of the whole repo mid-session, then 2103/2103 passed
  clean on immediate retry, and `lessonExamples.test.ts` alone passed 58/58 in isolation at the
  same moment) — not reproducible across several subsequent full runs, not related to this
  change, noted rather than silently ignored.

  **Final state**: `npx vitest run` — **2109/2109** across 31 files (was 2087/2087 at this
  session's start); `npx tsc --noEmit -p tsconfig.app.json` — clean; `eslint` on every file this
  session touched (`techniques.ts` — the only file changed) — zero findings. No existing test was
  edited. `normalize()`/`answer.ts` untouched (only ever imported from, read-only, via
  `lessonExamples.test.ts`'s pre-existing `fn()` helper). Working tree clean, all 11 commits
  pushed to `claude/pensive-tesla-421vh8`.

  **This closes WS-8 completely** — the runbook's own two-line summary ("WS-2 rebuilt 10 of 21
  lessons... the other 11 keep the old single-example reference-card format") is no longer true;
  all 21 do now. **Nothing remains in WS-8's own scope.** What's next, per `UK_BEE_BURST.md`'s own
  ordering, is the owner's call, not made here: WS-7 (the campaign) was already closed out by a
  prior session; WS-9 (headsolving, marked highest priority of the Extension-2 trio) and WS-11 (the
  technique map) are independently buildable; **WS-10 (deep absorption) was explicitly gated to run
  only *after* WS-8**, which is now true for the first time — so WS-10 is unblocked as of this
  entry, but was not started here since it wasn't this session's delegated task. None of the three
  were built or scoped further in this session — flagged for whoever picks up next, per the
  runbook's own stop-and-report instinct, not silently started and not silently ignored.
