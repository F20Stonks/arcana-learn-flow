#!/usr/bin/env node
// Local, one-off ingestion tool for the reference-question corpus pilot. NOT a Supabase function and
// never deployed — PDF rendering doesn't work inside the Deno edge runtime (see
// supabase/functions/_shared/specResolver.ts's unpdf note), so it happens here: every page is
// rasterized to an image and sent to the deployed ingest-reference-paper function, which reads them
// with a vision-capable model. This is deliberate, not a fallback — a real check against a scanned 2007
// STEP paper found pdf-parse's text extraction returns almost nothing (no text layer at all, just a
// photocopy), while a vision model reading the page image directly works well for both scanned and
// digitally-typeset papers, so there's no need to detect or branch on which one a given paper is.
//
// Usage:
//   node scripts/ingest-reference-paper.mjs \
//     --file "C:\path\to\paper.pdf" \
//     --competition "STEP II" --year 2007 --subject Mathematics \
//     --token <bearer JWT from an admin-listed account>
//
// --file or --url (one required). --source-url is optional provenance; if omitted with --file, a
// file:// URL is used as the cache-check key instead.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFParse } from "pdf-parse";

const RASTER_SCALE = 2.0; // legibility over payload size — confirmed legible at this scale on a real scan

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadEnv();

  const supabaseUrl = args["supabase-url"] || env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("No Supabase URL — pass --supabase-url or set VITE_SUPABASE_URL in .env");
  if (!args.token) throw new Error("--token is required (a bearer JWT for an account listed in RECONCILE_ADMIN_USER_IDS)");
  if (!args.competition) throw new Error("--competition is required, e.g. \"STEP II\"");
  if (!args.subject) throw new Error("--subject is required, e.g. Mathematics");
  if (!args.file && !args.url) throw new Error("--file or --url is required");

  let bytes;
  let sourceUrl = args["source-url"];
  if (args.file) {
    const path = resolve(args.file);
    bytes = await readFile(path);
    if (!sourceUrl) sourceUrl = `file://${path.replace(/\\/g, "/")}`;
  } else {
    const res = await fetch(args.url);
    if (!res.ok) throw new Error(`Failed to fetch ${args.url}: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    if (!sourceUrl) sourceUrl = args.url;
  }

  const parser = new PDFParse({ data: bytes });

  // Text extraction is attempted and sent along as a supplementary cross-check, but never required —
  // it comes back empty for scanned papers, which is expected, not an error.
  const parsed = await parser.getText().catch(() => ({ text: "" }));
  const rawText = parsed.text || "";
  console.log(`Extracted ${rawText.length} characters of raw text (0 is normal for a scanned paper).`);

  console.log("Rasterizing pages...");
  const screenshots = await parser.getScreenshot({ scale: RASTER_SCALE, imageBuffer: true });
  await parser.destroy();
  const pageImages = screenshots.pages.map((p) => p.data.toString("base64"));
  console.log(`Rasterized ${pageImages.length} pages.`);

  const body = {
    source_competition: args.competition,
    year: args.year ? Number(args.year) : null,
    subject: args.subject,
    source_url: sourceUrl,
    raw_text: rawText,
    page_images: pageImages,
    pdf_base64: bytes.toString("base64"),
    license_note: args["license-note"] || "Publicly available past paper; non-proprietary",
  };

  console.log("Sending to ingest-reference-paper...");
  const res = await fetch(`${supabaseUrl}/functions/v1/ingest-reference-paper`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.token}`,
    },
    body: JSON.stringify(body),
  });

  const result = await res.json();
  if (!res.ok || result.ok === false) {
    console.error("Ingestion failed:", res.status, JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log(result.fromCache
    ? `Already ingested — returned ${result.questions.length} existing questions, no AI call made.`
    : `Ingested ${result.inserted} questions.`);
  console.log(JSON.stringify(result.questions, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
