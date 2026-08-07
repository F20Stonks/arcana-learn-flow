#!/usr/bin/env node
// Breadth sweep for the syllabus-tree layer (supabase/functions/_shared/syllabusTree.ts +
// supabase/functions/author-syllabus-tree/index.ts). Companion to docs/syllabus-tree-calibration.md —
// read that first for why this matrix and what still needs a HUMAN READ afterwards.
//
// This is the same kind of exercise as scripts/ingest-reference-paper.mjs: a local, one-off harness
// that calls a DEPLOYED edge function over HTTP, never touches the DB directly, and is not itself
// deployed anywhere.
//
// Calls are made SEQUENTIALLY, not in parallel. Each row is an expensive multi-call authoring run
// (skeleton -> expand -> resolve ONE real spec document -> chunk it -> regenerate topics per chunk,
// see author-syllabus-tree/index.ts) that itself pools several AI calls internally; firing multiple
// rows at once on top of that reliably trips gateway rate limits and turns a real failure into a
// misleading one. Expect this to take a while — that is the cost of a run that means something, not
// a bug.
//
// Usage:
//   node scripts/sweep-syllabus-trees.mjs [--token <bearer JWT>] [--supabase-url <url>] [--out <path>]
//
// Auth: follows the same convention as scripts/ingest-reference-paper.mjs — reads VITE_SUPABASE_URL
// from arcana-learn-flow-main/.env, and a bearer token either from --token or from
// SUPABASE_AUTH_TOKEN in the environment. --token wins if both are given. There is no service-role
// bypass here on purpose: author-syllabus-tree requires a real user (requireUser/unauthorized in
// supabase/functions/_shared/auth.ts), same as any student hitting it from the app.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// CLI / env plumbing (matches scripts/ingest-reference-paper.mjs)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

async function loadEnv() {
  try {
    const text = await readFile(resolve(process.cwd(), ".env"), "utf8");
    const env = {};
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// The sweep matrix
//
// Chosen to span the project's stated coverage bar (HS through undergraduate, maths AND physics,
// several boards), not just to exercise the happy path. See docs/syllabus-tree-calibration.md for
// the reasoning behind each row.
// ---------------------------------------------------------------------------

/** Plausible topic-count bands per level. A GCSE single-subject syllabus and a JEE-scale multi-subject
 *  exam legitimately differ by an order of magnitude (see MAX_TOPICS=60 and the skeleton prompt's own
 *  "15-30 A-level, 6-12 a focused module, 40-60 a full multi-subject exam" guidance in
 *  author-syllabus-tree/index.ts) — bands below mirror that guidance, widened slightly to not be
 *  brittle against reasonable model variance. { min, max } is inclusive.
 */
/**
 * Must match MIN_GROUNDED_RATIO in supabase/functions/_shared/syllabusTree.ts. Kept as a literal
 * rather than imported because that module is Deno/TypeScript and this harness is plain Node — if
 * the contract value changes, change it here too or the sweep will disagree with the function.
 */
const MIN_GROUNDED_RATIO = 0.6;

const TOPIC_BANDS = {
  GCSE: { min: 4, max: 20 },
  "A-LEVEL": { min: 8, max: 35 },
  UNDERGRADUATE: { min: 5, max: 30 },
  // JEE-style multi-subject stress case: the skeleton prompt itself targets 40-60; MAX_TOPICS hard-caps
  // at 60 (supabase/functions/_shared/syllabusTree.ts), so the band's ceiling is the contract's ceiling.
  MULTI_SUBJECT: { min: 25, max: 60 },
};

/**
 * The sweep matrix. Each row is a POST body for author-syllabus-tree, plus metadata the checker needs
 * (which topic-count band applies, whether this row is the deliberate negative case).
 */
const SWEEP_MATRIX = [
  {
    label: "AQA / A-Level / Physics",
    band: "A-LEVEL",
    body: { subject: "Physics", level: "A-Level", board: "AQA", goal: "AQA A-Level Physics" },
  },
  {
    label: "Edexcel / A-Level / Mathematics",
    band: "A-LEVEL",
    body: { subject: "Mathematics", level: "A-Level", board: "Edexcel", goal: "Edexcel A-Level Mathematics" },
  },
  {
    label: "OCR / GCSE / Physics",
    band: "GCSE",
    body: { subject: "Physics", level: "GCSE", board: "OCR", goal: "OCR GCSE Physics" },
  },
  {
    label: "AQA / GCSE / Mathematics",
    band: "GCSE",
    body: { subject: "Mathematics", level: "GCSE", board: "AQA", goal: "AQA GCSE Mathematics" },
  },
  {
    label: "IB / Diploma / Physics",
    band: "A-LEVEL",
    body: { subject: "Physics", level: "Diploma", board: "IB", goal: "IB Diploma Physics" },
  },
  {
    label: "CIE / A-Level / Further Mathematics",
    band: "A-LEVEL",
    body: { subject: "Further Mathematics", level: "A-Level", board: "CIE", goal: "CIE A-Level Further Mathematics" },
  },
  {
    label: "JEE / Undergraduate-entrance / Physics+Chemistry+Maths",
    band: "MULTI_SUBJECT",
    body: {
      subject: "Physics, Chemistry and Mathematics",
      level: "Undergraduate-entrance",
      board: "JEE",
      goal: "JEE (Physics, Chemistry, Mathematics)",
    },
  },
  {
    label: "NEGATIVE CASE: bespoke goal, no board (must NOT be cached)",
    band: "UNDERGRADUATE",
    negative: true,
    body: {
      subject: "Physics",
      level: "Undergraduate",
      board: null,
      goal: "I want to understand quantum field theory",
    },
  },
];

// ---------------------------------------------------------------------------
// Checks — everything machine-checkable. Grain quality, whether groupings are sensible, and whether
// the tree actually resembles the real syllabus are NOT checkable here; see the calibration doc.
// ---------------------------------------------------------------------------

function normTitle(s) {
  return String(s || "").trim().toLowerCase();
}

/**
 * Run every hard check against one result. Returns { pass, failures: string[] }. A row with a
 * transport/HTTP failure never reaches this — it's already a hard fail by that point.
 */
function checkRow(row, result) {
  const failures = [];

  if (result.ok !== true) {
    failures.push(`ok !== true (got ${JSON.stringify(result.ok)})`);
    // Nothing else below is meaningful without a tree — stop here.
    return { pass: false, failures };
  }

  const tree = result.tree;
  if (!tree || !Array.isArray(tree.topics)) {
    failures.push("response ok:true but tree.topics is missing/not an array");
    return { pass: false, failures };
  }

  const topics = tree.topics;
  const band = TOPIC_BANDS[row.band];
  if (band && (topics.length < band.min || topics.length > band.max)) {
    failures.push(
      `topic count ${topics.length} outside plausible band for ${row.band} [${band.min}-${band.max}]`,
    );
  }

  for (const t of topics) {
    if (!Array.isArray(t.subtopics) || t.subtopics.length === 0) {
      failures.push(`topic "${t.title}" has 0 subtopics`);
    }
  }

  const seenTopics = new Set();
  for (const t of topics) {
    const k = normTitle(t.title);
    if (seenTopics.has(k)) failures.push(`duplicate topic title: "${t.title}"`);
    seenTopics.add(k);
  }

  for (const t of topics) {
    const seenSubs = new Set();
    for (const s of t.subtopics || []) {
      const k = normTitle(s);
      if (seenSubs.has(k)) failures.push(`duplicate subtopic within "${t.title}": "${s}"`);
      seenSubs.add(k);
    }
  }

  const coverage = tree.coverage || {};
  if (coverage.verdict === "grounded" && !coverage.source_url) {
    failures.push("coverage.verdict is 'grounded' but no source_url is present (unsourced coverage claim)");
  }

  if (row.negative) {
    if (result.cached === true || result.treeId != null) {
      failures.push(
        `NEGATIVE CASE WAS CACHED (cached=${result.cached}, treeId=${JSON.stringify(result.treeId)}) — ` +
        `a bespoke goal entered the global cache, the layer's worst failure mode`,
      );
    }
    // A bespoke goal must not spend a document search/fetch/chunk pass on a tree that can never be cached.
    if (result.grounding !== "skipped") {
      failures.push(`negative case ran grounding (grounding="${result.grounding}") — wasted spend on an uncacheable tree`);
    }
  } else {
    // --- The checks that actually matter. Everything above this point can pass on a tree that was
    // --- never checked against a specification at all.
    const g = coverage.topics_grounded;
    const t = coverage.topics_total;
    if (typeof g !== "number" || typeof t !== "number") {
      failures.push("coverage is missing topics_grounded/topics_total — cannot tell how real the grounding was");
    } else {
      const ratio = t > 0 ? g / t : 0;
      if (ratio < MIN_GROUNDED_RATIO) {
        failures.push(
          `only ${g}/${t} topics (${(ratio * 100).toFixed(0)}%) resolved real spec text, ` +
          `below the ${(MIN_GROUNDED_RATIO * 100).toFixed(0)}% bar — "grounded" would be a claim about a minority of the syllabus`,
        );
      }
    }
    if (coverage.verdict !== "grounded") {
      failures.push(`coverage.verdict is "${coverage.verdict}", so this tree is NOT cacheable`);
    }
    if (result.treeId == null) {
      failures.push("treeId is null — the tree was not written to the global cache, so the next student re-authors it");
    }
  }

  return { pass: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function callOne(supabaseUrl, token, body) {
  const res = await fetch(`${supabaseUrl}/functions/v1/author-syllabus-tree`, {
    method: "POST",
    // mode:"sync" forces the grounding pass (resolve the real spec document, chunk it, regenerate
    // topics against real chunks) to run INLINE. In production that pass runs in the background after
    // the response is sent, so a default call would return a fast, deliberately ungrounded tree — and
    // a sweep that measured that would be verifying the one phase whose whole point is that it has
    // been checked against nothing.
    body: JSON.stringify({ ...body, mode: "sync" }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not JSON — most likely a 404/HTML error page from an undeployed function, or a gateway error.
    // Surface the raw text (truncated) rather than throwing, so the sweep keeps going through the
    // rest of the matrix and reports this row as a clean, informative failure.
  }

  return { httpStatus: res.status, ok: res.ok, json: parsed, rawText: parsed ? null : text.slice(0, 500) };
}

function summarizeRow(row, transport) {
  const { httpStatus, ok, json, rawText } = transport;

  if (!json) {
    return {
      label: row.label,
      httpStatus,
      transportOk: ok,
      error: `non-JSON response (endpoint likely not deployed / 404 / gateway error): ${rawText}`,
      check: { pass: false, failures: [`non-JSON response, HTTP ${httpStatus}`] },
      result: null,
    };
  }

  const check = checkRow(row, json);
  const tree = json.tree;
  const topicCount = tree?.topics?.length ?? 0;
  const subtopicCount = tree?.topics?.reduce((n, t) => n + (t.subtopics?.length || 0), 0) ?? 0;
  const verdict = tree?.coverage?.verdict ?? "(none)";
  const hasSourceUrl = Boolean(tree?.coverage?.source_url);
  const missingCount = tree?.coverage?.missing?.length ?? 0;

  return {
    label: row.label,
    httpStatus,
    transportOk: ok,
    topicCount,
    subtopicCount,
    verdict,
    hasSourceUrl,
    missingCount,
    cached: json.cached === true,
    treeId: json.treeId ?? null,
    check,
    result: json,
  };
}

function printRow(summary) {
  console.log(`\n--- ${summary.label} ---`);
  if (summary.error) {
    console.log(`  HTTP ${summary.httpStatus}: ${summary.error}`);
    console.log(`  PASS/FAIL: FAIL`);
    return;
  }
  console.log(`  HTTP ${summary.httpStatus} | topics=${summary.topicCount} subtopics=${summary.subtopicCount} ` +
    `verdict=${summary.verdict} source_url=${summary.hasSourceUrl} missing=${summary.missingCount} ` +
    `cached=${summary.cached} treeId=${summary.treeId ?? "null"}`);
  if (summary.check.pass) {
    console.log(`  PASS/FAIL: PASS`);
  } else {
    console.log(`  PASS/FAIL: FAIL`);
    for (const f of summary.check.failures) console.log(`    - ${f}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadEnv();

  const supabaseUrl = args["supabase-url"] || env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("No Supabase URL — pass --supabase-url or set VITE_SUPABASE_URL in .env");
  }

  const token = args.token || process.env.SUPABASE_AUTH_TOKEN;
  if (!token) {
    throw new Error(
      "No auth token. Pass --token <bearer JWT> or set SUPABASE_AUTH_TOKEN in the environment. " +
      "author-syllabus-tree requires a real signed-in user (requireUser in " +
      "supabase/functions/_shared/auth.ts) — there is no service-role bypass for this sweep.",
    );
  }

  const outPath = resolve(process.cwd(), args.out || "scripts/sweep-syllabus-trees-results.json");

  console.log(`Syllabus-tree breadth sweep — ${SWEEP_MATRIX.length} identities, sequential, against:`);
  console.log(`  ${supabaseUrl}/functions/v1/author-syllabus-tree`);
  console.log(`Raw results will be written to: ${outPath}\n`);

  const summaries = [];
  for (const row of SWEEP_MATRIX) {
    console.log(`Calling: ${row.label} ...`);
    let summary;
    try {
      const transport = await callOne(supabaseUrl, token, row.body);
      summary = summarizeRow(row, transport);
    } catch (e) {
      // Network-level failure (DNS, connection refused, etc.) — still a clean, informative row
      // rather than an unhandled crash that loses every result gathered so far.
      summary = {
        label: row.label,
        httpStatus: null,
        transportOk: false,
        error: `request failed: ${e instanceof Error ? e.message : String(e)}`,
        check: { pass: false, failures: [`request failed: ${e instanceof Error ? e.message : String(e)}`] },
        result: null,
      };
    }
    printRow(summary);
    summaries.push(summary);
  }

  await writeFile(
    outPath,
    JSON.stringify({ ranAt: new Date().toISOString(), supabaseUrl, matrix: SWEEP_MATRIX.map((r) => r.label), summaries }, null, 2),
    "utf8",
  );

  console.log("\n=== SUMMARY ===");
  console.log(
    ["Identity", "HTTP", "Topics", "Subtopics", "Verdict", "SrcURL", "Missing", "Cached", "Pass"]
      .join(" | "),
  );
  let anyFail = false;
  for (const s of summaries) {
    if (!s.check.pass) anyFail = true;
    console.log(
      [
        s.label,
        s.httpStatus ?? "-",
        s.topicCount ?? "-",
        s.subtopicCount ?? "-",
        s.verdict ?? "-",
        s.hasSourceUrl ?? "-",
        s.missingCount ?? "-",
        s.cached ?? "-",
        s.check.pass ? "PASS" : "FAIL",
      ].join(" | "),
    );
  }

  const passCount = summaries.filter((s) => s.check.pass).length;
  console.log(`\n${passCount}/${summaries.length} rows passed automated checks.`);
  console.log(
    "Automated PASS is NECESSARY but NOT SUFFICIENT — grain quality, topic-grouping sense, and " +
    "resemblance to the real syllabus require a HUMAN READ of the raw JSON in " + outPath +
    ". See docs/syllabus-tree-calibration.md.",
  );

  if (anyFail) {
    console.error("\nSweep FAILED: at least one row failed a hard check (see above).");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
