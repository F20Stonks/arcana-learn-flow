# The Theoretical Maximum — What Cortexed Is Actually Optimizing

Status: strategy document. Written at 20 users, after reading the full teaching stack
(`supabase/functions/chat`, `assess-session`, `src/lib/sceneDirector.ts`, `src/lib/sceneSpec.ts`,
`src/pages/SessionPage.tsx`, the concept tracker in `docs/knowledge-tracker-framework.md`).

The question this answers: *what does the theoretical maximum of this product even mean, and what
is the gap between here and there?* The short answer is that the maximum is a **sensing** bound,
not an **actuating** bound — and that almost all the instinctive answers (better animations,
video, more content, a smarter tutor prompt) push on the actuator, which is already the strong
half of the system.

---

## 1. The objective function

Before you can talk about a maximum you need the thing being maximized. "Take someone from not
understanding to understanding deeply" is a goal, not an objective function. Made precise:

> For a learner in knowledge state **K**, and a target concept **C**, minimize the learner-time
> required to reach a state where they can (a) derive **C** from its mechanism, (b) apply it to an
> unseen problem, (c) locate it in the structure of what they already know — and hold that state
> against decay.

Three quantities, not one: **depth × transfer × durability**, per unit of learner time and
attention. Any product decision that doesn't move one of those three is decoration.

This immediately tells you something important: the denominator is *learner time*, and learner
time is the only genuinely scarce resource in the system. Compute is cheap and getting cheaper.
Model quality is rising for free. The learner's hour is fixed and non-renewable. **So the
theoretical maximum is a statement about how that hour is spent.**

---

## 2. Two false maxima, dissolved

**False maximum A: direct transfer.** The instinctive ceiling is Matrix-style upload — skip the
work, install the understanding. This is not a technology limitation, it's a category error.
Understanding isn't a payload; it's a set of relations between the new idea and the specific
structures *this* learner already has. "Eigenvector" means something different — is *connected*
differently — in the head of someone who knows rotation matrices geometrically versus someone who
knows them as arrays of numbers. There is no representation of C that can be transmitted
independent of K, because C's meaning is partly constituted by K. The construction has to happen
inside the learner. **The learner must supply the work. That is the irreducible cost, and it sets
the floor on learner time.**

**False maximum B: cinematic clarity.** The other instinct is 3Blue1Brown-quality animation for
everything — if the explanation is beautiful enough, understanding becomes inevitable. This is
the seductive one, and it's wrong in an interesting way.

Derek Muller's PhD work (Sydney, 2008) tested exactly this on physics video. A clear, well-produced
expository video on a mechanics concept produced **no measurable learning gain** — and left
students *more* confident they had learned it. The version that produced gains presented the
common misconception explicitly, let students sit in it, then refuted it. Students rated that
version as more confusing and less enjoyable, and scored substantially better.

The mechanism: a clear explanation gets assimilated into whatever model the learner already holds,
*without disturbing it*. If that model is wrong, clarity leaves it wrong and adds the feeling of
comprehension on top. **Fluency is not understanding, and polish manufactures fluency.**

This generalizes past video. It's the reason your `SCENE_DIRECTOR_PROMPT` is right to insist on
"MECHANISM, NOT RESULT" and "A FALSIFIABLE MANIPULATION" — those rules are, whether or not it was
framed this way, defences against exactly this failure. A beautiful diagram of the finished fact is
the visual equivalent of Muller's clear video.

So: **more beautiful rendering is not the direction of the maximum.** Neither is video, for a
second and independent reason — video is a linear, zero-adaptivity medium. Adding it to an
adaptive engine is a regression toward the mean of pedagogy, not an advance on it. The only
defensible use of pre-rendered video is a specific animation a real-time engine genuinely cannot
produce, and that set is nearly empty for the maths and physics you teach.

---

## 3. The right frame: teaching is closed-loop control

Strip the system to its structure and it is a control loop:

| Control element | In Cortexed | Current strength |
|---|---|---|
| **Plant** — the thing being moved | The learner's mental model | — |
| **Actuator** — how you push on it | Explanations, scenes, problems | **Strong** |
| **Sensor** — how you observe its state | The student's answers | **Weak** |
| **Controller** — the policy | The tutor system prompt | Strong but near-blind |
| **Plant model** — your belief about the plant | `user_concept_knowledge` | **One bit per concept** |

Control theory gives the governing result immediately: **you cannot control what you cannot
observe.** Controller performance is bounded by observability. If the sensor is low-bandwidth,
noisy, and delayed, no amount of actuator sophistication rescues it — you push hard, precisely, in
a direction chosen from a bad estimate of state.

That is the diagnosis of this product in one line. The actuator (scene director, teaching prompt)
is genuinely near the practical ceiling. The sensor is a multiple-choice pick — **two bits, from a
channel where the interesting information is which *wrong* model produced the answer** — and the
plant model is a boolean per concept that is granted only at session end, never decays, and is
never wrong.

**The theoretical maximum is therefore: the system's uncertainty about the learner goes to zero.**
Everything else follows from that. When you know exactly what they know, exactly what wrong model
they hold, and exactly how fast it is fading, the correct next action is nearly forced — and a good
tutor prompt (which you already have) will find it.

---

## 4. The five leaks

Between actual learner time and the irreducible construction time from §2, every real system
loses time to exactly five leaks. This is the decomposition to design against:

1. **Redundancy loss** — time on what they already knew.
   Requires: knowing what they know.
2. **Overshoot loss** — time on what they weren't ready for, because a prerequisite was missing.
   Requires: knowing the prerequisite structure, and their state within it.
3. **Misdiagnosis loss** — time spent fixing the wrong thing, because the tutor's hypothesis about
   the blocker is wrong.
   Requires: a hypothesis space over misconceptions, and evidence that discriminates between them.
4. **Decay loss** — time re-learning what was learned and then lost.
   Requires: per-item retention modelling.
5. **Illusion loss** — time that felt productive and built nothing durable.
   Requires: measuring transfer, not comprehension.

Note what all five have in common. **Not one of them is an actuator problem.** Every single one is
a sensing-and-modelling problem. This is the whole argument, in compressed form: the gap between
Cortexed today and the theoretical maximum is almost entirely learner modelling.

---

## 5. Where Cortexed actually sits, leak by leak

Concrete, against the code as it stands.

### Leak 1 — Redundancy: partially plugged, understated
`SessionPage.loadContext()` reads the 20 most recent known concepts and passes them to the tutor as
`knownConcepts`; the prompt's `priorKnowledgeBlock` uses them for CONNECT IN bridges. Good — that's
better than most products do.

The leak: `user_concept_knowledge` is written **only when `complete === true`** in
`assess-session/index.ts`. The completion rubric is deliberately strict (transfer AND
self-explanation AND terminal challenge AND every misconception remediated). So a session where a
student genuinely learned six concepts but stopped one rung short of the terminal challenge records
**zero** knowledge. The known-set systematically understates reality, which causes re-teaching,
which is redundancy loss. The strictness is right for *completion*; it's wrong as the gate on
*knowledge*. Those should be two different verdicts.

### Leak 2 — Overshoot: structurally cold-started
`subtopic_concepts` `requires`-edges are written by `assess-session` **after** a completed session.
So the first student through any subtopic gets no prerequisite check at all — the comment at
`SessionPage.tsx:~525` acknowledges this. With 20 users, that is close to *every* session.

Deeper: there are **no concept→concept edges** anywhere in the schema. The graph is
subtopic→concept only. So transitive reasoning is impossible — the system cannot know that
eigenvector needs linear map which needs vector space. Prerequisite checking is one hop deep and
scoped to a hand-generated subtopic list. That's not a knowledge graph; it's a tag index.

### Leak 3 — Misdiagnosis: the biggest hole in the product
Rule 7 (`WRONG-ANSWER REMEDIATION`) is a genuinely good instruction — diagnose the misconception,
re-teach through a *different* concrete angle, re-test with an easier variant, cap at two attempts.
Better than almost anything shipping.

But: **the diagnosis is never captured.** It is improvised inside a chat message and evaporates when
the session ends. There's no misconception registry, no record of which misconception was
hypothesized, no evidence that the remediation worked at the level of persisted state, and no memory
at all across sessions. The same student hits the same misconception three weeks later and the
system starts from zero.

And the fundamental limitation underneath: **misconceptions are treated as a per-turn improvisation
rather than as a differential diagnosis over a known space.** A doctor doesn't reason from first
principles about every patient; they have a differential. Physics education research established
decades ago that misconceptions are *finite and enumerable per domain* — the Force Concept
Inventory (Hestenes et al., 1992) works precisely because the wrong answers are the same wrong
answers across thousands of students: impetus theory, motion-implies-force, and so on. Maths has
the same short list: the linearity error `f(a+b) = f(a)+f(b)`, "multiplication makes bigger", equals
as an operator rather than a relation, conflating necessary with sufficient, treating a variable as
a label rather than a quantity.

### Leak 4 — Decay: modelled, but at the wrong granularity
`subtopic_reviews` with confidence-scaled interval growth (`REVIEW_GROWTH`, `REVIEW_LAPSE_FACTOR`)
is a real spaced-repetition implementation and better than the doubling placeholder the framework
doc specified. Credit where due.

The leaks: the clock is per-**subtopic**, so a concept the student nearly failed shares a schedule
with one they aced. And `user_concept_knowledge` **never decays** — it is monotonically increasing
and therefore increasingly fictional. At six months the known-set is a record of what the student
once saw, and the CONNECT IN bridges are built on concepts they may no longer hold.

### Leak 5 — Illusion: the best-handled leak in the system
The completion rubric explicitly refuses MCQ-only transcripts, requires a novel problem solved
unaided, requires self-explanation in the student's own words, and caps XP at 40 for click-only
sessions. `selfExplained` tracks it client-side. Rule 9 (`NO SHALLOW WINS`) forces a freeform
generate/apply step before advancing. This is genuinely rigorous and it's the part of the product
closest to the maximum already.

Residual: the verdict is one LLM call, at end of session, reading the transcript, from the same
model family that taught it in the same house style — there's a self-grading bias, and the output is
a single scalar rather than per-concept. Transfer is measured *inside* the session that taught it,
which is the weakest possible transfer test; real transfer is measured days later on a different
surface.

---

## 6. What the maximum actually looks like, layer by layer

If tech were not a barrier — and note how little of this is actually blocked by tech:

**The learner model becomes a distribution, not a flag.** Per concept, per learner:
`P(holds the correct model)`, `P(retains at time t)`, and — the load-bearing addition — a
distribution over *which specific wrong model they hold* when they don't. The atomic unit stops
being `known ∈ {true, false}` and becomes `state ∈ {correct, misconception_A, misconception_B,
fragile, absent}`. This is the single largest structural change between here and the maximum,
because it is the plant model, and every other subsystem reads from it.

**Misconceptions become first-class registry objects, exactly like concepts.** Each carries: the
concept it attaches to, the diagnostic probe that distinguishes it from its siblings, the specific
refutation that resolves it, and the representation that refutation works best in. This reuses the
architecture you already built and proved for `concepts` — AI-tagged, search-before-create,
link-over-create on ambiguity, reconciliation pass. That pattern is already in
`assess-session/index.ts::resolveConcepts` and `reconcile-concepts`.

**Every question becomes an instrument, not a checkpoint.** Right now a question asks *did they get
it*. At the maximum, each question is selected to **maximize information gain about learner state** —
optimal experiment design. The concrete form: every MCQ distractor is the answer produced by a
*specific, named wrong model*. Then a wrong pick is not a failure to be remediated generically, it
is a **diagnosis** — the student picked the impetus-theory answer, so the tutor knows exactly which
of the five misconceptions is live and which refutation to deploy. This is how the FCI works, and it
turns your weakest sensor (2 bits from an MCQ) into your sharpest one.

**Sensing widens past the answer text.** Confidence alongside every answer costs one tap and yields
the highest-value signal in the entire system, because it splits one bit into four cells that demand
completely different responses:

| | Confident | Unsure |
|---|---|---|
| **Correct** | Mastered → advance | Fragile/lucky → consolidate, don't advance |
| **Wrong** | **Misconception** → refute, highest priority | Gap → teach |

Today all four collapse to "right/wrong". *Wrong-and-confident* is the dangerous cell — it's an
active wrong model, not an absence — and it is currently indistinguishable from a guess. Latency is
a second free signal: a long pause before a correct answer is a fragility marker.

**Scenes couple to a prediction commitment.** Your scene bar is already near-max on mechanism and
falsifiability. The gap: nothing forces the student to **commit to a prediction before the
manipulation runs**. Interaction without prior commitment is a toy; interaction *after* commitment
is a belief-updating event — the same mechanism as Muller's result, and the reason PhET simulations
produce gains under guided inquiry and not under free play. A scene that appears and can be dragged
shows the student the answer, which the prompt elsewhere correctly forbids. `predict → observe →
resolve the discrepancy` is the loop, and the discrepancy is where learning happens.

This is the answer to "should I improve the visualization engine": **yes, but structurally, not
aesthetically.** Add prediction commitment to `SceneSpec`. Don't add better shaders.

**Generation becomes the terminal test.** Novel application (loop stage 5) is not the top of the
hierarchy. Above it: can they *generate* the concept — pose the problem it solves, identify which
hypothesis is load-bearing, construct the counterexample that breaks it when you drop that
hypothesis, and explain it to someone else. Rule 8's counterfactual clause is reaching for this.
"Break it" tasks are the cheapest high-signal addition available: give them the theorem, ask which
assumption is doing the work, make them construct the failure case.

**Curriculum becomes a policy over the graph.** `planNextAction` is a clean deterministic priority
ladder — good engineering — but it is a heuristic over *sessions*. At the maximum, the next thing
you learn is chosen by expected value over the *concept graph*: the concept that unlocks the most
downstream concepts, weighted by decay risk, exam proximity, and current fragility. That requires
concept→concept edges, which is why Leak 2's missing edges matter more than they look.

---

## 7. What to build, in order

Ranked by (movement toward the maximum) ÷ (effort), against this codebase.

**1. Persist a structured per-turn record. Start today.**
Right now every session generates exactly the data needed to build everything above — which
challenge type, what the student answered, whether it was right, what the tutor diagnosed, which
concept was live, how long they took — and **throws all of it away**. `messages` stores prose;
`sessions` stores XP and a timestamp. Nothing structured survives.

This is the highest-priority item in the document and it is nearly free. Every day you run without
it is a day of unrecoverable data. At 20 users you cannot answer "which sessions worked" or "which
concepts do people fail on"; with the record, at 200 users you can. **The learner-model layer is the
moat, and its training set is being generated and discarded right now.**

**2. Make distractors diagnostic.**
A prompt change in `chat/index.ts`: every `mcq`/`multiselect` distractor must be the answer produced
by a specific named wrong model, and the tutor must emit that mapping in the choices block. Converts
the cheapest interaction in the product into the sharpest diagnostic. Days of work, not weeks.

**3. Add confidence capture to the answer UI.**
One tap next to every answer, stored on the turn record. Splits one bit into four cells (§6 table).
Feed the cell into the tutor context so `correct-but-unsure` stops triggering advancement.

**4. Split the completion verdict from the knowledge verdict.**
`assess-session` should emit per-concept judgments — `demonstrated` / `partial` / `not shown` — and
grant knowledge on the per-concept judgment, independent of whether the session hit the terminal
challenge. Keeps the strict completion bar (which is right) while stopping the systematic
understatement of the known-set (Leak 1).

**5. Misconception registry, mirroring the concept registry.**
Same schema pattern, same search-before-create, same reconciliation. Seed it from real data
collected by item 1 rather than authoring it up front — that ordering is what makes item 1 urgent.

**6. Concept→concept prerequisite edges + prerequisites derived at track generation.**
Fixes the cold start (Leak 2) and unlocks graph-based planning. `jarvis-director` already produces
the topic structure; have it emit prerequisite edges at the same time instead of waiting for a
completed session to infer them.

**7. Prediction commitment in `SceneSpec`.**
Add a `predict` field — the quantity, the prompt, the reveal moment. The Scene Director already
knows what the load-bearing invariant is (`why` field); this makes the student commit to it before
seeing it survive.

**8. Per-concept decay, replacing the permanent flag.**
Retention half-life per concept-learner pair, seeded from confidence and review outcomes. Only worth
doing after items 1–3 supply the signal to fit it against.

### What not to build

- **Video, and higher-fidelity animation.** Wrong direction for two independent reasons (§2):
  it manufactures fluency without understanding, and it is zero-adaptivity in an adaptive system.
- **More subject breadth.** Breadth multiplies a per-concept teaching quality you haven't yet
  measured. Depth in one domain until the learner model works, then breadth is nearly free.
- **A better tutor prompt.** It is already very strong and it is not the binding constraint. Returns
  here are small until the sensor improves; a better controller on a blind sensor is still blind.

---

## 8. Where the ceiling actually is

The empirical anchor for tutoring is Bloom's two-sigma result (1984): one-to-one mastery tutoring
moved average students to roughly the 98th percentile of conventionally-taught peers. The exact
magnitude is contested and later replications land lower — but the direction and rough scale hold,
and it is the right reference point.

The important thing about two sigma is that **it is the ceiling of a *human* tutor**, and human
tutors are bound by constraints a machine is not:

| Human tutor constraint | Removable by software? |
|---|---|
| Can't be there at 2am, for every student | **Yes — already removed** |
| Can't generate an arbitrary custom representation on demand | **Yes — that's the scene director** |
| Can't remember every detail across months | **Yes — that's the learner model** |
| Can't run the same probe across 10,000 students to learn what works | **Yes — that's the data flywheel** |
| **Can't see inside the student's head** | **No — this one is fundamental** |

Four of five constraints are removable, and you have removed or half-removed three of them. The
fifth is the one that binds, and it binds for humans and machines alike — but not equally.
A human tutor infers the model from sparse verbal output at maybe a few bits per minute. A machine
can instrument every response, every hesitation, every confidence rating, every prediction that
turned out wrong, across every learner who ever hit the same concept — and pool it. **That is the
one place where a machine can be structurally better than the best human tutor, rather than merely
cheaper and more available.**

So the theoretical maximum, stated finally:

> **Every minute the learner spends is spent at the exact edge of their competence, on the exact
> misconception currently blocking them, in the representation that resolves it fastest for them,
> with nothing spent on what they already know, nothing on what they aren't ready for, and nothing
> re-learning what decayed — because the system's uncertainty about their state is zero.**

That is a sensing statement. The pedagogy and the visualization engine are how you *act* on what
you sense, and both of yours are already good. The distance to the maximum is the distance between
a boolean per concept and a live model of a mind.

---

## Appendix — smaller things found while reading

Not strategy, but worth fixing:

- **`systemOverride` in `chat/index.ts` is unbounded.** Any authenticated user can POST an arbitrary
  system prompt and use your AI credits for anything. It exists so `sceneDirector.ts` can run without
  a backend deploy — reasonable trade at the time, but it should become a named-prompt allowlist
  (`{ promptId: "scene-director" }`) before user count grows.
- **`resolveConcepts` fetches the entire `concepts` table** on every session completion
  (`assess-session/index.ts:58`, no limit). Fine at 20 users; O(all concepts) per assessment later.
- **Concept dedup uses token Jaccard at threshold 0.34.** The framework doc (§7a) specifies
  embeddings, and the doc's own warning applies: "mistakes made while the dedup mechanism is weak
  become permanent data." Token overlap scores *zero* for "curl of a vector field" vs "circulation
  density" — same idea, no shared tokens. This is the one deferred item the doc itself says can't
  be deferred.
- **Abandoning a session records nothing.** `endSession` only runs on the explicit button; closing
  the tab loses the assessment entirely. The transcript survives in `messages`, so a resumable
  server-side assessment is possible — worth it, since abandoned sessions are exactly the ones whose
  data tells you where the teaching failed.
