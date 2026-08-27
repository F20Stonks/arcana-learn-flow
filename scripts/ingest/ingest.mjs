#!/usr/bin/env node
/**
 * Ingest a batch of candidate problems (produced by Gemini or by hand from a source PDF) into
 * the Integral Arena bank.
 *
 * This script is the "safety net at scale" for src/features/integrals/CLAUDE.md's Workflow
 * section: instead of one throwaway Node script per problem, it runs the exact same
 * derivative()/quadrature() verification as problems.test.ts across a whole batch, catches
 * duplicates against the live bank, and only writes entries that pass into the right bank/*.ts
 * file. It never invents a value — every number in a candidate has to already be there, and a
 * wrong one is a rejection, not a fix.
 *
 * Usage:
 *   node scripts/ingest/ingest.mjs --input candidates.json [--apply] [--report report.json]
 *
 * Without --apply this is a dry run: it verifies everything and prints/writes a report, but
 * touches no bank file. Re-run with --apply once the report looks right.
 *
 * See scripts/ingest/schema.md for the candidate JSON shape and the Gemini prompt template.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import * as esbuild from "esbuild";
import { verifyCandidate } from "./verify.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const FEATURE_DIR = path.join(ROOT, "src/features/integrals");
const BANK_DIR = path.join(FEATURE_DIR, "bank");

function parseArgs(argv) {
  const args = { apply: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") args.input = argv[++i];
    else if (argv[i] === "--apply") args.apply = true;
    else if (argv[i] === "--report") args.report = argv[++i];
  }
  return args;
}

/** Loads normalize() from answer.ts at runtime by stripping TS types with esbuild — lets a
 *  candidate's integrandExpr/answer be written in LaTeX-ish or textbook syntax, same as a real
 *  student answer, instead of requiring pre-normalized mathjs syntax. */
async function loadNormalize() {
  const src = readFileSync(path.join(FEATURE_DIR, "answer.ts"), "utf8");
  const { code } = await esbuild.transform(src, { loader: "ts", format: "esm" });
  // Written next to node_modules (not a data: URL) so the bare "mathjs" import resolves.
  const tmpPath = path.join(__dirname, `.answer-compiled.${process.pid}.mjs`);
  writeFileSync(tmpPath, code);
  try {
    const mod = await import(pathToFileURL(tmpPath).href);
    return mod.normalize;
  } finally {
    rmSync(tmpPath, { force: true });
  }
}

function readTechniqueIds() {
  const src = readFileSync(path.join(FEATURE_DIR, "types.ts"), "utf8");
  const m = /export type TechniqueId =\s*([\s\S]*?);/.exec(src);
  if (!m) throw new Error("could not find TechniqueId union in types.ts");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function readFunctionsWhitelist() {
  const src = readFileSync(path.join(FEATURE_DIR, "answer.ts"), "utf8");
  const m = /const FUNCTIONS = new Set\(\[([\s\S]*?)\]\)/.exec(src);
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}

/** Every existing (kind, integrandExpr, lower, upper) key and every existing id, scraped as text
 *  — matches the manual "grep bank/*.ts before adding" step, not a TS compile. */
function scanBank() {
  const keys = new Map(); // dupeKey -> "file:id"
  const ids = new Map(); // id -> file
  const files = readdirSync(BANK_DIR).filter((f) => f.endsWith(".ts"));
  for (const file of files) {
    const src = readFileSync(path.join(BANK_DIR, file), "utf8");
    for (const chunk of splitTopLevelObjects(src)) {
      const id = /id:\s*"([^"]+)"/.exec(chunk)?.[1];
      const kind = /kind:\s*"(indefinite|definite)"/.exec(chunk)?.[1];
      const integrandExpr = /integrandExpr:\s*"((?:[^"\\]|\\.)*)"/.exec(chunk)?.[1];
      const lower = /\n\s*lower:\s*"((?:[^"\\]|\\.)*)"/.exec(chunk)?.[1] ?? "";
      const upper = /\n\s*upper:\s*"((?:[^"\\]|\\.)*)"/.exec(chunk)?.[1] ?? "";
      if (!id || !kind || integrandExpr === undefined) continue;
      ids.set(id, file);
      const key = `${kind}:${integrandExpr.replace(/\s+/g, "")}:${lower}:${upper}`;
      keys.set(key, `${file}#${id}`);
    }
  }
  return { keys, ids, files };
}

/** Splits a bank file's source into the text of each top-level `{ ... },` object literal in the
 *  exported array, by brace depth — robust to nested objects/arrays (source, hints, etc). */
function splitTopLevelObjects(src) {
  const start = src.indexOf("[");
  if (start === -1) return [];
  const chunks = [];
  let depth = 0;
  let objStart = -1;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        chunks.push(src.slice(objStart, i + 1));
        objStart = -1;
      }
    } else if (c === "]" && depth === 0) {
      break;
    }
  }
  return chunks;
}

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Renders one Problem as TS source, matching the existing bank files' formatting. */
function renderProblem(p) {
  const lines = [];
  lines.push(`  {`);
  lines.push(`    id: "${esc(p.id)}",`);
  lines.push(`    kind: "${p.kind}",`);
  lines.push(`    integrand: "${esc(p.integrand)}",`);
  lines.push(`    integrandExpr: "${esc(p.integrandExpr)}",`);
  if (p.kind === "definite") {
    lines.push(`    lower: "${esc(p.lower)}",`);
    lines.push(`    upper: "${esc(p.upper)}",`);
  }
  lines.push(`    answer: "${esc(p.answer)}",`);
  lines.push(`    answerLatex: "${esc(p.answerLatex)}",`);
  lines.push(`    domain: [${p.domain[0]}, ${p.domain[1]}],`);
  lines.push(`    difficulty: ${p.difficulty},`);
  lines.push(`    techniques: [${p.techniques.map((t) => `"${esc(t)}"`).join(", ")}],`);
  const src = p.source;
  const srcParts = [`name: "${esc(src.name)}"`];
  if (src.year !== undefined) srcParts.push(`year: ${src.year}`);
  if (src.round) srcParts.push(`round: "${esc(src.round)}"`);
  lines.push(`    source: { ${srcParts.join(", ")} },`);
  lines.push(`    hints: [${p.hints.map((h) => `\n      "${esc(h)}",`).join("")}\n    ],`);
  lines.push(`    steps: [${p.steps.map((s) => `\n      "${esc(s)}",`).join("")}\n    ],`);
  lines.push(`  },`);
  return lines.join("\n");
}

function insertIntoBankFile(file, renderedObjects) {
  const filePath = path.join(BANK_DIR, file);
  const src = readFileSync(filePath, "utf8");
  const closeIdx = src.lastIndexOf("];");
  if (closeIdx === -1) throw new Error(`${file}: couldn't find closing "];"`);
  const insertion = renderedObjects.join("\n") + "\n";
  const updated = src.slice(0, closeIdx) + insertion + src.slice(closeIdx);
  writeFileSync(filePath, updated);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error("Usage: node scripts/ingest/ingest.mjs --input candidates.json [--apply] [--report out.json]");
    process.exit(1);
  }
  if (!existsSync(args.input)) {
    console.error(`No such file: ${args.input}`);
    process.exit(1);
  }

  const candidates = JSON.parse(readFileSync(args.input, "utf8"));
  if (!Array.isArray(candidates)) {
    console.error("Input must be a JSON array of candidate problems.");
    process.exit(1);
  }

  const normalize = await loadNormalize();
  const techniqueIds = new Set(readTechniqueIds());
  const functions = readFunctionsWhitelist();
  const { keys: existingKeys, ids: existingIds, files: bankFiles } = scanBank();
  const bankFileSet = new Set(bankFiles);

  const accepted = [];
  const rejected = [];
  const seenInBatch = new Set();

  for (const [i, p] of candidates.entries()) {
    const tag = p.id || `candidate[${i}]`;
    const errs = [];

    if (!p.id) errs.push("missing id");
    else if (existingIds.has(p.id)) errs.push(`id "${p.id}" already exists in ${existingIds.get(p.id)}`);
    if (!p.kind || !["indefinite", "definite"].includes(p.kind)) errs.push(`invalid kind "${p.kind}"`);
    if (!p.integrand) errs.push("missing integrand (LaTeX)");
    if (!p.integrandExpr) errs.push("missing integrandExpr");
    if (!Array.isArray(p.domain) || p.domain.length !== 2) errs.push("domain must be [number, number]");
    if (!p.answer) errs.push("missing answer");
    if (!p.answerLatex) errs.push("missing answerLatex");
    if (![1, 2, 3, 4, 5].includes(p.difficulty)) errs.push(`invalid difficulty "${p.difficulty}"`);
    if (!Array.isArray(p.techniques) || p.techniques.length === 0) errs.push("missing techniques[]");
    else for (const t of p.techniques) if (!techniqueIds.has(t)) errs.push(`unknown technique id "${t}"`);
    if (!p.source?.name) errs.push("missing source.name");
    if (!Array.isArray(p.hints) || p.hints.length === 0) errs.push("missing hints[]");
    if (!Array.isArray(p.steps) || p.steps.length === 0) errs.push("missing steps[]");
    if (!p.bankFile) errs.push("missing bankFile (which bank/*.ts file this belongs in)");
    else if (!bankFileSet.has(p.bankFile)) errs.push(`unknown bankFile "${p.bankFile}" (not in bank/)`);
    if (p.kind === "definite" && (!p.lower || !p.upper)) errs.push("definite problem missing lower/upper");

    // Flag (don't reject) any function name outside the FUNCTIONS whitelist — matches the
    // runbook's "implement it like gamma/erf" playbook for lambertw/gcd-style hard cases.
    const usedNames = new Set(
      [...`${p.integrandExpr ?? ""} ${p.answer ?? ""}`.matchAll(/[a-zA-Z_][a-zA-Z0-9_]*/g)].map((m) => m[0]),
    );
    const unknownFns = [...usedNames].filter(
      (n) => /^[a-z]/.test(n) && n.length > 1 && !functions.has(n) && !["x", "pi", "e", "Infinity"].includes(n),
    );

    if (errs.length === 0) {
      try {
        const mathErrs = verifyCandidate(p, normalize);
        errs.push(...mathErrs);
      } catch (e) {
        errs.push(`verification threw: ${e.message}`);
      }
    }

    if (errs.length === 0 && p.integrandExpr) {
      const key = `${p.kind}:${p.integrandExpr.replace(/\s+/g, "")}:${p.lower ?? ""}:${p.upper ?? ""}`;
      const existing = existingKeys.get(key);
      if (existing) errs.push(`duplicate of ${existing} already in the bank`);
      else if (seenInBatch.has(key)) errs.push("duplicate of another candidate earlier in this same batch");
      else seenInBatch.add(key);
    }

    if (errs.length === 0) {
      accepted.push(p);
      if (unknownFns.length) {
        console.warn(`~ ${tag}: uses function(s) [${unknownFns.join(", ")}] not in answer.ts's FUNCTIONS ` +
          `whitelist — register them there and in problems.test.ts's fn() before this will grade live.`);
      }
    } else {
      rejected.push({ id: tag, errors: errs });
    }
  }

  console.log(`\n${accepted.length} accepted, ${rejected.length} rejected out of ${candidates.length}.\n`);
  for (const r of rejected) {
    console.log(`✗ ${r.id}`);
    for (const e of r.errors) console.log(`    - ${e}`);
  }

  if (args.report) {
    writeFileSync(args.report, JSON.stringify({ accepted: accepted.map((p) => p.id), rejected }, null, 2));
    console.log(`\nReport written to ${args.report}`);
  }

  if (!args.apply) {
    console.log(accepted.length ? "\nDry run — re-run with --apply to write these into the bank." : "\nDry run.");
    return;
  }

  const byFile = new Map();
  for (const p of accepted) {
    if (!byFile.has(p.bankFile)) byFile.set(p.bankFile, []);
    byFile.get(p.bankFile).push(renderProblem(p));
  }
  for (const [file, rendered] of byFile) {
    insertIntoBankFile(file, rendered);
    console.log(`Wrote ${rendered.length} problem(s) into bank/${file}`);
  }
  console.log(`\nNow run: npx vitest run src/features/integrals && npx eslint src/features/integrals`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
