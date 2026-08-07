#!/usr/bin/env node
// Index-only ingestion of the Putnam competition into reference_questions — deliberately does NOT
// reproduce problem text. Kedlaya's archive (kskedlaya.org/putnam-archive/) states problem statements
// are "copyrighted by the MAA... further redistribution is subject to copyright restrictions which I
// am not authorized to waive" — so unlike scrape-step.mjs, this writes real metadata (year, problem
// number, a link to the official source) and a short non-expressive pointer as question_text, never the
// actual problem wording. Zero AI cost: everything here is deterministic string/regex parsing.
//
// Format facts baked in (confirmed by fetching the archive index directly): the archive lists per-year
// `{year}.tex`/`{year}.pdf` links from 1985 onward; Putnam has always had exactly 12 problems per year,
// A1-A6 (morning session) and B1-B6 (afternoon), so no per-problem scraping is needed to know what
// exists — only the set of years actually published needs discovering.
//
// Usage:
//   node scripts/scrape-putnam-index.mjs --token <admin bearer JWT> [--dry-run]

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseArgs, loadEnv, fetchText, postBatch, resolveSupabaseUrl } from "./lib/ingest-common.mjs";

const ARCHIVE_URL = "https://kskedlaya.org/putnam-archive/";
const PROBLEM_NUMBERS = ["A1", "A2", "A3", "A4", "A5", "A6", "B1", "B2", "B3", "B4", "B5", "B6"];
const LICENSE_NOTE =
  "Problem text © Mathematical Association of America — view the official problem at the " +
  "source link below; not reproduced here (Kedlaya's archive explicitly restricts redistribution).";

async function discoverYears() {
  const html = await fetchText(ARCHIVE_URL);
  const years = [...new Set([...html.matchAll(/"(\d{4})\.tex"/g)].map((m) => Number(m[1])))];
  return years.sort((a, b) => a - b);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadEnv();
  const dryRun = !!args["dry-run"];
  const supabaseUrl = resolveSupabaseUrl(args, env);
  if (!dryRun && !supabaseUrl) throw new Error("No Supabase URL — pass --supabase-url or set VITE_SUPABASE_URL in .env");
  if (!dryRun && !args.token) throw new Error("--token is required (a bearer JWT for an account listed in RECONCILE_ADMIN_USER_IDS)");

  const years = await discoverYears();
  console.log(`Found ${years.length} years with published .tex source: ${years[0]}–${years[years.length - 1]}`);

  const questions = [];
  for (const year of years) {
    for (const number of PROBLEM_NUMBERS) {
      questions.push({
        source_competition: "Putnam",
        year,
        question_number: number,
        subject: "Mathematics",
        topic_tags: ["Putnam"],
        question_text: `Putnam ${year}, Problem ${number} — view the official problem and solution at the source link below.`,
        has_diagram: false,
        source_url: `${ARCHIVE_URL}${year}.pdf`,
        license_note: LICENSE_NOTE,
        image_base64: null,
      });
    }
  }

  console.log(`Prepared ${questions.length} index rows (${years.length} years × 12 problems).`);

  if (dryRun) {
    console.log("--- sample ---");
    console.log(JSON.stringify(questions[0], null, 2));
    console.log(JSON.stringify(questions[questions.length - 1], null, 2));
    return;
  }

  // One batch per year (12 rows) — small enough to stay well under the function's execution limit,
  // same reasoning scrape-step.mjs used for its 4-question batches.
  let totalInserted = 0;
  let totalSkipped = 0;
  const failures = [];
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const batch = questions.slice(i * 12, i * 12 + 12);
    try {
      const result = await postBatch({ supabaseUrl, token: args.token, questions: batch });
      totalInserted += result.inserted || 0;
      totalSkipped += result.skipped || 0;
      console.log(`[${i + 1}/${years.length}] ${year}: inserted ${result.inserted}, skipped ${result.skipped}`);
    } catch (e) {
      console.error(`[${i + 1}/${years.length}] ${year} FAILED:`, e.message);
      failures.push({ year, reason: e.message });
    }
  }

  console.log("\n=== Done ===");
  console.log(`Inserted: ${totalInserted}, skipped (cache): ${totalSkipped}, failed years: ${failures.length}`);
  if (failures.length) for (const f of failures) console.log(`  ${f.year}: ${f.reason}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
