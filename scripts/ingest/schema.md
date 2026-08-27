# Integral Arena — problem ingestion pipeline

Turns raw source material (a competition PDF, a training-notes PDF) into verified entries in
`src/features/integrals/bank/*.ts`, at scale, without weakening the "sourced content only, every
answer numerically verified" rule this feature already lives by.

Division of labour:

- **Gemini (or you by hand) transcribes.** Given a source PDF, produce one JSON object per
  problem, in the exact shape below. This step is pure transcription/derivation — the closed-form
  answer should be *worked out*, from the real problem in the document, not invented.
- **`ingest.mjs` verifies and inserts.** It re-runs the exact same numeric checks
  `problems.test.ts` runs on every shipped problem (derivative-matches-integrand for indefinite,
  quadrature-matches-value for definite), rejects anything that doesn't check out or that
  duplicates an existing entry, and only writes the survivors into the right bank file. A
  transcription mistake becomes a rejected candidate, never a shipped wrong answer.

Nothing here relaxes the "no invented problems" rule — the pipeline verifies *correctness*, not
*provenance*. Provenance (is this a real problem from a real document) is still on whoever fills
in the `source` field and is expected to be checked against the actual PDF text, the same as every
manual addition so far in this project's history.

## 1. Candidate JSON shape

One file, a JSON array of objects shaped like this (matches `Problem` in
`src/features/integrals/types.ts`, plus one extra field, `bankFile`):

```jsonc
{
  // Unique, kebab-case, prefixed by technique for readability (grep bank/ for collisions).
  "id": "ukbee-2019-t-sub-4",

  "kind": "definite", // or "indefinite"

  // The integrand as LaTeX, no ∫ or dx — the UI wraps it.
  "integrand": "\\frac{\\sin x}{1+\\cos^2 x}",

  // The same integrand in mathjs-parseable syntax (what the grader actually evaluates).
  // Write it in terms of x even if the source problem uses a different letter.
  "integrandExpr": "sin(x)/(1+cos(x)^2)",

  // Definite problems only. LaTeX, rendered on the sign.
  "lower": "0",
  "upper": "pi",

  // The antiderivative (indefinite) or exact value (definite), in the same relaxed syntax
  // students type — see FUNCTIONS whitelist and normalize() in answer.ts for what's accepted.
  "answer": "-atan(cos(x))",
  "answerLatex": "-\\arctan(\\cos x)",

  // Where the grader is allowed to sample: an interval where the integrand AND the answer are
  // real, finite, and free of poles. For definite problems with infinite bounds use domain
  // matching lower/upper as JSON Infinity, e.g. [0, null] is NOT valid JSON — use a huge finite
  // number's worth of margin instead, i.e. write domain as [0, Infinity] only if your JSON
  // parser/tool supports it (this pipeline's verifier does: Infinity/-Infinity are handled).
  "domain": [0, 3.14159],

  "difficulty": 3, // 1 (warm-up) .. 5 (brutal)

  // Primary technique first — that's the one training mode files it under. Must be a real
  // TechniqueId from src/features/integrals/types.ts.
  "techniques": ["t-sub"],

  // Which bank/*.ts file this belongs in (just the filename, e.g. "tSub.ts"). Pick the file that
  // already matches the primary technique — see the list at the bottom of this doc.
  "bankFile": "tSub.ts",

  // Real provenance. Use the actual competition/document name, year, and round/section if the
  // source gives one. Never guess — if you can't confidently attribute it, use
  // {"name": "original"} and say so rather than inventing a citation.
  "source": { "name": "UK University Integration Bee", "year": 2019, "round": "Round 1, Q4" },

  // Progressive hints, weakest first.
  "hints": ["Try t = tan(x/2)."],

  // The worked solution, revealed after a solve/give-up. Each entry is one LaTeX-in-prose line.
  "steps": ["With t=\\tan(x/2), ... ", "..."]
}
```

Notes:
- `hints` and `steps` are required (non-empty) — the bank's own test suite checks this.
- If the problem needs a function mathjs doesn't know (`lambertw`, `gcd`, etc.), still submit it —
  the ingester will flag it as needing registration in `answer.ts`'s `FUNCTIONS` whitelist rather
  than silently failing. It just won't verify until that's done.
- Genuinely hard cases (nested radicals, iterated integrals, sums-to-infinity, continued
  fractions) should be pre-reduced to an ordinary closed form before transcription — see the
  "Nothing gets dropped" section of `src/features/integrals/CLAUDE.md` for the standard moves
  (fixed-point equations, Cauchy's repeated-integration formula, geometric series substitution).
  If a genuinely hard case truly can't reduce, don't force a candidate for it — flag it in your
  notes instead so a human decides, exactly as the project's existing progress log does.

## 2. Known `bankFile` targets, by primary technique

| techniques[0]             | bankFile                    |
|----------------------------|------------------------------|
| power                      | standardForms.ts             |
| u-sub                      | substitution.ts               |
| parts                      | parts.ts                      |
| trig-identity              | trigIdentities.ts             |
| trig-sub                   | trigSubstitution.ts           |
| partial-fractions          | partialFractions.ts           |
| complete-square            | completingTheSquare.ts        |
| symmetry                   | definite.ts                   |
| feynman                    | feynman.ts                    |
| t-sub                      | tSub.ts                       |
| recurrence                 | recurrence.ts                  |
| inverse-integral           | inverseIntegral.ts            |
| floor-function             | floorFunction.ts              |
| beta-integrals             | betaIntegrals.ts              |
| introducing-constants      | introducingConstants.ts       |
| log-power-integrals        | logPowerIntegrals.ts          |
| reciprocal-substitution    | reciprocalSubstitution.ts     |
| gamma-function             | gammaFunction.ts              |
| zeta-series                | zetaSeries.ts                 |
| wallis-product             | wallisProduct.ts               |
| gaussian-hypersphere       | gaussianHypersphere.ts        |

A brand-new technique (not in this table) needs its `Technique` lesson entry added to
`techniques.ts`, its id added to `types.ts`, and a new `bank/<name>.ts` file created and wired
into `problems.ts` by hand first — the ingester only writes into files that already exist and are
already wired in.

## 3. Running it

```bash
# Dry run — verifies everything, writes nothing, prints a pass/fail report.
node scripts/ingest/ingest.mjs --input candidates.json --report report.json

# Once the report looks right, actually write the accepted ones into the bank.
node scripts/ingest/ingest.mjs --input candidates.json --apply

# Then, always:
npx vitest run src/features/integrals
npx eslint src/features/integrals
```

(`npm run ingest:integrals -- --input candidates.json` works the same way.)

Every rejection prints a reason — a bad answer, a duplicate, an unknown technique id, a missing
field. Fix the candidate JSON (or drop the entry, if the source problem turns out to be
unrecoverable) and re-run; nothing is ever silently dropped or silently patched.

## 4. Gemini prompt template

Use this as a starting system/user prompt when handing Gemini a source PDF (adjust the technique
list / bankFile table above to match whatever techniques the PDF's problems actually use):

> You are transcribing integration-bee practice problems from the attached PDF into a strict JSON
> schema for an automated verifier. For every problem in the document:
> 1. Read the problem exactly as printed — don't paraphrase or alter it.
> 2. Work out its closed-form answer by hand (antiderivative for an indefinite integral, exact
>    value for a definite one). If a problem reduces to something non-elementary and you cannot
>    find a real closed form, skip it and list it separately as "could not resolve" with why.
> 3. Express both the integrand and the answer in mathjs-compatible syntax (functions: sin, cos,
>    tan, sec, csc, cot, asin/acos/atan, sinh/cosh/tanh, log (=ln), exp, sqrt, abs, floor, ceil,
>    gamma, erf, pi, e — nothing else unless told otherwise), always in terms of the variable x
>    even if the source uses a different letter.
> 4. Pick the single most appropriate technique id from this list: [paste the TechniqueId union
>    from types.ts]. Put the technique that's actually the *point* of the problem first.
> 5. Fill in `source` with the real document name, year, and round/section exactly as the PDF
>    states them — never invent or guess a citation.
> 6. Write 1-3 progressive hints and 2-5 worked-solution steps, each as a short LaTeX-in-prose
>    line.
> 7. Output ONE JSON array containing one object per problem, in exactly this shape: [paste the
>    schema block from section 1 above]. No markdown fences, no commentary outside the JSON.
>
> Do not invent new problems, do not plug new numbers into a formula to create variants that
> aren't in the document, and do not guess an answer you haven't actually derived — leaving a
> problem out is always better than a wrong or fabricated entry.

Paste Gemini's JSON output into a file and run it through `ingest.mjs` as above. Because
verification happens locally against the real math (not against Gemini's own claim of
correctness), a hallucinated answer gets caught here rather than shipped — but genuinely check the
`source` fields and the transcribed integrand/bounds against the PDF yourself before running
`--apply`, since that half (is this really the problem the document contains) is the one thing the
numeric verifier can't check.
