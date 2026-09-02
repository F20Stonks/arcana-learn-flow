# Quant OA Arena

Timed replications of the online assessments quant trading firms set as their first screen —
Optiver's 80 in 8, the Flow Traders math test, Citadel's probability screen, and so on. Full scope
and format research: `docs/quant-assessment-arena-scope.md`.

## This section is deliberately isolated

**Project owner's decision: this lives in Cortexed but is built without regard to, or integration
with, the rest of it.** That is a standing constraint, not a stage it grows out of. Treat "wire
this into the main app" as out of scope unless the owner asks for it by name.

Concretely, this section does **not**:

- use `AppShell` — it has its own `components/ArenaShell.tsx`, so the study sidebar, the XP and
  streak readouts, the due-review count and the assistant palette are all absent;
- appear in the sidebar nav, or in any other feature's navigation;
- read or write `profiles.total_xp`, or any XP, level, rank or badge;
- touch `concepts`, `user_concept_knowledge`, `subtopic_reviews` or the FSRS review state;
- share the drill engine's tables (`drill_sessions`, `drill_attempts`, `drill_weak_spots`) or its
  `useDrillRun` hook;
- share the Integral Arena's grader, problem bank or progression;
- sit behind `DashboardGuard`. It uses `ProtectedRoute` — a session, not a completed onboarding or
  an approved waitlist row, because it is not part of the study funnel.

It has its own tables (`oa_runs`, `oa_section_results`, `oa_items`, and the `oa_weak_spots` view),
its own scoring, its own answer checker and its own shell.

What it *does* share is plain infrastructure that carries no product coupling: the Supabase client,
`useAuth`, the Tailwind design tokens, and `MathRenderer` for KaTeX. Those are libraries, not
integrations.

## Why the isolation is worth the duplication

- A change to the study app's progression, nav or onboarding cannot alter what a candidate sees
  mid-assessment. An eight-minute test that shifts under the user is worthless.
- The audience is different — finalists applying to trading firms, not A-level and STEP students —
  so the two products can move at their own pace without negotiating.
- If this ever becomes its own product, it lifts out whole.

The one intentional exception is a "Leave the Arena" link back to `/dashboard`, because a section
with no exit is a trap rather than an independent surface.

## Architecture

```
types.ts          The frozen contract. Module authors read it; they do not edit it.
engine/           Battery state machine, seeded RNG, answer checking, scoring, persistence.
modules/          One directory per archetype. Each exports a factory returning a ModuleSpec.
firms/            One file per firm — data, not code. registry.ts lists them.
components/       The proctor shell, instruction screen, inputs, section break, debrief.
```

A firm is a *configuration* over module engines, not a feature. Optiver's 80-in-8 and Akuna's
80-in-8 are the same module with different generator profiles; the Flow Traders math test is that
module again with `input: "choice"`. Adding a firm should be a data edit.

## Rules for anyone adding content here

1. **No LLM or AI calls at runtime, ever.** The owner will not pay per-user API costs. All
   verification happens in tests, at development time.
2. **Every question is generated. Never transcribe a real assessment question.** Real banks are
   NDA-covered. Note that this *inverts* the sourcing rule in `CLAUDE.md`, which is scoped to
   `src/features/integrals` and exists because integral problems come from real competition papers.
3. **Never call `Math.random` in a generator.** Take `rng` from `GenerateArgs`. Determinism is
   load-bearing: back-navigation, reproducible papers and the generator tests all depend on it.
4. **Compute in integers and format at the end** wherever decimals appear. `3.4 + 12.7` is
   `16.099999999999998` in floating point, and marking a correct "16.1" wrong is the worst bug this
   feature could ship.
5. **The bank grades itself.** Every generated answer is verified independently in CI — prompts
   re-parsed and re-evaluated, probability closed forms checked by Monte Carlo. Same discipline as
   `src/features/integrals/problems.test.ts`. If you cannot verify an answer, do not ship the item.
6. **`firms.test.ts` holds every firm to its own instruction screen.** If the rules promise +1/−1,
   the engine must apply +1/−1.

## Legal posture

Formats are replicated; question sets are not. Firm names are used descriptively ("Optiver-style
80 in 8"), with no logos, no brand colours, and a non-affiliation notice on the hub.
