# The Syllabus Tree Layer

**Status:** implemented 2026-08-07. The table and the first version of the function are LIVE
(migration run, function deployed, both confirmed by direct check). The two-phase per-topic grounding
rewrite in §6 is implemented but **needs `author-syllabus-tree` redeployed** before it takes effect —
until then the deployed function still does the old whole-syllabus audit described as flawed in §6.
No tree has yet been verified by breadth sweep (§8).
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

Two phases, and the second one is the point (§6 covers why):

```
onboarding goal  →  subject / level / board
                          │
                          ▼
                 ┌──────────────────┐
                 │ author-syllabus- │   cache lookup by signature
                 │ tree             │
                 └──────────────────┘
                          │
             ┌────────────┴────────────┐
        cache HIT                  cache MISS
     (grounded tree,                   │
      instant)                         ▼
             │                ┌───────────────────┐
             │                │ FAST phase         │  skeleton + ungrounded batch
             │                │ (seconds)          │  expansion — returned to the
             │                └───────────────────┘  student immediately, NEVER cached
             │                          │
             │                          ▼
             │              track instantiation
             │           (topics + subtopics COPIED
             │            into learning_tracks/topics/subtopics)
             │                          │
             │            canonical identity? ── no ──▶ grounding SKIPPED
             │                          │ yes               (nothing to cache anyway)
             │                          ▼
             │                ┌───────────────────┐
             │                │ GROUNDED phase     │  per topic: real spec search +
             │                │ background, via    │  one regenerate call — collapses
             │                │ EdgeRuntime.wait-  │  expand/audit/repair into ONE
             │                │ Until (mode:"sync" │  call per topic (§6)
             │                │ forces it inline)  │
             │                └───────────────────┘
             │                          │
             │              topics_grounded/total ≥ 0.6 ?
             │                          │ yes
             └──────────────  syllabus_trees row (cached, coverage.verdict="grounded")
                                          │
                                          ▼
                            NEXT student on this signature → cache HIT
                                          │
                                          ▼
                            student studies subtopic "X"
                                          │
                                          ▼
                            author-lesson-plan keyed on subtopic string "X"
                      ── now the SAME "X" for every student on this syllabus ──
                                lesson_plans cache starts concentrating
```

The first student on any given goal always pays the FAST path and gets an ungrounded tree; only
students who arrive after grounding has landed in the cache get the checked, `grounded` one. §6 covers
why that trade-off is accepted rather than making everyone wait.

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
  topics_grounded?: number;
  topics_total?: number;
  source_url?: string;
  missing?: string[];
};

type SyllabusTree = { topics: SyllabusTopic[]; coverage: SyllabusCoverage };
```

`subtopics` is deliberately just `string[]`, not richer objects — the tree's whole job is naming the
session-grain decomposition; everything about *how* to teach a given subtopic belongs one layer down,
in the lesson plan keyed on that string. `topics_grounded`/`topics_total` is the honest measure behind
`verdict` — see §6, which covers `SyllabusCoverage` in full.

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

## 6. Verification: the two-phase split, and why grounding replaced auditing

This is what makes global caching *safe* rather than merely *fast* — and it is the section that
changed most in this pass. The mechanism below **replaces** the original whole-tree audit-and-repair
pass entirely; that mechanism no longer exists.

**The flaw in the first version.** The initial design ran the whole assembled tree through one audit
call against a single spec excerpt `resolveOfficialSpec` resolved for the entire identity — at most
~6,000 characters from one search result. A real A-Level specification is a hundred-page document, so
that excerpt is roughly 1-2% of it. The audit prompt was, correctly, told never to infer that something
was missing just because the excerpt stopped — which made it structurally incapable of catching the
dominant failure mode: material missing from **both** the tree and the excerpt. It largely
rubber-stamped whatever the fast pass produced. `specChecklistResolver.ts` had already hit and
documented this exact wall while building the spec-checklist feature ("a single flat search-and-truncate
grab is nowhere near enough text to cover a real syllabus's full line items") and solved it by resolving
spec text **per topic** instead. `specSearch.ts` (`searchTopicSpecText`, `getTavilyKey`,
`fetchHtmlFallback`) now holds that fix as a shared module, extracted unchanged so the two consumers
don't drift; this layer reuses it rather than re-deriving the same lesson.

**FAST phase (`buildFastTree`).** A skeleton call produces the topic list, then `expandTopics` fans out
ungrounded batches (`EXPAND_BATCH_SIZE = 4` topics per call, `EXPAND_CONCURRENCY = 5`) to fill in
subtopics. Returns in seconds. This is what the waiting student's track is instantiated from. It is
**never** cached — it has been checked against nothing but the model's own judgment.

**GROUNDED phase (`groundTree`), the only phase that can produce a cacheable tree.** For each topic,
`searchTopicSpecText` fetches real specification text for **that topic specifically** — the topic title
is quoted in the query deliberately, because an unquoted search returns the syllabus's generic landing
page every time. One model call (`GROUNDED_TOPIC_SYSTEM`) then regenerates that topic's subtopics
directly from the excerpt: keeping draft subtopics that still fit (reworded to the spec's own
terminology where it differs), dropping ones the spec doesn't actually require, and adding whatever the
excerpt requires that the draft missed.

**Why expansion, audit, and repair collapse into one call.** With real per-topic spec text in hand,
there is nothing left to audit separately: the subtopics are *derived from* the specification, not
invented by a general-purpose prompt and checked against a fragment of it afterward. This is both
cheaper — one call per topic instead of a whole-tree audit plus a whole-tree repair — and stronger: the
model is reading the actual requirement while writing the subtopic, rather than reconstructing it from
memory and hoping a later audit catches the gap.

**Where grounding runs.** By default, in the background: `groundAndCache` is handed to
`EdgeRuntime.waitUntil` once the FAST tree has already been returned to the student — the identical
pattern `chat/index.ts` uses to warm the lesson-plan cache. The first student on a goal gets the fast,
ungrounded tree; every student after them gets the grounded, cached one once grounding lands. **The
accepted trade-off:** the first student's track is instantiated from the ungrounded tree and is never
retro-updated when grounding later completes — their `learning_tracks.syllabus_tree_id` still points at
whichever tree existed at their signup.

`mode: "sync"` forces grounding to run inline before the response is sent. Onboarding never sets this —
a student cannot wait through N sequential searches plus N model calls. The breadth sweep
(`scripts/sweep-syllabus-trees.mjs`) always does, because a background phase it cannot observe is a
phase it cannot verify pass/fail against.

**Grounding is skipped entirely for non-canonical identities.** Without a named board
(`hasCanonicalIdentity` false, §3), the per-topic search has nothing to disambiguate its query on, and
the result could not be cached even if grounding succeeded perfectly — so running it would spend N
searches and N model calls producing a tree that gets thrown away at the end of the request. The
response reports `grounding: "skipped"` for this case.

**Honest coverage measurement.** `SyllabusCoverage` now carries `topics_grounded` / `topics_total`, not
just a verdict — this pair is what says how real a `grounded` claim actually is for a given tree,
because the first version of this field did not exist and the layer consequently overclaimed.
`MIN_GROUNDED_RATIO = 0.6` is the share of topics that must resolve real spec text before
`verdict: "grounded"` is written. Not 100%: some legitimate topics have no separately-searchable spec
page of their own (folded into a parent page's search result, say), and demanding perfection would mean
never caching anything. Not lower either: below 60%, "grounded" would be a claim about a minority of the
syllabus dressed up as a claim about all of it. `coverage.missing` now records the titles of topics that
could not be **grounded** — a gap in *verification*, not necessarily in *content*: an ungrounded topic
still has subtopics from the fast pass, they were simply never checked against a specification.

**`validateSyllabusTree` downgrades a `grounded` claim with no `source_url`.** That combination is
structurally impossible — grounding means spec text was actually fetched from somewhere — so a stored
row claiming it anyway means the row predates this contract or was hand-edited, and the safe move is to
downgrade to `unverified` rather than let an unsourced completeness claim stand.

**Budgets.** `GROUNDING_BUDGET_MS = 110_000` bounds the whole grounding phase; topics not reached before
the deadline are recorded as ungrounded rather than silently dropped, so a timeout shows up honestly in
`topics_grounded/topics_total` instead of a tree that quietly looks more verified than it is.
`GROUNDING_CONCURRENCY = 3` throttles harder than the fast phase's `EXPAND_CONCURRENCY = 5`, because
each grounding unit is a search **and** a model call, not just a model call.

## 7. Graceful degradation

`author-syllabus-tree` must **never fail closed.** Contrast this explicitly with `author-lesson-plan`,
which *does* fail closed on a cache-unavailable path (`lesson-plan-layer.md` §7) — because a
plan-less session there just falls back to today's live-improvised teaching, which is a real, working
product state. There is no equivalent fallback here: a student with no track has no product at all.
Onboarding cannot degrade to "no syllabus."

Concretely: spec resolution failing, a topic's per-topic search failing, the grounded regeneration call
failing, or the identity being non-canonical are all handled by narrowing what gets *cached* (or, for
grounding, running it in the background where a failure delays a cache write, not a response), never by
refusing to return a tree. The only hard failures in the handler are "the skeleton pass produced fewer
than 3 topics" and "fewer than 60% of topics expanded" — both meaning the fast tree itself is unusably
thin, not that it couldn't be verified or shared.

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

1. **Per-topic grounding still has real gaps** (moving per-topic search from a whole-syllabus excerpt
   to per-topic resolution fixed the dominant failure mode, but not every failure mode). Each topic's
   excerpt is still capped at `MAX_EXCERPT_CHARS` (6,000 characters, `specSearch.ts`) and
   `searchTopicSpecText` takes the **first usable** result out of up to 4 candidates — a topic whose
   spec page is a PDF fails to ground outright (`fetchHtmlFallback` only accepts
   `content-type: html`, so a PDF-only spec page returns nothing usable), and a topic that's badly
   indexed by Tavily or whose content is split across several pages can still come back empty even
   though the material exists. There is also **no re-audit after the grounded regeneration** — the
   `GROUNDED_TOPIC_SYSTEM` response is trusted directly once it's non-empty and well-formed, so an odd
   or partial grounded response is caught by structural validation only, not by a second check that it
   actually covered the excerpt. And **the first student on any goal necessarily gets the ungrounded
   tree** (§2, §6) — grounding runs after their track is already instantiated, so their track is never
   retro-corrected even once the cache holds a grounded version.
2. **No admin path to invalidate or regenerate a single bad tree.** If one cached tree turns out to be
   wrong — wrong board's emphasis, a stale spec, whatever — the only lever is bumping
   `SYLLABUS_TREE_VERSION`, which regenerates *every* tree, not just the bad one. A targeted
   "re-author this signature" path (even a manual SQL delete-and-let-it-regenerate-on-miss) is missing.
3. **`author-syllabus-tree` has no rate limit.** Any authenticated user can POST an arbitrary
   `subject`/`level`/`board`/`goal` and trigger an expensive authoring run (skeleton + N expansion
   batches, plus — under `mode:"sync"`, or whenever the background job runs — N per-topic searches and
   model calls), whether or not the identity is canonical. This is the same abuse vector already logged
   as a follow-up for `author-lesson-plan` (`lesson-plan-layer.md` §8a.6) — harmless while the user base
   is the developer and a few testers, but it needs a guard (an allowlist tying the request to a real
   in-flight onboarding, or a per-user rate limit) before real users, and should be tracked with the
   pre-launch items, not the nice-to-haves.
4. **The edge-function invocation time limit is now the binding constraint on very large syllabuses.**
   Moving authoring server-side means the whole build — skeleton, ungrounded expansion, and (under
   `mode:"sync"`, or whenever the background job is still running) grounding — happens inside a single
   invocation. `GROUNDING_BUDGET_MS = 110_000` keeps the grounding phase itself from running unbounded,
   but it is a soft internal budget, not a guarantee that the surrounding invocation still has that much
   room left. A genuinely large syllabus — JEE-scale, up to `MAX_TOPICS = 60` topics, each a search plus
   a model call even at `GROUNDING_CONCURRENCY = 3` — may need more wall-clock than one invocation can
   give it. If the breadth sweep turns up invocations getting killed rather than completing (a
   partially-grounded tree, or a `mode:"sync"` call that never returns), the fix is splitting grounding
   into a real job queue rather than leaning on `EdgeRuntime.waitUntil`, which extends one invocation's
   life but doesn't survive a cold start or resume across separate invocations.

## 10. Deployment note

New table + new edge function. Per CLAUDE.md, pushing to `main` deploys the **frontend only** — this
layer needs two things explicitly done through Lovable's chat before any of it is live:

- `supabase/migrations/20260807120000_syllabus_trees.sql` run verbatim (creates `syllabus_trees` and
  adds `learning_tracks.syllabus_tree_id`);
- `author-syllabus-tree` explicitly deployed as a new edge function.

This applies again, in full, to the two-phase rewrite in §6: even once `author-syllabus-tree` has been
deployed once, the fast/grounded split, the `specSearch.ts` import, and the new `mode:"sync"` handling
are all inert until it is **redeployed** — a git push alone does not update a previously-deployed edge
function's code (see the root `CLAUDE.md`). Anyone testing against a stale deployment will see the old
whole-tree-audit behavior (or a straight 404, if it was never deployed at all) regardless of what's on
`main`.

Nothing here is live on a git push alone, and the ordering matters: `OnboardingPage.tsx` has already
been rewired to call `author-syllabus-tree`, and the client-side `buildFullTrack` / `refineTrackGrain`
/ `chatJSON` path described in §1 is deleted. The frontend therefore auto-deploys on push and will
immediately start calling a function that does not exist yet unless the two steps above are done
first. That failure is survivable by design — `fetchSyllabusTree` returns `null` on any error and
onboarding falls back to the director's own draft topics, so students still get a (coarser) track —
but until the migration and the function land, the layer is inert and every signup is silently on the
fallback path.

One consequence of moving authoring server-side is worth watching on first deployment: the FAST build
(skeleton → ungrounded expansion) happens inside a single edge function invocation, where it was
previously many short browser-driven calls — and under `mode:"sync"` (or whenever the background job
happens to still be running against a warm isolate), the GROUNDED phase's per-topic searches and model
calls share that same invocation's clock. A JEE-scale syllabus is the stress case; see §9 follow-up 4
for the specific limit (`GROUNDING_BUDGET_MS`) and the job-queue fallback if it's not enough. The
breadth sweep in `docs/syllabus-tree-calibration.md` is what should establish whether this fits inside
the invocation limit in practice, rather than this being a risk to pre-emptively design around.
