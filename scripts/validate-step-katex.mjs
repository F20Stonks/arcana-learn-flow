#!/usr/bin/env node
// Temporary validation harness (not part of the ingestion pipeline, safe to delete after use) — actually
// RENDERS every math span convertBody produces through the real katex package (same renderer the app
// uses via rehype-katex), across the whole STEP corpus. Structural checks (balanced braces/$) catch
// gross breakage; this catches genuine KaTeX parse errors (unknown commands, malformed arguments) that
// only KaTeX itself can detect.
//
// Usage: node scripts/validate-step-katex.mjs [--limit N]

import katex from "katex";
import { convertBody, parseEntryMeta } from "./scrape-step.mjs";

const BASE = "https://stepdatabase.maths.org";

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
  return res.text();
}

function extractMathSpans(text) {
  const spans = [];
  const displayRe = /\$\$([\s\S]*?)\$\$/g;
  let m;
  while ((m = displayRe.exec(text))) spans.push({ mode: "display", src: m[1] });
  const withoutDisplay = text.replace(displayRe, "");
  const inlineRe = /\$([^$]+)\$/g;
  while ((m = inlineRe.exec(withoutDisplay))) spans.push({ mode: "inline", src: m[1] });
  return spans;
}

async function main() {
  const limit = process.argv.includes("--limit") ? parseInt(process.argv[process.argv.indexOf("--limit") + 1], 10) : Infinity;

  const dataJson = JSON.parse(await fetchText(`${BASE}/database/database_data.json`));
  const papers = new Map();
  for (const entry of dataJson.questions || []) {
    const meta = parseEntryMeta(entry.body || "");
    if (!meta) continue;
    if (!papers.has(meta.texHref)) papers.set(meta.texHref, []);
    papers.get(meta.texHref).push({ entry, meta });
  }

  let paperIdx = 0;
  let totalQuestions = 0;
  let totalSpans = 0;
  let failedSpans = 0;
  const failures = [];

  for (const [texHref, group] of papers) {
    if (paperIdx >= limit) break;
    paperIdx++;
    let texText;
    try {
      texText = await fetchText(`${BASE}${texHref}`);
    } catch {
      continue;
    }
    const blocks = texText.split(/\\begin\{question\}/).slice(1).map((b) => b.split(/\\end\{question\}/)[0]);
    if (blocks.length !== group.length) continue; // same skip rule as the real scraper

    for (let i = 0; i < blocks.length; i++) {
      const { meta } = group[i];
      const { text } = convertBody(blocks[i]);
      if (!text) continue;
      totalQuestions++;
      for (const span of extractMathSpans(text)) {
        totalSpans++;
        try {
          katex.renderToString(span.src, { throwOnError: true, strict: false, displayMode: span.mode === "display" });
        } catch (e) {
          failedSpans++;
          failures.push({ paper: texHref, question: meta.officialQNumber, mode: span.mode, src: span.src, error: e.message });
        }
      }
    }
  }

  console.log(`Papers checked: ${paperIdx}, questions: ${totalQuestions}, math spans: ${totalSpans}, KaTeX failures: ${failedSpans}`);
  if (failures.length) {
    console.log("\n--- Failures ---");
    for (const f of failures.slice(0, 40)) {
      console.log(`${f.paper} Q${f.question} [${f.mode}]: ${f.error}`);
      console.log(`  src: ${f.src.slice(0, 150)}`);
    }
    if (failures.length > 40) console.log(`... and ${failures.length - 40} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
