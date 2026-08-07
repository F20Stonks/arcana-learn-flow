# Syllabus tree — calibration bar and breadth sweep

Companion to `supabase/functions/_shared/syllabusTree.ts` (the contract) and
`supabase/functions/author-syllabus-tree/index.ts` (the endpoint). This file exists for the same
reason `lesson-plan-calibration.md` does: the layer is judged against a **written standard set before
any output was seen**, and across **breadth**, not by admiring whichever generated tree happened to
look good. Per the standing quality bar, "perfection" means reliable coverage across the whole HS→
undergraduate, maths-and-physics range — not a good demo on one board.

The harness itself is `scripts/sweep-syllabus-trees.mjs`.

---

## Why this matrix

`author-syllabus-tree` has one property that makes it riskier than the lesson-plan layer it sits
under: it writes to a **global** cache. A bad lesson plan affects one session; a bad syllabus tree,
once cached, silently serves a truncated or wrong curriculum to every future student who names that
same board/level/subject. So the sweep is built to stress exactly the two ways that goes wrong —
incompleteness and mis-scoping — across the identities the product actually needs to serve:

- **AQA / A-Level / Physics, Edexcel / A-Level / Mathematics, OCR / GCSE / Physics,
  AQA / GCSE / Mathematics** — the bread-and-butter UK boards at both the GCSE and A-Level grain, one
  of each subject. These are the cases the layer has to get right every single time; if these are weak,
  nothing else matters yet.
- **IB / Diploma / Physics, CIE / A-Level / Further Mathematics** — board variety beyond the two most
  common UK exam boards, and a "Diploma" level string that doesn't literally say "A-Level," to check
  the level-band logic isn't secretly hardcoded to UK phrasing.
- **JEE / Undergraduate-entrance / Physics+Chemistry+Maths** — the deliberate stress case. A single
  named exam spanning three subjects at once is the scenario `MAX_TOPICS = 60` and the skeleton
  prompt's own "40-60 topics for a full multi-subject exam" guidance exist for
  (`supabase/functions/_shared/syllabusTree.ts`, `author-syllabus-tree/index.ts`). If grouping or
  truncation logic is going to fail anywhere, it's here.
- **The negative case** — `{ subject: "Physics", level: "Undergraduate", board: null, goal: "I want to
  understand quantum field theory" }`. This is not a filler row. `hasCanonicalIdentity()` exists
  specifically to keep an unverifiable, bespoke goal out of the shared cache (see the "THE GATE:
  CACHEABLE ⟺ VERIFIABLE" comment at the top of `syllabusTree.ts`). If this row ever comes back
  `cached:true`, that is the layer's single worst failure mode — one student's personal, unaudited
  goal silently became "the" tree served to some future student who happens to hash to the same
  signature — and the sweep is written to fail loudly, not just note it, when that happens.

---

## Why the sweep forces `mode: "sync"`

`author-syllabus-tree` runs a FAST, ungrounded pass synchronously and returns it immediately, then —
by default — grounds each topic against real spec text **in the background** via
`EdgeRuntime.waitUntil`, so the student who triggered generation never waits for it
(`docs/syllabus-tree-layer.md` §6). A production call with no `mode` therefore returns a tree that has,
by design, been checked against nothing yet.

Every row the sweep sends carries `mode: "sync"`, which forces grounding to run inline before the
response comes back. This isn't a convenience setting — it's the only way the sweep can measure the
thing that actually matters. A background phase the sweep can't observe is a phase it can't verify: if
the sweep called the default async path, every row would report `grounding: "queued"` and an
`unverified`/empty coverage record, and the whole matrix would look identical whether grounding
eventually worked, silently failed, or never ran at all. `mode:"sync"` trades sweep latency (each row is
now a full skeleton → expand → per-topic-search → per-topic-regenerate pipeline, run to completion) for
a result that actually says something about grounding quality.

---

## What the sweep checks automatically

Run via `scripts/sweep-syllabus-trees.mjs`. Every row gets a PASS/FAIL from these checks:

1. `ok === true` on the response.
2. Topic count falls within a plausible band for the level. Bands are named constants
   (`TOPIC_BANDS` in the script) directly justified by the skeleton prompt's own stated targets
   (6-12 a focused module, 15-30 a single A-level, 40-60 a full multi-subject exam) and by
   `MAX_TOPICS = 60`. A GCSE subject and a JEE-scale exam legitimately differ by an order of
   magnitude, so there is one band per level shape rather than one global band.
3. Every topic has at least one subtopic (a topic with zero subtopics isn't teachable —
   `validateSyllabusTree` in `syllabusTree.ts` already drops these server-side, so seeing one here
   would mean that guarantee broke).
4. No duplicate topic titles, and no duplicate subtopics within a topic (same reasoning: this is
   meant to be structurally impossible per `validateSyllabusTree`, so a duplicate here is a real bug,
   not sweep pickiness).
5. A `grounded` coverage verdict MUST carry a `source_url`. An unsourced completeness claim is exactly
   what the `coverage` record exists to prevent (`syllabusTree.ts`'s `SyllabusCoverage` doc comment) —
   this is treated as a hard failure, not a warning.
6. **For every positive (non-negative) row** — the checks that actually matter, because everything
   above this point can pass on a tree that was never checked against a specification at all:
   - `coverage.topics_grounded / coverage.topics_total >= MIN_GROUNDED_RATIO` (0.6, mirrored from
     `syllabusTree.ts` as a literal in the script since the harness is plain Node and that module is
     Deno/TypeScript — see the comment above `MIN_GROUNDED_RATIO` in the script for the drift risk).
   - `coverage.verdict === "grounded"`.
   - `treeId != null` — the tree was actually written to `syllabus_trees`, not just computed and
     discarded. A tree that passed grounding but wasn't persisted helps nobody after the first student.
7. **For the negative case** — the bespoke, no-board row:
   - it is not cached (`cached === false` and `treeId === null`, as before);
   - `grounding === "skipped"`. A bespoke goal must never spend real searches or model calls grounding
     a tree that can never be cached (`docs/syllabus-tree-layer.md` §6) — if this row shows
     `grounding` as anything other than `"skipped"`, the non-canonical short-circuit in
     `author-syllabus-tree/index.ts` has regressed, even if nothing ended up in the cache.

Checks 6 and 7 are the ones worth reading closely when a row fails. A tree can have a plausible topic
count, zero duplicates, and a well-formed `source_url` and still have grounded only 30% of its topics —
passing checks 1-5 while failing the one check that says whether the syllabus was actually verified
against anything real.

The script runs the matrix **sequentially, not in parallel** — each row is itself a multi-call
authoring pipeline (skeleton → ungrounded expansion → per-topic grounded regeneration, batched and
pooled internally in `author-syllabus-tree/index.ts`), and firing multiple rows at once on top of that
reliably trips gateway rate limits and turns a real defect into a misleading transport failure. Expect a
full run to take a while; that's the cost of a result that means something.

Raw JSON for every row is written to `scripts/sweep-syllabus-trees-results.json` (or wherever `--out`
points) specifically so the next section can happen.

---

## What still needs a HUMAN READ

Passing every automated check above is **necessary but NOT sufficient**. None of it can tell you
whether the tree is actually *good*. After a sweep run, read the raw JSON output by hand and ask, per
row:

- **Is the subtopic grain genuinely one-sitting?** "Complex Numbers" as a subtopic is a coarse-grain
  failure the automated checks cannot see — it's a single valid string, not a duplicate, not empty.
  Compare against the grain examples in the `EXPAND_SYSTEM` prompt ("Argand diagrams: plotting a
  complex number" — good; "Complex Numbers" — too coarse) and judge every subtopic against that bar.
- **Are the topic groupings sensible?** Does "Quarks" get folded into "Fundamental Particles" the way
  the `SKELETON_SYSTEM` prompt asks, or does the tree fragment into narrow, arbitrarily-split topics
  (or, the opposite failure, cram unrelated material into one oversized topic)?
- **Does the tree actually resemble the real syllabus?** This is the one no structural check can
  touch: does AQA A-Level Physics actually look like AQA A-Level Physics to someone who knows the
  spec? Spot-check a handful of topics against the real published spec, not just against the
  `coverage.source_url` the model claims to have used.
- **Does the JEE row actually cover three subjects fairly**, or did one subject (typically whichever
  the model lists last) get clipped to make room for the others? The skeleton prompt explicitly warns
  against this ("never clip the last subject to save space") — verify it held.
- **Do the two same-subject-different-board rows (if you extend the matrix that way, e.g. AQA vs OCR
  Physics) actually differ**, or did the model produce two near-identical trees that happen to carry
  different `signature` values? A distinct signature with indistinguishable content is a subtler
  failure than an obvious miss.

None of this is optional polish — it is the actual bar. A tree that passes every automated check but
reads as coarse-grained or mis-grouped has still failed.

---

## Running it

```sh
cd arcana-learn-flow-main
node scripts/sweep-syllabus-trees.mjs --token <bearer JWT for a real signed-in user>
```

- The Supabase URL is read from `VITE_SUPABASE_URL` in `.env` (override with `--supabase-url`).
- The token can also be supplied via `SUPABASE_AUTH_TOKEN` in the environment instead of `--token`.
  There is no service-role bypass — `author-syllabus-tree` requires a real user
  (`requireUser`/`unauthorized` in `supabase/functions/_shared/auth.ts`), the same as any student
  hitting it from the app, so a real JWT is required either way.
- `--out <path>` changes where the raw JSON results file is written (default
  `scripts/sweep-syllabus-trees-results.json`).
- The process exits non-zero if any row fails a hard check, so it's usable as a CI-style gate once the
  endpoint is deployed — though see the note below on what that gate does and doesn't cover.

**Current status: the endpoint is not deployed yet.** `author-syllabus-tree` exists in
`supabase/functions/` but has not gone through a Lovable redeploy (see the root `CLAUDE.md`'s note
that pushing to `main` only auto-deploys the frontend; edge functions need an explicit Lovable-chat
redeploy). Running the script today returns a 404 for every row and the script has been verified to
handle that cleanly: it prints the raw non-JSON/error body per row, records a FAIL, keeps going through
the rest of the matrix rather than crashing on the first failure, still writes the results file, and
exits 1 at the end. Re-run once the function is confirmed live.

## The bar for shipping this layer

1. Every automated check in `scripts/sweep-syllabus-trees.mjs` passes across the full matrix,
   including — especially — the negative case never being cached.
2. A human has actually read every row's raw tree (not sampled the ones that looked fine at a glance)
   against the grain/grouping/resemblance questions above and can say, in writing, that none of them
   read as a demo-quality outlier propped up by an average.
3. The JEE stress case in particular has been read start-to-finish for balanced coverage across all
   three subjects — this is the row most likely to hide a real defect behind a plausible-looking topic
   count.

Passing (1) alone is not a ship decision. It is the gate that makes reading (2) worth doing at all —
there's no point human-reading grain quality on a tree whose structural contract is already broken.
