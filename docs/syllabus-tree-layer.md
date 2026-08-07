# The Syllabus Tree Layer

**Status:** design agreed and implemented 2026-08-07, not yet deployed (see §10).
**Companion docs:** `lesson-plan-layer.md` (the layer directly below this one), `knowledge-tracker-framework.md`,
project CLAUDE.md.

---

## 1. The problem this solves

Until this layer, every signup generated its own topic/subtopic tree at runtime. `OnboardingPage.tsx`
ran a client-side multi-pass build: `jarvis-director` produced a draft track, `buildFullTrack`
re-derived an exhaustive topic skeleton and expanded each topic into subtopics in parallel batches,
and — only if that multi-pass failed — `refineTrackGrain` re-split the director's own draft. All three
called `chat` via `chatJSON`, a one-shot JSON round-trip through the already-deployed `chat` function
using `systemOverride` to bypass teaching mode.

Three measurable consequences, all of which that design produced:

1. **Syllabus coverage is a fresh gamble per student.** There is no fixed artifact that says what the
   AQA A-Level Physics syllabus *is* — each signup re-derives it from scratch, at the mercy of that
   one call's variance. This is exactly what makes the project's standing "system-wide coverage,
   verified by breadth sweep" bar unverifiable: there is nothing durable to sweep. Auditing one
   student's track tells you nothing about the next student's, even if they typed the same goal.

2. **It quietly defeats the lesson plan cache underneath it.** `lesson_plans` is keyed on the subtopic
   *string* (see `lesson-plan-layer.md` §4). Every student who reaches `buildFullTrack` invents their
   own subtopic titles for the same real material — "Argand diagrams: plotting a complex number" vs.
   "Plotting complex numbers on an Argand diagram" — so those keys diverge and the plan cache barely
   hits. The lesson plan layer's economics (author once, serve to everyone) only work if the thing
   feeding it produces the same key twice, and today it doesn't.

3. **Every signup pays full generation cost.** A skeleton call plus up to 15 parallel expansion batches
   (for a JEE-scale goal), on the client, on every single onboarding — even though two students both
   doing AQA A-Level Physics are asking for the literal same artifact.

The missing layer is one level above the lesson plan: **there is no fixed syllabus, only a fresh
improvisation of one per student.**

## 2. The architecture

> Author the hard, quality-critical artifact **once at frontier quality**; cache it globally;
> onboarding only needs to look it up.

This is the same move as the lesson plan layer, one level up — and it is what makes that layer
actually pay off:

```
onboarding goal  →  subject / level / board
                          │
                          ▼
                 ┌──────────────────┐
                 │ author-syllabus- │   ONE expensive multi-pass call, per syllabus, EVER
                 │ tree (cached)    │   shared across every student, globally
                 └──────────────────┘
                          │  syllabus_trees row (jsonb topics + coverage)
                          ▼
                 track instantiation
              (topics + subtopics COPIED
               into learning_tracks/topics/subtopics)
                          │
                          ▼
              student studies subtopic "X"
                          │
                          ▼
              author-lesson-plan keyed on subtopic string "X"
        ── now the SAME "X" for every student on this syllabus ──
                  lesson_plans cache starts concentrating
```

Fixing the tree fixes the keys one layer down. Before this layer, `lesson_plans` had a combinatorial
number of near-duplicate keys (one set per student's own subtopic phrasing) and hit rate stayed near
zero no matter how many students studied AQA Physics. After this layer, every student on the same
signature walks through the same fixed subtopic strings, so the second student to reach any given
subtopic is a `lesson_plans` cache hit. This layer's payoff is therefore partly measured downstream, in
the lesson plan layer's hit rate, not only in onboarding latency.

## 3. THE GATE: CACHEABLE ⟺ VERIFIABLE

**This is the load-bearing design constraint — give it its own section, because it is easy to get
wrong in the "obviously just cache everything" direction.**

A tree is written to the global cache only when the identity names a real, externally-defined
syllabus: subject **and** level **and** board are all present (`hasCanonicalIdentity` in
`syllabusTree.ts`). This is a correctness threshold, not a convenience one.

A globally-shared tree is only *right* when there is an external definition to check it against. Two
students who both say "physics at university" may mean wildly different courses — different
institutions, different years, different optional modules. Serving one of their trees to the other is
not a rough approximation, it is a **silent, permanent wrong answer**: that student's track now claims
a syllabus they never asked for, and nothing in the product surfaces the mismatch.

Bespoke goals still get a full tree, authored the same way, through the same code path
(`author-syllabus-tree` doesn't branch on canonicity until the very end). It is simply not written to
`syllabus_trees` — it stays private to the student who asked for it.

The elegant consequence, worth stating explicitly: **the cache gate and the verification gate are the
same gate.** A named board is exactly the condition under which `resolveOfficialSpec` has something
real to fetch, so "may this be shared" and "can this be checked" collapse into one boolean
(`hasCanonicalIdentity`), computed once, at the top of the handler.

## 4. Cache key

```
signature = sha256( normalize(subject) | normalize(level) | normalize(board) )
normalize(s) = lowercase, collapse whitespace, strip punctuation, trim
```

Deliberately **not** keyed on the student's freeform goal text or the track title. Those vary endlessly
for what is the same syllabus — "A* in A-level further maths" and "help me smash Edexcel FM" are the
same tree — and keying on them would fragment the cache into single-use rows, which is the exact
failure this layer exists to fix (§1.1). `subject`/`level`/`board` are the stable, extracted identity;
the goal text is only ever used as *input* to authoring (it seeds spec resolution — see
`identityLine` in `author-syllabus-tree/index.ts`), never as part of the key.

This differs from `lesson_plans` in one important way. There, board normalizes to `""` when unknown so
unbranded tracks still share a plan (`lesson-plan-layer.md` §4). Here, an unknown board does **not**
normalize into a shared row — `hasCanonicalIdentity` requires board to be non-empty, full stop. The
asymmetry is intentional: a lesson plan without a board is still checkable against the subject/level's
general treatment of a subtopic, and worst case is a slightly generic plan. A syllabus tree without a
board has no spec to be checked against at all, so serving it globally would be pure guesswork
presented as authority — the worse of the two failure modes.

## 5. Schema

### `SyllabusTree` (`supabase/functions/_shared/syllabusTree.ts`)

```ts
type SyllabusTopic = { title: string; subtopics: string[] };

type SyllabusCoverage = {
  verdict: "grounded" | "unverified";
  source_url?: string;
  missing?: string[];
};

type SyllabusTree = { topics: SyllabusTopic[]; coverage: SyllabusCoverage };
```

`subtopics` is deliberately just `string[]`, not richer objects — the tree's whole job is naming the
session-grain decomposition; everything about *how* to teach a given subtopic belongs one layer down,
in the lesson plan keyed on that string. `SyllabusCoverage` is covered in §6.

### `syllabus_trees` table (`20260807120000_syllabus_trees.sql`)

One row per `(signature, tree_version)`, holding the validated tree, its coverage record, and
denormalized `subject`/`level`/`board` columns kept purely so a human can inspect the cache without
reversing a hash — the lookup itself only ever uses `signature`.

`UNIQUE (signature, tree_version)`, not `UNIQUE (signature)`. Keying uniqueness on the pair means
bumping `tree_version` (via `SYLLABUS_TREE_VERSION`) inserts a *new* row beside the old one rather than
overwriting it. This is deliberate: a tree is the artifact the whole coverage claim rests on, and a few
extra KB of superseded JSON is a small price for being able to diff a regenerated syllabus against the
one it replaced, or roll back if a prompt change regresses quality. `lesson_plans` makes the identical
choice for the identical reason.

RLS: any authenticated user may `SELECT` (shared, non-personal content, same shape as `lesson_plans`
and the global `concepts` registry). There is no user-level write policy at all — authoring is a
service-role write from the edge function, which bypasses RLS. A client that could write here could
replace the syllabus served to every future student on that goal.

### `learning_tracks.syllabus_tree_id`

Nullable, `ON DELETE SET NULL`, and **not** read on any hot path. A track is a *copy* of the tree's
topics/subtopics at instantiation time (inserted row-by-row into `topics`/`subtopics`), not a live view
of the cached tree. This means a student's track never silently changes under them when the tree is
later re-authored or corrected — instantiation is a one-time snapshot, not a join. The column exists
purely for **provenance**: which cached tree produced this track, so a coverage complaint can be traced
back to the exact row that generated it, and so a future "your syllabus has an update available" prompt
has something to diff against. Existing tracks (generated before this layer existed) keep `NULL`, which
correctly reads as "no tree, pre-dates this layer" rather than an error.

## 6. Verification (the coverage record)

This is what makes global caching *safe* rather than merely *fast*.

Caching multiplies quality in **both** directions. A great tree, cached, benefits every future student
on that goal for free. An incomplete tree, cached, **silently truncates the syllabus for every future
student on that goal** — and unlike the per-student gamble in §1, this failure is now durable and
invisible, because nothing else in the product knows the tree is short. Structural validation
(`validateSyllabusTree` — well-formed JSON, non-empty subtopics, sane caps) cannot catch this class of
bug at all: a tree can be perfectly well-formed and still be missing an entire spec section.

So, after the skeleton and expansion passes assemble a tree, `verifyAndRepair` in
`author-syllabus-tree/index.ts` runs one more step:

1. **Audit.** The assembled tree is summarized and checked against the spec excerpt
   `resolveOfficialSpec` resolved for this identity (the same spec-grounding machinery
   `jarvis-director` already uses). The audit prompt's one job is to name spec areas the tree does not
   cover anywhere, judging by meaning not wording, and explicitly told an empty result is the expected
   common case — not something to strain for gaps to justify.
2. **Repair, once.** Whatever the audit reports missing is folded back in — assigned to an existing
   topic where it fits, or given a new topic if it genuinely doesn't. This is deliberately **one pass,
   not a loop**: repeated audit→repair cycles converge slowly and burn authoring budget (more model
   calls, more latency) on diminishing returns for what should already be a near-complete tree by this
   point.
3. **Record, don't assert.** The result — `grounded` or `unverified`, the spec's `source_url`, and any
   still-`missing` areas — is stored as *data* in the `coverage` column, not folded into a system
   prompt and hoped for. Only `grounded` trees are ever written to the cache (§3); an `unverified` tree
   is still returned and used for that one student, just never shared.

**The pessimistic-reading decision**, worth calling out because it's easy to get backwards: the repair
pass is **not re-audited**. So `coverage.missing` records the gaps the *audit* found, not the gaps that
survived repair — and if the repair pass added nothing (a malformed or empty repair response), the
verdict is downgraded from `grounded` to `unverified` even though an audit did run. The reasoning:
without re-auditing, there is no way to *know* the repair actually closed the gaps, only that an
attempt was made. It is better for the coverage record to understate confidence than for a cached tree
to claim a completeness nobody actually checked.

## 7. Graceful degradation

`author-syllabus-tree` must **never fail closed.** Contrast this explicitly with `author-lesson-plan`,
which *does* fail closed on a cache-unavailable path (`lesson-plan-layer.md` §7) — because a
plan-less session there just falls back to today's live-improvised teaching, which is a real, working
product state. There is no equivalent fallback here: a student with no track has no product at all.
Onboarding cannot degrade to "no syllabus."

Concretely: spec resolution failing, the audit call failing, the repair call failing, or the identity
being non-canonical are all handled by narrowing what gets *cached*, never by refusing to return a
tree. The only hard failures in the handler are "the skeleton pass produced fewer than 3 topics" and
"fewer than 60% of topics expanded" — both meaning the tree itself is unusably thin, not that it
couldn't be verified or shared.

## 8. Verification bar

Per the project's standing quality bar, this ships only after a breadth sweep, not a demo:

- author trees across GCSE → A-Level → undergraduate, in **both** maths and physics, across several
  boards (AQA, Edexcel, OCR, IB, at minimum);
- deliberately awkward identities: a bespoke non-board goal ("help me understand quantum field
  theory") that must come back `unverified` and **must not** appear in `syllabus_trees` afterward; a
  named board whose spec fails to resolve (confirm it still returns a usable, honestly-`unverified`
  tree rather than erroring); a huge multi-subject exam like JEE (confirm the 40-60 topic ceiling is
  actually being used, not silently truncating);
- check that topic counts are plausible for the level (a focused module should not come back with 50
  topics, a full JEE-scale goal should not come back with 12);
- check that subtopics are genuinely session-grain by reading a sample, not just counting them — a
  subtopic list can satisfy every structural check and still bundle several sittings' worth of material
  under one title;
- confirm no row in `syllabus_trees` claims `coverage.verdict = "grounded"` without a `source_url` —
  that combination should be structurally impossible given §6, but it's the single check that would
  catch a regression in the gate itself.

## 9. Known follow-ups (deliberately not in this pass)

1. **Coverage is only ever audited against the resolved spec *excerpt*, which is truncated.** So
   `grounded` means "consistent with what we could fetch," not "complete against the full published
   spec" — a real gap could sit past the point the excerpt was cut off, and the audit prompt is
   explicitly told not to infer anything about content beyond the truncation, so it cannot catch that.
   The project already hit this exact excerpt-coverage gap in the spec-checklist feature and solved it
   there with **per-topic** spec resolution instead of one whole-syllabus excerpt — resolving a
   focused spec slice per topic rather than one excerpt for the entire tree. That is the natural fix
   here too, and would very likely raise the true (not claimed) completeness of `grounded` trees.
2. **No re-audit after repair** (§6). The coverage record is deliberately pessimistic to compensate,
   but an actual re-audit would let more trees legitimately earn `grounded` instead of falling back to
   `unverified` after a repair that in fact worked.
3. **No admin path to invalidate or regenerate a single bad tree.** If one cached tree turns out to be
   wrong — wrong board's emphasis, a stale spec, whatever — the only lever is bumping
   `SYLLABUS_TREE_VERSION`, which regenerates *every* tree, not just the bad one. A targeted
   "re-author this signature" path (even a manual SQL delete-and-let-it-regenerate-on-miss) is missing.
4. **`author-syllabus-tree` has no rate limit.** Any authenticated user can POST an arbitrary
   `subject`/`level`/`board`/`goal` and trigger an expensive multi-call authoring run (skeleton +
   N expansion batches + audit + repair), whether or not the identity is canonical. This is the same
   abuse vector already logged as a follow-up for `author-lesson-plan`
   (`lesson-plan-layer.md` §8a.6) — harmless while the user base is the developer and a few testers,
   but it needs a guard (an allowlist tying the request to a real in-flight onboarding, or a per-user
   rate limit) before real users, and should be tracked with the pre-launch items, not the
   nice-to-haves.

## 10. Deployment note

New table + new edge function. Per CLAUDE.md, pushing to `main` deploys the **frontend only** — this
layer needs two things explicitly done through Lovable's chat before any of it is live:

- `supabase/migrations/20260807120000_syllabus_trees.sql` run verbatim (creates `syllabus_trees` and
  adds `learning_tracks.syllabus_tree_id`);
- `author-syllabus-tree` explicitly deployed as a new edge function.

Nothing here is live on a git push alone, and the ordering matters: `OnboardingPage.tsx` has already
been rewired to call `author-syllabus-tree`, and the client-side `buildFullTrack` / `refineTrackGrain`
/ `chatJSON` path described in §1 is deleted. The frontend therefore auto-deploys on push and will
immediately start calling a function that does not exist yet unless the two steps above are done
first. That failure is survivable by design — `fetchSyllabusTree` returns `null` on any error and
onboarding falls back to the director's own draft topics, so students still get a (coarser) track —
but until the migration and the function land, the layer is inert and every signup is silently on the
fallback path.

One consequence of moving the multi-pass server-side is worth watching on first deployment: the whole
build (skeleton → expansions → spec audit → repair) now happens inside a **single** edge function
invocation, where it was previously many short browser-driven calls. A JEE-scale syllabus is the
stress case. The breadth sweep in `docs/syllabus-tree-calibration.md` is what should establish whether
this fits inside the invocation limit; if it does not, splitting authoring into a two-call protocol is
the fix, and that is a measurement to take rather than a risk to pre-emptively design around.
