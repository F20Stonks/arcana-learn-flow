# The Lesson Plan Layer

**Status:** design agreed 2026-08-01. Implementation in progress.
**Companion docs:** `knowledge-tracker-framework.md` (concepts/mastery), project CLAUDE.md.

---

## 1. The problem this solves

Today the tutor is handed a **title** and asked to improvise a world-class lesson, live, on a cheap
model, every single turn.

Concretely, `SessionPage.tsx` sends `chat` exactly this context:

```
subtopic, topic, subject, level, examBoard, intensity, knownConcepts, prerequisites, mode
```

`chat/index.ts` then supplies ~100 lines of genuinely good pedagogy rules — why-first, isomorphic
transfer, no-shallow-wins, remediation ladders, six-stage teaching loop — and the model must satisfy
all of them *while simultaneously inventing the lesson's content from scratch, one turn at a time,
with no memory of a plan it never made.*

Three measurable consequences, all present in the code today:

1. **Every session is an independent dice roll.** Two students studying the same subtopic get
   unrelated lessons of unrelated quality. There is no artifact that says what a good lesson on this
   subtopic *is*, so there is nothing to be consistent with. This is exactly the long-tail failure
   mode that matters: not the happy-path demo, but the session that quietly teaches badly.

2. **The six-stage loop is unenforced.** Nothing tracks which stages have been satisfied. "Never skip
   stages 3 and 5" requires the model to re-audit the entire transcript correctly on every turn, from
   prose, with no state. It is a hope, not a mechanism.

3. **Completion is measured against nothing.** `assess-session`'s rubric asks "did the student solve
   *a* novel problem and explain *a* why." It cannot ask "did this session cover what this subtopic
   actually requires," because no representation of that exists. A session covering 20% of the
   material can be marked complete, permanently, and schedule a review as if it were done.

The missing layer is between "subtopic title" and "improvise": **there is no plan.**

## 2. The architecture

> Author the hard, quality-critical artifact **once at frontier quality**; cache it globally;
> production only needs a cheap model to **execute** it.

```
track generation  →  subtopic title
                          │
                          ▼
                 ┌──────────────────┐
                 │ author-lesson-   │   ONE expensive call, per subtopic, EVER
                 │ plan (cached)    │   shared across every user, globally
                 └──────────────────┘
                          │  lesson_plans row (jsonb)
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
        chat          sceneDirector   assess-session
     (executes      (scene_beats =   (checkpoints =
      the plan)      what to draw)    the real rubric)
```

The economics invert. Today: every turn of every session pays for improvisation. After: one
authoring call is amortised across every user who ever studies that subtopic, and each live turn
gets *cheaper* because it does strictly less work — it executes a plan instead of inventing one.

This is also why the layer de-risks the provider decision: the cheaper the live model needs to be,
the more it matters that the hard thinking already happened offline.

## 3. THE PLAN IS A MAP, NOT A SCRIPT

**This is the load-bearing design constraint. Rigidity would make the product worse, not better.**

A lesson plan must never become a script the tutor reads aloud, nor a per-concept template. The
tutor still reasons from scratch about *this* student in *this* moment: which route to take, how far
to push, when to back off, which analogy this particular person will catch. What the plan fixes is
not the path but the **terrain and the destination**:

- the plan says *this* mechanism is what must land — not the sentences that land it;
- the plan says *this* misconception is likely — not when to raise it;
- the plan says *these* checkpoints must be met before the subtopic is done — not the order, not the
  wording, not how many turns it takes.

Every field below is written as *material the tutor draws on*, never as *lines the tutor delivers*.
The authoring prompt and the executing prompt must both state this explicitly. If a session ever
reads as though it is following a script, the design has failed — that is a regression, not a
success.

## 4. Cache key

Plans are **global**, not per-user and not per-track. A plan for
`AQA · A-Level · Physics · Quantum phenomena · The photoelectric effect` is authored once and served
to every student who ever studies it.

```
signature = sha256( normalize(subject) | normalize(level) | normalize(board) | normalize(topic) | normalize(subtopic) )
normalize(s) = lowercase, collapse whitespace, strip punctuation, trim
```

Board is included because exam boards genuinely differ on emphasis, notation and scope. Board is
normalized to `""` when unknown, so unbranded tracks share one plan.

Quality compounds: improvements to the authoring prompt lift every future plan, and a bad plan can
be regenerated for everyone at once by bumping `plan_version`.

## 5. Plan schema (v1)

Every field exists because it replaces something the tutor currently has to invent live. Nothing is
decorative.

```jsonc
{
  "core_idea": "One sentence. The single thing that, once grasped, forces everything else in this
                subtopic. Not a summary — the load-bearing idea.",

  "prerequisites": [
    { "concept": "Kinetic energy",
      "why_needed": "the ejected electron's KE is what's left after paying the work function" }
  ],

  // WHY-FIRST made structural. Ordered. Each step must bottom out.
  "derivation_chain": [
    { "claim":         "there is a threshold frequency below which no electrons are emitted at any intensity",
      "mechanism":     "one photon interacts with one electron; a photon's energy hf is fixed by frequency alone",
      "rests_on":      "the one-photon-one-electron interaction",     // the load-bearing assumption
      "counterfactual":"if energy accumulated continuously, dim light would just take longer — it doesn't",
      "bottoms_out_at":"conservation of energy" }                     // axiom, or a concept already known
  ],

  // Remediation, pre-loaded instead of invented mid-failure.
  "misconceptions": [
    { "belief":          "brighter light gives each electron more energy",
      "why_its_tempting":"intensity really does increase total energy delivered",
      "diagnostic":      "double the intensity at fixed frequency — what happens to max KE?",
      "reteach_angle":   "count of coins vs. value of each coin: a bigger crowd of small coins still can't pay one big price" }
  ],

  // Rule 2 (isomorphic transfer) made concrete. Exactly 2, structurally identical, superficially far apart.
  "isomorphic_cases": [
    { "setting": "...", "mapping": "what plays the role of hf, of φ, of the threshold" },
    { "setting": "...", "mapping": "..." }
  ],
  "shared_structure": "what the student must NAME: a threshold on a per-quantum quantity, not on an aggregate",

  // The tutor ↔ Scene Director handoff, as an artifact instead of a hope.
  "scene_beats": [
    { "after_checkpoint": 2,
      "concept":          "...",
      "must_show":        "what becomes visible",
      "must_manipulate":  "what the student drags/slides, and what they watch survive or break",
      "falsifies":        "what they would SEE happen if the wrong model were true",
      "form_hint":        "construction | lattice | graph | transform | argand | field-3d | animated" }
  ],

  // The spine. Turns "mastery" from vibes into something gradeable.
  "checkpoints": [
    { "id": 1, "must_demonstrate": "predicts that raising intensity below threshold still yields nothing",
      "evidence_type": "prediction" },
    { "id": 2, "must_demonstrate": "explains in their own words why frequency and not intensity sets max KE",
      "evidence_type": "self_explanation" },
    { "id": 3, "must_demonstrate": "extracts φ from a stopping-potential graph they have not seen before",
      "evidence_type": "novel_application" }
  ],

  "terminal_transfer": {
    "problem":             "non-templated problem that certifies mastery",
    "why_novel":           "why this is not a re-skin of anything shown",
    "acceptable_reasoning":"what a correct line of reasoning must contain"
  },

  "notation":         [ { "symbol": "φ", "read_as": "work function", "note": "..." } ],
  "common_dead_ends": [ "where students stall procedurally, and the unstick" ]
}
```

`evidence_type` ∈ `prediction | self_explanation | novel_application | derivation | calculation`.

### Field → rule it operationalises

| Field | Replaces this improvisation |
|---|---|
| `core_idea` | tutor guessing what the point of the subtopic is |
| `derivation_chain` | HARD RULE 8 (why-first, bottoms out) reasoned from scratch each turn |
| `misconceptions` | HARD RULE 7 (remediation ladder) invented mid-failure |
| `isomorphic_cases`, `shared_structure` | HARD RULE 2 (isomorphic transfer) |
| `scene_beats` | `<scene-request>` decided ad hoc; the WHY↔picture link |
| `checkpoints` | the six-stage loop, currently untracked |
| `terminal_transfer` | HARD RULE 9 (no shallow wins) |
| `prerequisites` | the existing pre-flight prerequisite gate, currently AI-guessed per session |

## 6. Consumers

**`chat`** fetches the plan server-side from the context the client already sends, so
`SessionPage.tsx` needs no change and the plan — which contains the terminal transfer problem and
the answers to the checkpoints — never reaches the student's browser.

The tutor is given the checkpoint list explicitly and told to work out silently, before replying,
which are already evidenced in the transcript, then aim at the lowest unmet one.

> **Corrected 2026-08-01.** An earlier draft of this section claimed `chat` also *receives* which
> checkpoints are met. It does not: nothing stores met-checkpoints (see the follow-up below), so
> that state channel does not exist. The shipped behaviour is the silent per-turn inference above.
> That is still a large improvement on today — judging an explicit, enumerable list of 3-5 named
> acts is a far more reliable call than re-deriving the whole six-stage loop from prose — but it is
> inference, not stored state, and the distinction should not be papered over.

**`sceneDirector`** does *not* read plans directly. It is frontend code (`src/lib/sceneDirector.ts`)
that calls `chat` with a `systemOverride`, which is precisely the path where plan lookup is skipped.
`scene_beats` therefore reach the Director only *indirectly*, via the EARNED SCENES block shaping the
tutor's `<scene-request>`. That captures most of the value — the beat says what must be manipulable
and what it falsifies, and the tutor passes that intent on — but wiring the Director to the plan
directly is a genuine follow-up, and needs either a frontend change or a plan-bearing context on the
`systemOverride` call.

**`assess-session`** grades the transcript against `checkpoints` and `terminal_transfer` instead of
the current subtopic-agnostic rubric. Completion becomes "this subtopic's checkpoints were met,"
which is the honest meaning of the word.

Two safeguards there, both load-bearing:
- The checkpoint gate is enforced **in code**, not merely asserted in prompt text — otherwise it is
  a hope, exactly like the six-stage loop it replaces.
- The gate applies **only when the model actually reported checkpoints**. An explicitly empty array
  is a judgement and gates; an *absent* field is a formatting failure and falls back to the general
  rubric, loudly logged. Collapsing those two would let one dropped field cost a student their
  notes, concepts, XP and review schedule — every one of which hangs off `complete` — for work they
  genuinely did.

## 6a. What fills the cache

Nothing else in the system calls the authoring function, so without a trigger the table stays empty
and every session teaches on the miss path forever. On a **confirmed** cache miss (absent row, not an
unreachable database), `chat` fires a non-awaited request to `author-lesson-plan` and carries on
teaching without a plan.

The current turn never waits for authoring. The plan lands for a later turn, the next session, and —
because plans are global — for every other student who ever studies that subtopic. The cache warms
itself from real usage, with no batch job and no frontend involvement.

A per-isolate set of in-flight signatures stops one instance re-firing on every turn of a session
that is still waiting; a failed attempt clears its entry so a later turn can retry. The server-side
upsert is idempotent, so concurrent sessions on the same subtopic cannot corrupt each other.

**`assess-session`** grades the transcript against `checkpoints` and `terminal_transfer` instead of
the current subtopic-agnostic rubric. Completion becomes "this subtopic's checkpoints were met,"
which is the honest meaning of the word. Unmet checkpoints are the natural seed for the next
session and for review targeting.

## 7. Graceful degradation (required, not optional)

If a plan is missing, stale, malformed, or authoring fails: **the plan block is simply omitted and
the tutor behaves exactly as it does today.** Sessions must never block on, or break because of,
plan availability. Authoring is lazy on cache miss and never on the critical path of the first turn.

## 8. Verification bar

Per the standing quality bar, this ships only after a **breadth sweep**, not a demo:

- author plans across a spread of GCSE → A-Level → undergraduate, in **both** maths and physics,
  including deliberately awkward subtopics (pure-procedural ones with no natural mechanism,
  definition-heavy ones, and ones where a scene should correctly be *declined*);
- read every plan against the schema's intent — does the derivation actually bottom out? Are the two
  isomorphic cases genuinely structurally identical rather than two dressings of the same problem?
  Are the checkpoints demonstrable from a transcript?
- confirm the tutor reads as *less* scripted than today, not more (§3). This is the primary
  regression risk and must be checked explicitly.

Literal 100% is not promisable from an LLM. The target is: never broken, always at least honest and
useful, failure rate driven toward zero by measured coverage.

## 8a. Known follow-ups (deliberately not in this pass)

1. **Checkpoint outcomes are not persisted.** `sessions` has no jsonb or integer-array column and
   nothing else is a natural home, so `checkpoints_met` / `checkpoints_unmet` are returned in the
   response but stored nowhere. Adding `sessions.checkpoints_met` and `sessions.checkpoints_unmet`
   would make unmet checkpoints usable for seeding the next session and for targeting reviews — the
   obvious next unlock, and what would turn the per-turn inference above into real stored state.
2. **The Scene Director does not read plans directly** (see §6).
3. **The prerequisite gate still guesses.** The pre-flight tick-list AI-guesses prerequisites per
   session, while the plan already carries an authored, cached `prerequisites` list. The gate should
   read from the plan.
4. **Review mode is deliberately excluded.** `chat` withholds the plan in review mode, so grading a
   review transcript against checkpoints the tutor never saw would fail sessions for material the
   review was never asked to cover — and would wrongly trip the lapse factor, shrinking intervals.
   Reviews therefore keep today's rubric. Revisit only alongside a review-specific plan view.
5. **`scene_beats.after_checkpoint` is currently advisory.** `renderPlanForTeaching()` emits every
   beat regardless of which checkpoints are evidenced, so "earned after checkpoint N" lives only as
   prose in the prompt rather than as gating. It becomes enforceable once checkpoint state is
   persisted (follow-up 1).
6. **Authoring has no rate limit.** Any authenticated user can POST an arbitrary `subtopic` string
   to `author-lesson-plan` and trigger an expensive call; there is no allowlist tying the request to
   a real subtopic in a real track. Harmless while the user base is the developer and a few testers,
   but it is a cost/abuse vector that needs a guard before real users — list it with the pre-launch
   items, not the nice-to-haves.

## 9. Deployment note

New table + new edge function + edits to `chat` and `assess-session`. Per CLAUDE.md, pushing to
`main` deploys the **frontend only** — the migration must be run by Lovable's chat verbatim, and
`chat` / `assess-session` / `author-lesson-plan` must be explicitly redeployed. Nothing here is live
on a git push alone.
