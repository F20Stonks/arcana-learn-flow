# Knowledge State Tracker — Design Framework (v1)

Status: agreed design, not yet implemented. This is the "70%" version — ship this, iterate toward
the theoretical maximum through real usage. See bottom section for what's deliberately deferred.

## 1. Objective

Track which concepts a user knows, derived from session completion, so that:
- A session-generating AI can check prerequisites before teaching something new, and know what to
  skip vs. what to teach from scratch.
- The app can schedule active recall sessions on a calendar, spaced out further as retention proves
  durable.

Explicitly out of scope for v1: qualitative/partial mastery scoring, prerequisite-graph decay from
neglected reviews, per-concept review clocks, adaptive (literature-driven) scheduling.

## 2. Atomic unit: Concept

The finest grain of knowledge tracked — below "subtopic." Three flavors:
- **Notation** — symbols (∀, ∇×, etc.)
- **Terminology** — vocabulary/definitions
- **Skills** — atomic procedural ability

Concepts are **global**, not scoped per track/subject. Learning "curl operator" in a Vector Calculus
track satisfies it for a Physics track too — one shared vocabulary across the whole app.

Concepts are **AI-tagged, not hand-authored** — a human curriculum-authoring step would limit what
the platform can teach. This is the source of the deduplication problem addressed in §5.

## 3. Teaching unit: Session

A self-contained session teaches a cluster of concepts and may declare prerequisite concepts it
assumes. Exact sizing of "how much goes in one session" is a curriculum-design decision, deferred.

A concept can be taught by **more than one session** (many-to-many). Any one completed session that
teaches a concept satisfies it — there's no single canonical teaching session per concept.

## 4. Knowledge state rules

- A concept is **known** iff at least one session that teaches it has been completed.
- Known is **permanent and one-directional** for v1 — no decay, no reversion, regardless of time
  elapsed or skipped reviews. (Deliberate MVP simplification — see §7.)
- **Completion implies knowledge by construction** — enforced by session design (teach from every
  angle, deliberately preempt misunderstanding), not by the tracker. The tracker trusts completion.
- Incomplete/abandoned sessions grant nothing — none of the session's concepts become known.
- Redoing an already-completed session is a no-op for knowledge state, and does **not** schedule a
  new active recall review (see §6).

## 5. Prerequisite checking (soft-gated)

- Before a new session starts, its declared prerequisite concepts are checked against the user's
  known-concept set.
- Any unknown prerequisite triggers a **nudge**, not a block — e.g. "this assumes X, want to cover
  that first?"
- Skipping via the nudge does not retroactively grant knowledge of the skipped prerequisite — it
  stays correctly "not known" for future checks.

## 6. Active recall / spaced review

Decoupled from the prerequisite graph for v1 — reviews are for retention, they don't gate anything.

- **Recommended, not compulsory.**
- Runs at **session granularity** — one review bundles everything that session taught, rather than a
  separate clock per concept. Avoids calendar clutter from many overlapping per-concept reminders.
- **Placeholder schedule (fixed expanding intervals):** first review 1 week after session completion;
  each on-time completed review doubles the next interval (1wk → 2wk → 4wk → 8wk...). This is a
  literature-consistent default (matches the early fixed stage of SM-2 / the general spacing effect),
  not a personalized algorithm.
- A skipped or incomplete review does **not** advance the interval and does **not** penalize
  anything — it's a pure reminder system at this stage.
- Users can request an active recall session on demand via the central AI chat, independent of the
  automatic schedule.
- **Data requirement so the placeholder can be swapped later without a schema change:** store, per
  session-completion, the last-reviewed date and the current interval stage. Whatever adaptive
  algorithm replaces the doubling rule later reads the same fields.

## 7. Concept registry & deduplication (the core engineering risk)

AI-tagged, global concepts create one real risk: freeform tagging fragments the registry with
near-duplicate concepts (different wording, same meaning) — e.g. "curl operator" vs. "the curl of a
vector field" vs. "∇×" as three separate rows instead of one. If that happens, "learn it once, it's
known everywhere" silently breaks, and prerequisite checks start producing false negatives (nudging
someone to redo something they've already learned, under a different label).

Mitigation has four parts:

**a) Registry schema.** Each concept: canonical name, type (notation/terminology/skill), a short
definition, a list of alias strings, and (if semantic matching is used) an embedding vector.

**b) Mandatory search-before-create.** The session-generation AI has no direct "create concept" path.
It must call a "search similar concepts" step first (name/alias match, and ideally semantic
similarity) and only creates a new row after that search comes back empty or low-confidence.

**c) Decision rules for the AI** (the actual framework it operates within, not just an instruction to
"be careful"):
   - High-confidence match → link to the existing concept, don't create.
   - No close match → create a new concept, with a precise canonical name and short definition (so
     it's a good target for future searches).
   - Ambiguous match → default to **linking** over creating. A false merge is more recoverable (can
     split later) than a false new-concept (silently restarts fragmentation).

**d) Reconciliation safety net.** Because (b) and (c) won't be perfect, there needs to be a way to
find and fix duplicates that slip through — a pass that scans for high-similarity concept pairs and
either auto-merges (high confidence) or flags for review. Merging requires repointing every
reference to the duplicate (sessions that teach/require it, users' known-concept records) to the
canonical concept before removing the duplicate row.

This is the one piece that **cannot** be waved off as "iterate later" the way other polish can —
mistakes made while the dedup mechanism is weak become permanent data, not just rough edges in the
UX. v1 needs at least a minimal, even manually-triggered, version of (d).

## 8. What ships now vs. later

**Now (v1):**
- Concept registry (schema in §7a).
- Search-before-create wired as a mandatory step, with the decision rules in §7c.
- Session ↔ concept relationships: "teaches" and "requires," many-to-many.
- Permanent one-way known flag per user per concept.
- Soft-gated prerequisite nudges (§5).
- Session-granularity active recall with the fixed-doubling placeholder schedule (§6).
- On-demand recall request via chat.
- At least a minimal (manual/admin-triggerable is fine) duplicate-finding-and-merging capability.

**Later (post-MVP, iterating toward the theoretical max):**
- Literature-informed adaptive scheduling framework, replacing the doubling placeholder, using real
  performance signals from reviews.
- Fully automated reconciliation passes.
- Revisit the "permanent, never decays" knowledge rule if usage shows it's too generous (e.g.
  incorporate graph-aware decay — a prerequisite that hasn't been touched in months should maybe
  discount confidence in things built on top of it).
- In-session "do you remember this?" recall-refresher checklist for concepts learned long ago
  (belongs with future prompt work).
- Reconsider per-concept (vs. per-session) review clocks if session-level bundling turns out to be
  too coarse in practice.
