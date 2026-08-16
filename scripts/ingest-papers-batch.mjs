#!/usr/bin/env node
/**
 * Batch driver over a tree of exam PDFs. Wraps scripts/ingest-reference-paper.mjs's per-file work so a
 * folder of hundreds of papers can be ingested in one run, resumably.
 *
 * WHY A SEPARATE SCRIPT: the single-file tool takes --competition/--year/--subject by hand, which is
 * fine for one paper and unusable for a corpus. Here the metadata comes from the PATH, so nothing is
 * typed twice and nothing is guessed by the model.
 *
 * EXPECTED LAYOUT — metadata lives in the filename, hyphens inside a field, underscores between fields:
 *
 *   pdfs/<Subject>/<Board-or-Competition>/<Year>/<Board>_<Year>_<Paper>_QP.pdf   question paper
 *   pdfs/<Subject>/<Board-or-Competition>/<Year>/<Board>_<Year>_<Paper>_MS.pdf   mark scheme
 *
 *   pdfs/Mathematics/Edexcel-A-level/2019/Edexcel-A-level_2019_Paper-1_QP.pdf
 *   pdfs/Mathematics/Edexcel-A-level/2019/Edexcel-A-level_2019_Paper-1_MS.pdf
 *   pdfs/Physics/AQA-GCSE/2022/AQA-GCSE_2022_Paper-2H_QP.pdf
 *
 * The QP/MS suffix is what routes a file: QP inserts questions, MS fills solution_text on questions that
 * already exist. So QUESTION PAPERS MUST BE INGESTED BEFORE THEIR MARK SCHEMES — this script sorts QP
 * before MS within each paper automatically, so a single run over a mixed tree does the right thing.
 *
 * Anything that doesn't fit the convention goes in a manifest instead of being renamed:
 *   pdfs/manifest.csv  ->  relative_path,subject,competition,year,paper,kind
 * Manifest rows win over the filename for the files they name.
 *
 * Usage:
 *   node scripts/ingest-papers-batch.mjs --root ./pdfs --token <admin JWT> [--dry-run] [--limit N]
 *     [--only QP|MS] [--overwrite] [--concurrency 1]
 *
 * RESUME: state is kept in <root>/.ingest-state.json, keyed by file path + size. A file already recorded
 * as done is skipped without reading it. The edge function ALSO refuses to re-pay for a document it has
 * already seen (it checks source_url / solution_source_url first), so a lost state file costs a few
 * cheap round-trips, never duplicate AI spend or duplicate rows.
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, relative, basename, sep } from "node:path";
import { PDFParse } from "pdf-parse";

const RASTER_SCALE = 2.0; // matches ingest-reference-paper.mjs — legible on real scans at this scale
const STATE_FILE = ".ingest-state.json";

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
  const env = {};
  try {
    const text = await readFile(resolve(process.cwd(), ".env"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* .env is optional if the vars are already exported */
  }
  return { ...env, ...process.env };
}

/** Every .pdf under root, depth-first. */
async function walkPdfs(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walkPdfs(full, acc);
    else if (entry.name.toLowerCase().endsWith(".pdf")) acc.push(full);
  }
  return acc;
}

/**
 * Derive metadata from the path. Returns null (with a reason) rather than guessing, so a misnamed file
 * is reported instead of being silently ingested under a wrong competition or year.
 */
function metaFromPath(root, file) {
  const rel = relative(root, file);
  const parts = rel.split(sep);
  const name = basename(file, ".pdf");
  const fields = name.split("_");
  const kindRaw = fields[fields.length - 1]?.toUpperCase();

  if (kindRaw !== "QP" && kindRaw !== "MS") {
    return { error: `filename must end in _QP or _MS (got "${name}")` };
  }
  if (parts.length < 4) {
    return { error: `expected <Subject>/<Board>/<Year>/<file>.pdf, got "${rel}"` };
  }

  const [subjectDir, boardDir, yearDir] = parts;
  const year = Number(yearDir);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return { error: `directory "${yearDir}" is not a year` };
  }

  return {
    subject: subjectDir.replace(/-/g, " "),
    competition: boardDir.replace(/-/g, " "),
    year,
    paper: fields.length >= 3 ? fields[fields.length - 2].replace(/-/g, " ") : null,
    kind: kindRaw,
  };
}

/** relative_path,subject,competition,year,paper,kind — overrides the filename for the files it names. */
async function loadManifest(root) {
  const path = join(root, "manifest.csv");
  if (!existsSync(path)) return new Map();
  const text = await readFile(path, "utf8");
  const map = new Map();
  for (const [i, line] of text.split("\n").entries()) {
    const t = line.trim();
    if (!t || (i === 0 && /relative_path/i.test(t))) continue;
    const [relPath, subject, competition, year, paper, kind] = t.split(",").map((s) => (s || "").trim());
    if (!relPath) continue;
    map.set(relPath.split("/").join(sep), {
      subject,
      competition,
      year: Number(year) || null,
      paper: paper || null,
      kind: (kind || "QP").toUpperCase(),
    });
  }
  return map;
}

async function loadState(root) {
  try {
    return JSON.parse(await readFile(join(root, STATE_FILE), "utf8"));
  } catch {
    return { done: {} };
  }
}

const saveState = (root, state) =>
  writeFile(join(root, STATE_FILE), JSON.stringify(state, null, 2), "utf8");

/** Rasterize every page to base64 PNG. Vision on page images, never text extraction — see the
 *  single-file script's header for why this is unconditional rather than a fallback. */
async function rasterize(bytes) {
  const parser = new PDFParse({ data: bytes });
  const shot = await parser.getScreenshot({ scale: RASTER_SCALE });
  const pages = shot?.pages ?? [];
  const images = [];
  for (const p of pages) {
    const dataUrl = p?.dataUrl || p?.url || "";
    const m = String(dataUrl).match(/^data:image\/[a-z]+;base64,(.*)$/);
    if (m) images.push(m[1]);
  }
  let raw_text = "";
  try {
    const parsed = await parser.getText();
    raw_text = parsed?.text || "";
  } catch {
    /* scans have no text layer — expected, images are the real input */
  }
  return { images, raw_text };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

  if (!args.root) throw new Error("--root is required, e.g. --root ./pdfs");
  if (!args["dry-run"] && !args.token) throw new Error("--token is required (admin JWT) unless --dry-run");
  if (!supabaseUrl || !anonKey) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not found");

  const root = resolve(args.root);
  const manifest = await loadManifest(root);
  const state = await loadState(root);
  const files = await walkPdfs(root);

  // Resolve metadata first so naming problems are reported up front, before any AI is paid for.
  const jobs = [];
  const bad = [];
  for (const file of files) {
    const rel = relative(root, file);
    const override = manifest.get(rel);
    const meta = override ?? metaFromPath(root, file);
    if (meta.error) bad.push(`${rel}: ${meta.error}`);
    else jobs.push({ file, rel, meta });
  }

  if (bad.length) {
    console.log(`\n${bad.length} file(s) could not be understood — fix the name or add a manifest row:`);
    for (const b of bad) console.log(`  ! ${b}`);
  }

  // QP before MS, because a mark scheme can only attach to questions that already exist.
  const kindRank = (k) => (k === "QP" ? 0 : 1);
  jobs.sort(
    (a, b) =>
      String(a.meta.competition).localeCompare(String(b.meta.competition)) ||
      (a.meta.year ?? 0) - (b.meta.year ?? 0) ||
      String(a.meta.paper).localeCompare(String(b.meta.paper)) ||
      kindRank(a.meta.kind) - kindRank(b.meta.kind),
  );

  const onlyKind = typeof args.only === "string" ? args.only.toUpperCase() : null;
  const limit = args.limit ? Number(args.limit) : Infinity;

  let done = 0;
  let skipped = 0;
  const failures = [];

  console.log(`\n${jobs.length} PDF(s) understood under ${root}`);
  if (args["dry-run"]) {
    for (const j of jobs.slice(0, 40)) {
      console.log(`  ${j.meta.kind}  ${j.meta.competition} ${j.meta.year} ${j.meta.paper ?? ""}  <- ${j.rel}`);
    }
    if (jobs.length > 40) console.log(`  … and ${jobs.length - 40} more`);
    console.log("\n--dry-run: nothing sent, nothing billed.");
    return;
  }

  for (const job of jobs) {
    if (done >= limit) break;
    if (onlyKind && job.meta.kind !== onlyKind) continue;

    const info = await stat(job.file);
    const key = `${job.rel}:${info.size}`;
    if (state.done[key] && !args.overwrite) {
      skipped++;
      continue;
    }

    const label = `${job.meta.kind} ${job.meta.competition} ${job.meta.year} ${job.meta.paper ?? ""}`.trim();
    try {
      const bytes = await readFile(job.file);
      const { images, raw_text } = await rasterize(bytes);
      if (images.length === 0) throw new Error("no pages rasterized");

      const sourceUrl = `file://${job.file.split(sep).join("/")}`;
      const payload = {
        mode: job.meta.kind === "MS" ? "solutions" : "questions",
        source_competition: job.meta.competition,
        year: job.meta.year,
        subject: job.meta.subject,
        page_images: images,
        raw_text,
        source_url: sourceUrl,
        ...(args.overwrite ? { overwrite: true } : {}),
        // The PDF itself is only worth mirroring for question papers — diagrams are shown from the
        // original page, and a mark scheme is never the source of a displayed diagram.
        ...(job.meta.kind === "QP" ? { pdf_base64: bytes.toString("base64") } : {}),
      };

      const res = await fetch(`${supabaseUrl}/functions/v1/ingest-reference-paper`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.token}`,
          apikey: anonKey,
        },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));

      if (!res.ok || out.ok === false) {
        throw new Error(`${res.status} ${JSON.stringify(out.errors ?? out).slice(0, 300)}`);
      }

      if (payload.mode === "solutions") {
        const un = out.unmatched?.length ? ` UNMATCHED: ${out.unmatched.join(",")}` : "";
        const sk = out.skippedAlreadyHadSolution?.length ? ` kept: ${out.skippedAlreadyHadSolution.length}` : "";
        console.log(`  ok  ${label} — solutions filled ${out.updated ?? 0}/${out.transcribed ?? 0}${sk}${un}`);
      } else {
        console.log(`  ok  ${label} — ${out.fromCache ? "already ingested" : `${out.inserted ?? 0} questions`}`);
      }

      state.done[key] = { at: new Date().toISOString(), mode: payload.mode };
      await saveState(root, state);
      done++;
    } catch (e) {
      console.error(`  FAIL ${label} (${job.rel}): ${e.message}`);
      failures.push(job.rel);
      // Deliberately not recorded as done, so the next run retries just this file.
    }
  }

  console.log(`\nprocessed ${done}, skipped ${skipped} already done, ${failures.length} failed`);
  if (failures.length) {
    console.log("failed files (re-run to retry just these):");
    for (const f of failures) console.log(`  ${f}`);
  }
  console.log(
    "\nAFTER INGEST, two mandatory steps or new questions browse as Unclassified:\n" +
      "  SELECT * FROM reference_topic_coverage();            -- extend reference_topic_aliases for anything listed\n" +
      "  SELECT refresh_reference_question_classification();  -- rebuild the browse index",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
