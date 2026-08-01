# Lesson plans — calibration bar and breadth sweep

Companion to `lesson-plan-layer.md`. This file exists so the layer is judged against a **written
standard set before any output was seen**, and across **breadth**, rather than by admiring whichever
generated plan happened to look good.

Two things live here:
1. **Gold plans** — hand-authored at frontier quality, deliberately chosen at the two hardest poles.
   Generated plans are graded against these, not against vibes.
2. **The breadth sweep** — the subtopic list and rubric the layer must clear before it is called done.

---

## Part 1 — Why these two gold plans

The riskiest field in the schema is `scene_beats`, because it has two opposite failure modes:
forcing a picture onto a subtopic that does not earn one (the known "irrelevant, terrible
visualisation" failure), and failing to earn one where a picture carries the whole mechanism. So the
gold plans sit at exactly those poles:

- **Rationalising the denominator** (GCSE) — purely symbolic. `scene_beats` MUST be empty.
  It also tests whether the schema forces a *fake* mechanism onto something that looks like "just a
  technique." (It does not: there is a real mechanism, and the schema surfaces it.)
- **Rank–nullity theorem** (undergraduate) — abstract, and a picture genuinely carries it.

If the schema could not express these well, the schema would be wrong. It can. Both are written out
in full below and both are usable as authoring few-shots if generated quality comes back thin.

---

### Gold plan A — "Rationalising the denominator" (GCSE Maths, any board)

```jsonc
{
  "core_idea": "Multiplying by a disguised 1 changes an expression's form without touching its value — so choose the disguise that makes the denominator's surd square itself away.",

  "prerequisites": [
    { "concept": "Square roots", "why_needed": "the whole move rests on √b·√b = b" },
    { "concept": "Expanding double brackets", "why_needed": "the conjugate step is a difference of two squares" },
    { "concept": "Equivalent fractions", "why_needed": "they must already accept that 1/2 and 2/4 are the same number" }
  ],

  "derivation_chain": [
    { "claim": "multiplying a fraction top and bottom by the same k leaves its value unchanged",
      "mechanism": "k/k is 1 whenever k ≠ 0, and multiplying by 1 is the operation that does nothing to value",
      "rests_on": "k ≠ 0",
      "counterfactual": "allow k = 0 and k/k is undefined, so the move is illegal rather than merely useless",
      "bottoms_out_at": "definition of the multiplicative identity" },

    { "claim": "a lone surd in the denominator is cleared by multiplying by that same surd",
      "mechanism": "√b is defined as the number whose square is b, so √b·√b collapses to the rational number b",
      "rests_on": "b ≥ 0, so √b exists in the reals",
      "counterfactual": "for b < 0 there is no real √b and the move does not exist here at all",
      "bottoms_out_at": "definition of a square root" },

    { "claim": "for a denominator a + √b, multiplying by a − √b clears the surd",
      "mechanism": "expanding gives a² − a√b + a√b − b: the two cross terms are equal and opposite so they cancel exactly, leaving the rational a² − b",
      "rests_on": "the cross terms being equal and opposite — which is precisely what flipping the surd's sign buys",
      "counterfactual": "multiply by a + √b instead and you get a² + 2a√b + b, still irrational — so the SIGN is doing all the work, not the multiplication",
      "bottoms_out_at": "the distributive law" }
  ],

  "misconceptions": [
    { "belief": "rationalising changes the value of the expression",
      "why_its_tempting": "the before and after look nothing alike",
      "diagnostic": "work out 1/√2 and √2/2 on a calculator — what do you notice, and why is that not a coincidence?",
      "reteach_angle": "same number wearing different clothes, exactly like 1/2 and 2/4 — nothing was added or removed, only re-dressed" },

    { "belief": "you multiply just the denominator by the conjugate",
      "why_its_tempting": "the denominator is the thing that's wrong, so all attention goes there",
      "diagnostic": "multiply ONLY the bottom of 1/(1+√2) by (1−√2). Is the result still equal to what you started with?",
      "reteach_angle": "return to the disguised 1 — it is only a disguise if BOTH parts are there; touching one half is a genuine change of value, not a rewrite" },

    { "belief": "the conjugate of a + √b is −a − √b",
      "why_its_tempting": "'conjugate' gets remembered as 'flip the sign' without recording WHICH sign",
      "diagnostic": "expand both (a+√b)(−a−√b) and (a+√b)(a−√b). Which one actually kills the surd?",
      "reteach_angle": "the sign you flip is the one attached to the surd, because the surd's cross-terms are the ones that have to cancel — derive which sign works instead of recalling it" }
  ],

  "isomorphic_cases": [
    { "setting": "clearing fractions from inside a denominator: 1/(1/2 + 1/3)",
      "mapping": "the awkward object is a fraction rather than a surd; the disguised 1 is 6/6; the denominator's awkwardness is annihilated by its own arithmetic" },
    { "setting": "dividing by a complex number: 1/(3 + 2i), multiplying by (3 − 2i)/(3 − 2i)",
      "mapping": "√b ↔ i; 'no surd downstairs' ↔ 'no i downstairs'; a² − b ↔ a² + b²; identical cross-term cancellation" }
  ],
  "shared_structure": "multiply by a disguised 1 chosen so that the awkward object in the denominator is annihilated by its own arithmetic",

  "scene_beats": [],

  "checkpoints": [
    { "id": 1, "must_demonstrate": "states, BEFORE computing, that multiplying 1/(2+√3) by (2−√3)/(2−√3) will clear the surd, and says which terms will cancel", "evidence_type": "prediction" },
    { "id": 2, "must_demonstrate": "explains in their own words why the sign flip is what makes the cross terms cancel, rather than reciting 'use the conjugate'", "evidence_type": "self_explanation" },
    { "id": 3, "must_demonstrate": "justifies that multiplying top and bottom by the same non-zero quantity cannot change the value", "evidence_type": "derivation" },
    { "id": 4, "must_demonstrate": "rationalises 5/(2√3 − 1) unaided — a coefficient on the surd, not the taught shape", "evidence_type": "novel_application" }
  ],

  "terminal_transfer": {
    "problem": "Simplify 1/(√5 + √2). Then say what you would do if the denominator were √5 + √2 + √3.",
    "why_novel": "two surds rather than rational-plus-surd, so the memorised a−√b pattern does not directly apply; the three-term extension has no taught procedure at all and can only be reached from the cancellation mechanism itself",
    "acceptable_reasoning": "must recognise the conjugate move works BECAUSE it manufactures a difference of two squares, then generalise by treating (√5+√2) as a single block against √3 and repeating the move — not by recalling a rule"
  },

  "notation": [
    { "symbol": "√b", "read_as": "the non-negative square root of b", "note": "the non-negativity matters: √(x²) is |x|, not x" }
  ],
  "common_dead_ends": [
    "expanding the numerator correctly but forgetting the denominator is now a² − b rather than a² + b",
    "stopping at a rational denominator without simplifying the resulting fraction",
    "sign slips on the middle terms, which hides the fact that they were supposed to cancel"
  ]
}
```

**Why `scene_beats` is empty and that is CORRECT:** the mechanism here is the exact cancellation of
two algebraic cross terms. Nothing about it is spatial. Any diagram would decorate the algebra rather
than carry it — the named failure mode. A generated plan that invents a scene here has failed, and
the sweep must catch that.

---

### Gold plan B — "Rank–nullity theorem" (Undergraduate Linear Algebra)

```jsonc
{
  "core_idea": "Every input direction either dies in the kernel or survives into the image — the domain's dimension is a fixed budget spent entirely on those two, with no remainder.",

  "prerequisites": [
    { "concept": "Linear map", "why_needed": "linearity is what makes kernel and image subspaces at all" },
    { "concept": "Basis and dimension", "why_needed": "the theorem is a counting argument over bases" },
    { "concept": "Linear independence", "why_needed": "the load-bearing step is an independence argument" }
  ],

  "derivation_chain": [
    { "claim": "the kernel is a subspace of the domain and the image a subspace of the codomain",
      "mechanism": "linearity closes both sets under addition and scalar multiplication, which is exactly the subspace test",
      "rests_on": "T(u+v) = Tu + Tv and T(cv) = cTv",
      "counterfactual": "for a non-linear map the zero set need not be closed under addition, and dimension counting becomes meaningless",
      "bottoms_out_at": "definition of a linear map and of a subspace" },

    { "claim": "a basis of the kernel extends to a basis of the whole domain",
      "mechanism": "any linearly independent set in a finite-dimensional space can be enlarged to a basis, and a kernel basis is such a set",
      "rests_on": "the domain is finite-dimensional",
      "counterfactual": "in infinite dimensions the extension still exists but the finite equation has nothing to say",
      "bottoms_out_at": "the basis extension theorem" },

    { "claim": "the images of the ADDED vectors span the image",
      "mechanism": "every v splits as (kernel part) + (added part); T annihilates the kernel part, so T(v) is always a combination of the added vectors' images alone",
      "rests_on": "the decomposition supplied by the extended basis",
      "counterfactual": "if they failed to span, some output would have no preimage — contradicting what 'image' means",
      "bottoms_out_at": "definition of span and of image" },

    { "claim": "those images are linearly independent",
      "mechanism": "a vanishing combination of the images puts the matching domain combination inside the kernel; but it is built only from vectors added OUTSIDE the kernel basis, so independence of the extended basis forces every coefficient to zero",
      "rests_on": "independence of the extended basis",
      "counterfactual": "if one added vector's image were dependent on the rest, that vector was already reachable via the kernel and would never have been added",
      "bottoms_out_at": "definition of linear independence" },

    { "claim": "dim(domain) = nullity + rank",
      "mechanism": "the extended basis consists of exactly (nullity) kernel vectors plus (rank) added vectors, each counted once, and together they are a basis of the domain",
      "rests_on": "every basis of a finite-dimensional space has the same size",
      "counterfactual": "without invariance of basis size the two sides could be counted differently and the equation would carry no information",
      "bottoms_out_at": "invariance of dimension" }
  ],

  "misconceptions": [
    { "belief": "rank is the number of rows or columns of the matrix",
      "why_its_tempting": "rank is computed from the array, and the array's size is the most visible number on the page",
      "diagnostic": "take the 5×5 matrix whose every entry is 1. What is its rank?",
      "reteach_angle": "rank counts independent DIRECTIONS surviving in the output, not entries in a grid — the all-ones matrix has 25 entries and one direction" },

    { "belief": "rank–nullity relates the dimensions of the domain and the codomain",
      "why_its_tempting": "it is an equation about a map, so both ends feel like they ought to appear",
      "diagnostic": "T: ℝ³ → ℝ⁷ has rank 2. What does rank–nullity tell you about the 7?",
      "reteach_angle": "the theorem is entirely a statement about how the DOMAIN's budget is spent; the codomain merely hosts the image and never enters the count" },

    { "belief": "nullity counts vectors sent to something small",
      "why_its_tempting": "'null' reads as 'nearly nothing' rather than 'exactly zero'",
      "diagnostic": "is a vector with T(v) tiny but non-zero in the kernel?",
      "reteach_angle": "the kernel is defined by an exact equation, not a magnitude — and that exactness is what makes it a subspace" }
  ],

  "isomorphic_cases": [
    { "setting": "casting a shadow: projecting 3D space onto a flat wall",
      "mapping": "kernel = the direction the light travels (entirely collapsed), image = the wall, and 3 = 1 + 2 is the theorem" },
    { "setting": "a linear scoring rule compressing a 10-field record into one number",
      "mapping": "kernel = every combination of field-edits that leaves the score untouched, image = the achievable scores, 10 = 9 + 1" }
  ],
  "shared_structure": "a fixed dimensional budget in the domain, split without remainder into what the map destroys and what it preserves",

  "scene_beats": [
    { "after_checkpoint": 2,
      "concept": "the kernel as the directions the map collapses",
      "must_show": "a 3D grid under T, with the kernel direction drawn distinctly and the image plane rendered as the surviving output",
      "must_manipulate": "drag a vector around the domain and watch its image move — then drag it ALONG the kernel direction and watch the image freeze completely",
      "falsifies": "if the kernel were trivial, no dragging direction would ever leave the output stationary; seeing it freeze is what rules that out",
      "form_hint": "transform" }
  ],

  "checkpoints": [
    { "id": 1, "must_demonstrate": "predicts, for an explicitly given map, whether the nullity is zero BEFORE computing anything", "evidence_type": "prediction" },
    { "id": 2, "must_demonstrate": "explains why the theorem constrains only the domain and says nothing about the codomain's dimension", "evidence_type": "self_explanation" },
    { "id": 3, "must_demonstrate": "derives, largely unaided, that the images of the added basis vectors are linearly independent", "evidence_type": "derivation" },
    { "id": 4, "must_demonstrate": "computes rank and nullity for a map given by a rule rather than a matrix (e.g. p ↦ p″ on polynomials of degree ≤ 3) and checks the identity", "evidence_type": "novel_application" }
  ],

  "terminal_transfer": {
    "problem": "Let T: M₂ₓ₂(ℝ) → ℝ be T(A) = trace(A). Find the rank and nullity, describe the kernel geometrically, then explain why NO linear map from M₂ₓ₂(ℝ) to ℝ can have nullity 2.",
    "why_novel": "the domain is a space of matrices rather than column vectors, so its dimension must first be identified as 4; and the last part runs the theorem backwards as a constraint on what is possible rather than forwards as a computation",
    "acceptable_reasoning": "dim domain = 4; rank ≤ 1 because the codomain is ℝ; trace is surjective so rank = 1 and nullity = 3; the kernel is the traceless matrices, a 3-dimensional hyperplane; nullity 2 would force rank 2, exceeding dim ℝ = 1, so it is impossible"
  },

  "notation": [
    { "symbol": "ker T", "read_as": "the kernel of T", "note": "a subspace of the DOMAIN — a frequent slip is placing it in the codomain" },
    { "symbol": "im T", "read_as": "the image of T", "note": "a subspace of the codomain, generally a proper one" }
  ],
  "common_dead_ends": [
    "row-reducing to find rank but then reading nullity off the wrong dimension",
    "trying to prove the theorem by example rather than by extending a kernel basis",
    "assuming a surjective map must be injective when domain and codomain happen to share a dimension"
  ]
}
```

---

## Part 2 — The breadth sweep

Per the standing quality bar, this layer ships only after a sweep — not a demo. Run the authoring
function across the list below and read every plan against the rubric. Cherry-picking a good output
is not evidence.

### Subtopic list (each chosen to stress something specific)

**Scene must be DECLINED (`scene_beats: []`) — the highest-risk category:**
1. Rationalising the denominator (GCSE Maths) — *gold plan A above*
2. Laws of indices (GCSE Maths) — pure symbolic rules
3. Significant figures and uncertainty notation (A-Level Physics) — convention, not mechanism
4. Naming conventions for organic-style formulae / SI prefixes (A-Level Physics) — pure nomenclature
5. Integration by substitution (A-Level Maths) — procedural, though it has a real chain-rule why

**Scene clearly EARNED:**
6. Rank–nullity theorem (Undergrad) — *gold plan B above*
7. The inscribed angle theorem (GCSE Maths)
8. Simple harmonic motion (A-Level Physics)
9. Magnetic force on a moving charge (A-Level Physics)
10. Argand diagrams and the geometry of complex multiplication (A-Level Further Maths)
11. Divergence and curl of a vector field (Undergrad)
12. Eigenvectors as invariant directions (A-Level Further Maths / Undergrad)

**Abstract, where the mechanism is hard to make concrete:**
13. Proof by induction (A-Level Maths)
14. Necessity vs sufficiency (A-Level Maths)
15. The epsilon–delta definition of a limit (Undergrad)
16. Entropy and the second law (Undergrad Physics)

**Coverage spread — level and board variation:**
17. Solving linear equations (GCSE Foundation) — is the plan condescending or genuinely mechanistic?
18. The photoelectric effect (A-Level Physics, AQA)
19. The photoelectric effect (A-Level Physics, OCR) — must produce a DIFFERENT signature; check the board actually shifts emphasis rather than yielding a near-duplicate
20. Lagrangian mechanics (Undergrad Physics) — top of scope

### Rubric — grade every plan on each, pass/fail

1. **Does the derivation bottom out?** Each step's `mechanism` must FORCE its `claim`, not restate
   it. *Fail example:* claim "the discriminant tells you the number of roots", mechanism "because the
   discriminant determines how many roots there are."
2. **Is `counterfactual` load-bearing?** It must name what genuinely breaks. "It would be wrong" is a
   fail; "drop that assumption and dim light would merely take longer, which it doesn't" is a pass.
3. **Are the isomorphic cases actually isomorphic AND actually distant?** Two textbook problems from
   the same chapter is a fail. The structural mapping must be stated, not implied.
4. **Are checkpoints demonstrable from a transcript?** "Understands eigenvalues" is a fail.
   "Predicts which vectors keep their direction before computing" is a pass.
5. **Is `scene_beats` correctly empty or correctly populated?** Both errors count. A populated beat
   must say what is MANIPULABLE and what it FALSIFIES — a static picture request is a fail.
6. **Is `terminal_transfer` genuinely non-templated** relative to the derivation chain?
7. **Are misconceptions real and specific to this subtopic?** Generic ones ("students confuse the
   terms") are a fail.
8. **Level appropriateness** — GCSE plans must not smuggle in undergraduate machinery, and
   undergraduate plans must not be condescending.

### The regression that matters most

After wiring, read a real session transcript and ask: **does it read as MORE scripted than before?**
The plan is a map, not a script (`lesson-plan-layer.md` §3). If the tutor starts marching through
checkpoints audibly, or announces structure to the student, that is a regression that outweighs any
gain in coverage — fix the framing in `renderPlanForTeaching()`, not by weakening the plan.
