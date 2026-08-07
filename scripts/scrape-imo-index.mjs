#!/usr/bin/env node
// Index-only ingestion of the IMO (International Mathematical Olympiad) into reference_questions —
// same non-reproduction policy as scrape-putnam-index.mjs. The IMO's official site publishes no reuse
// terms at all (bare "© International Mathematical Olympiad" footer, confirmed by fetching it directly),
// which defaults to all-rights-reserved, so this writes metadata + a link, never the problem text.
//
// Source: imo-official.org's own per-year pages (/problems/{year}/), NOT AoPS wiki — AoPS sits behind
// Cloudflare bot-protection that 403s after the first request or two from a script (confirmed while
// building this; not something to work around per this project's rules on bot-detection). The official
// site has no such gate and is the more authoritative source anyway: each year's page links a single
// "{year}_eng.pdf" problems paper, confirmed present and consistently named for 1976, 1985, 2010, 2025.
//
// Format facts baked in: the IMO has had exactly 6 problems/year (Day I: 1-3, Day II: 4-6) since 1976;
// earlier years' counts varied and aren't handled here — pass --from to go further back only once
// you've checked that year's actual problem count (see the format history on Wikipedia's IMO page).
//
// Usage:
//   node scripts/scrape-imo-index.mjs [--from 1976] [--to <current year>] --token <admin bearer JWT> [--dry-run]

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseArgs, loadEnv, fetchText, postBatch, resolveSupabaseUrl } from "./lib/ingest-common.mjs";

const SITE = "https://www.imo-official.org";
const LICENSE_NOTE =
  "Problem text © International Mathematical Olympiad — view the official problem at the source " +
  "link below; not reproduced here (the IMO publishes no reuse terms for its problem statements).";

async function discoverYearPdf(year) {
  let html;
  try {
    html = await fetchText(`${SITE}/problems/${year}/`);
  } catch {
    return null; // no page for this year — skip, don't fail the run
  }
  const m = html.match(new RegExp(`href="(/assets/documents/problems/${year}/${year}_eng\\.pdf)"`));
  return m ? `${SITE}${m[1]}` : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadEnv();
  const dryRun = !!args["dry-run"];
  const supabaseUrl = resolveSupabaseUrl(args, env);
  if (!dryRun && !supabaseUrl) throw new Error("No Supabase URL — pass --supabase-url or set VITE_SUPABASE_URL in .env");
  if (!dryRun && !args.token) throw new Error("--token is required (a bearer JWT for an account listed in RECONCILE_ADMIN_USER_IDS)");

  const from = Number(args.from) || 1976;
  const to = Number(args.to) || new Date().getFullYear();

  let totalInserted = 0;
  let totalSkipped = 0;
  const failures = [];
  const skippedYears = [];
  let dryRunSample = null;

  for (let year = from; year <= to; year++) {
    const pdfUrl = await discoverYearPdf(year);
    if (!pdfUrl) {
      skippedYears.push(year);
      continue;
    }

    const questions = Array.from({ length: 6 }, (_, i) => {
      const n = i + 1;
      return {
        source_competition: "IMO",
        year,
        question_number: String(n),
        subject: "Mathematics",
        topic_tags: ["IMO"],
        question_text: `IMO ${year}, Problem ${n} — view the official problem and solution at the source link below.`,
        has_diagram: false,
        source_url: pdfUrl,
        license_note: LICENSE_NOTE,
        image_base64: null,
      };
    });

    if (dryRun) {
      if (!dryRunSample) dryRunSample = questions[0];
      console.log(`${year}: 6 problems -> ${pdfUrl}`);
      continue;
    }

    try {
      const result = await postBatch({ supabaseUrl, token: args.token, questions });
      totalInserted += result.inserted || 0;
      totalSkipped += result.skipped || 0;
      console.log(`${year}: inserted ${result.inserted}, skipped ${result.skipped}`);
    } catch (e) {
      console.error(`${year} FAILED:`, e.message);
      failures.push({ year, reason: e.message });
    }
  }

  if (dryRun) {
    console.log(`\nSkipped years (no page/pdf found): ${skippedYears.join(", ") || "none"}`);
    console.log("--- sample ---");
    console.log(JSON.stringify(dryRunSample, null, 2));
    return;
  }

  console.log("\n=== Done ===");
  console.log(`Inserted: ${totalInserted}, skipped (cache): ${totalSkipped}, failed years: ${failures.length}`);
  console.log(`Years with no page/pdf found: ${skippedYears.join(", ") || "none"}`);
  if (failures.length) for (const f of failures) console.log(`  ${f.year}: ${f.reason}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
