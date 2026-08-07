#!/usr/bin/env node
// FULL-TEXT ingestion of IMO problem statements, replacing the index-only rows from
// scrape-imo-index.mjs.
//
// IMPORTANT — reproduction decision: IMO's official site publishes no reuse terms for its problems at
// all (a bare copyright footer, no license grant). Shipping full text here is a deliberate, explicit
// call the user made after being told this — not an oversight.
//
// No LaTeX source exists for IMO the way it does for Putnam/STEP — imo-official.org only publishes
// PDFs, and AoPS wiki (which does have per-problem text) sits behind Cloudflare bot-protection that
// blocks scripted access after ~1 request (confirmed while building this; not something to work around
// per this project's rules on bot-detection). So this extracts plain text directly from the official PDF
// via pdf-parse — confirmed by hand on a real 2023 PDF to produce genuinely readable prose, just without
// LaTeX-quality typesetting (exponents/subscripts show as plain adjacent characters, not superscript/
// subscript formatting). Zero AI cost either way.
//
// Usage:
//   node scripts/scrape-imo-full.mjs [--from 1976] [--to <current year>] --token <admin bearer JWT> [--dry-run]

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { PDFParse } from "pdf-parse";
import { parseArgs, loadEnv, postBatch, resolveSupabaseUrl } from "./lib/ingest-common.mjs";

const SITE = "https://www.imo-official.org";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const LICENSE_NOTE =
  "Problem text © International Mathematical Olympiad, from imo-official.org. The IMO publishes no " +
  "explicit reuse terms for its problem statements. Extracted from the official PDF's text layer — " +
  "exponents/subscripts appear as plain characters, not typeset, since no LaTeX source is published.";

// "-- N of M --" is a PDF *page* marker, not a content boundary — in modern PDFs it happens to land
// after the last problem of a day (harmless either way), but in older ones (e.g. 1976) it lands
// mid-problem, splitting a single problem's statement across a page break. Strip it out everywhere
// rather than using it as a truncation point, or the second half of a page-split problem gets silently
// dropped.
function stripPageMarkers(text) {
  return text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, " ");
}

// Boilerplate that trails the last problem of each day (language/scoring notice, day footer, or the
// next day's date header bleeding in, since splitting only knows where a NEW problem marker starts, not
// where the real content meaningfully ends) — these DO mark a genuine end-of-content boundary, unlike
// the page marker above, so truncating at the first match is correct here.
const BOILERPLATE_MARKERS = [
  /Language:\s*English/,
  /Each problem is worth/,
  /English\s*\(eng\)/,
  /\n\s*(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday),\s*\d/,
];

function trimBoilerplate(text) {
  let cut = text.length;
  for (const re of BOILERPLATE_MARKERS) {
    const m = text.match(re);
    if (m && m.index < cut) cut = m.index;
  }
  return text.slice(0, cut).trim();
}

// Extracted text still has PDF-layout line breaks mid-sentence — join them into continuous prose. Two
// (or more) consecutive newlines are left alone (genuine paragraph breaks are rare in these problems but
// possible). Matches the newline itself, not surrounding characters — a char-pair pattern here misses
// every other break in a run of several consecutive single-newline breaks, since matched characters
// can't be reused by the next match in one global .replace() pass.
function joinWrappedLines(text) {
  return text.replace(/(?<!\n)\n(?!\n)/g, " ").replace(/[ \t]+/g, " ");
}

// This is plain prose, not markdown — escape characters CommonMark would otherwise treat as syntax
// (emphasis, links) so they render as the literal characters they are.
function escapeMarkdown(text) {
  return text.replace(/([_*`[\]])/g, "\\$1");
}

// The numbering format changed twice across IMO's history (confirmed by fetching real PDFs from several
// eras): "Problem N." (2000–present), "<year>/N." (at least 1976–1985), and a bare "N." restarting per
// day in between (at least 1990–1999) that's genuinely ambiguous to detect safely (a bare digit+period
// can appear elsewhere in wrapped text). Try the two unambiguous patterns first; only fall back to the
// bare-number pattern if nothing else matched, and only ACCEPT any pattern's result if it finds exactly
// 6 problems (IMO's problem count every year since 1976) — otherwise skip the year rather than risk
// inserting a mis-parsed or partial set.
function splitProblems(fullText, year) {
  const patterns = [/Problem\s+(\d+)\.\s*/g, new RegExp(`${year}/(\\d+)\\.\\s*`, "g"), /\n(\d)\.\s+/g];
  for (const pattern of patterns) {
    const parts = fullText.split(pattern);
    const found = [];
    for (let i = 1; i < parts.length; i += 2) found.push({ number: parts[i], raw: parts[i + 1] || "" });
    if (found.length === 6) return found;
  }
  return null;
}

async function discoverYearPdfBytes(year) {
  const pageRes = await fetch(`${SITE}/problems/${year}/`, { headers: { "User-Agent": UA } });
  if (!pageRes.ok) return null;
  const html = await pageRes.text();
  const m = html.match(new RegExp(`href="(/assets/documents/problems/${year}/${year}_eng\\.pdf)"`));
  if (!m) return null;
  const pdfRes = await fetch(`${SITE}${m[1]}`, { headers: { "User-Agent": UA } });
  if (!pdfRes.ok) return null;
  return { bytes: new Uint8Array(await pdfRes.arrayBuffer()), pdfUrl: `${SITE}${m[1]}` };
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
  let totalUpdated = 0;
  const failures = [];
  const skippedYears = [];

  for (let year = from; year <= to; year++) {
    try {
      const found = await discoverYearPdfBytes(year);
      if (!found) {
        skippedYears.push(year);
        continue;
      }

      const parser = new PDFParse({ data: found.bytes });
      const parsed = await parser.getText();
      const fullText = parsed.text || "";

      const problems = splitProblems(fullText, year);
      if (!problems) {
        console.warn(`${year}: none of the known numbering patterns found exactly 6 problems — skipping (needs manual review).`);
        skippedYears.push(year);
        continue;
      }

      const questions = problems.map(({ number, raw }) => {
        const trimmed = trimBoilerplate(stripPageMarkers(raw));
        const text = escapeMarkdown(joinWrappedLines(trimmed)).normalize("NFC");
        return {
          source_competition: "IMO",
          year,
          question_number: number,
          subject: "Mathematics",
          topic_tags: ["IMO"],
          question_text: text,
          has_diagram: false,
          source_url: found.pdfUrl,
          license_note: LICENSE_NOTE,
          image_base64: null,
        };
      }).filter((q) => q.question_text);

      console.log(`${year}: ${questions.length} problems parsed.`);

      if (dryRun) {
        if (year === from) {
          for (const q of questions) {
            console.log(`--- Problem ${q.question_number} ---`);
            console.log(q.question_text);
          }
        }
        continue;
      }

      const result = await postBatch({ supabaseUrl, token: args.token, questions });
      totalInserted += result.inserted || 0;
      totalUpdated += result.skipped || 0;
      console.log(`  -> inserted ${result.inserted}, updated ${result.skipped}`);
    } catch (e) {
      console.error(`${year} FAILED:`, e.message);
      failures.push({ year, reason: e.message });
    }
  }

  console.log(`\nYears with no page/pdf found: ${skippedYears.join(", ") || "none"}`);
  if (!dryRun) {
    console.log("=== Done ===");
    console.log(`Inserted: ${totalInserted}, updated: ${totalUpdated}, failed years: ${failures.length}`);
    if (failures.length) for (const f of failures) console.log(`  ${f.year}: ${f.reason}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
