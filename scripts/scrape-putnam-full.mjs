#!/usr/bin/env node
// FULL-TEXT ingestion of Putnam problem statements (kskedlaya.org/putnam-archive/{year}.tex), replacing
// the index-only rows from scrape-putnam-index.mjs.
//
// IMPORTANT — reproduction decision: the archive's own page says problem text is "copyrighted by the
// MAA... further redistribution is subject to copyright restrictions which I am not authorized to
// waive." Shipping full text here is a deliberate, explicit call the user made after being told this —
// not an oversight. See the conversation this script was built in if that context is ever needed again.
//
// The .tex source is real, clean LaTeX (`\begin{itemize}\item[A1] ... \item[B6] ... \end{itemize}`,
// confirmed by fetching several years directly) — no OCR/vision needed, zero AI cost. Converts to the
// same markdown+KaTeX convention as scrape-step.mjs so it renders through the same (already-fixed)
// ReferenceQuestionText/MathRenderer pipeline.
//
// Usage:
//   node scripts/scrape-putnam-full.mjs --token <admin bearer JWT> [--dry-run]

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseArgs, loadEnv, fetchText, postBatch, resolveSupabaseUrl } from "./lib/ingest-common.mjs";

const ARCHIVE_URL = "https://kskedlaya.org/putnam-archive/";
const LICENSE_NOTE =
  "Problem text © Mathematical Association of America, from kskedlaya.org/putnam-archive. " +
  "Its terms note further redistribution is subject to MAA copyright restrictions.";

// --- LaTeX -> markdown+KaTeX conversion -----------------------------------------------------------

// Balanced-brace command replacement (handles nested braces correctly, unlike a flat [^}]* regex which
// truncates at the first inner "}" — e.g. \emph{$x^2$ and more} would break on a naive regex).
function replaceBalancedCommand(str, cmdNames, wrap) {
  const re = new RegExp(`\\\\(${cmdNames})\\{`, "g");
  let result = "";
  let lastIndex = 0;
  let m;
  while ((m = re.exec(str))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < str.length && depth > 0) {
      if (str[i] === "{" && str[i - 1] !== "\\") depth++;
      else if (str[i] === "}" && str[i - 1] !== "\\") depth--;
      i++;
    }
    result += str.slice(lastIndex, m.index) + wrap(m[1], str.slice(re.lastIndex, i - 1));
    lastIndex = i;
    re.lastIndex = i;
  }
  return result + str.slice(lastIndex);
}

// \begin{enumerate}\item[(a)] ... \item[(b)] ... \end{enumerate} (or roman numerals: (i), (ii), ...) ->
// blockquoted sub-parts, same visual convention STEP's scraper uses (reused by the already-fixed
// ReferenceQuestionText renderer). Peels inside-out via repeated matching so nested enumerate survives.
function convertSubparts(text) {
  const re = /\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/;
  let m;
  while ((m = text.match(re))) {
    const parts = m[1].split(/\\item\[(\([a-z]+\))\]/i).slice(1);
    let rendered = "\n\n";
    for (let i = 0; i < parts.length; i += 2) {
      const marker = parts[i];
      const content = (parts[i + 1] || "").trim();
      rendered += `> **${marker}** ${content}\n\n`;
    }
    text = text.slice(0, m.index) + rendered + text.slice(m.index + m[0].length);
  }
  return text;
}

// \[ ... \] -> its own $$ paragraph, content preserved verbatim (matrices, etc. pass through untouched
// — KaTeX handles them natively).
function convertDisplayMath(text) {
  return text.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `\n\n$$\n${inner.trim()}\n$$\n\n`);
}

// align/align*/eqnarray/eqnarray* -> $$\begin{aligned}...\end{aligned}$$ — KaTeX doesn't know the AMS
// align environments directly, but does support aligned. Internal newlines/alignment markers (&, \\)
// are preserved verbatim; the surrounding $$ paragraph-protection already handles keeping them intact.
function convertAlignEnvironments(text) {
  return text.replace(
    /\\begin\{(align|eqnarray)\*?\}([\s\S]*?)\\end\{\1\*?\}/g,
    (_, _env, inner) => `\n\n$$\n\\begin{aligned}${inner}\\end{aligned}\n$$\n\n`,
  );
}

// An inline $...$ span containing a literal newline (e.g. a matrix worked into a sentence, seen in
// Putnam 2023 B6) isn't really inline — promote it to a $$ block so it gets a paragraph of its own
// instead of being torn apart by the paragraph-splitting the renderer still does around it.
//
// Must run with every existing $$...$$ block already replaced by a placeholder (see convertBody) — a
// naive /\$([^$]+)\$/g scan doesn't know "$$" is one delimiter, not two adjacent single-$ ones, and
// matches across the boundary between two real $$ blocks (or a $$ block and a nearby $...$ span),
// producing garbled double-wrapped output. Same failure class as the ReferenceQuestionText.tsx bug this
// whole feature started from — protect-before-scan is the fix there too.
function promoteMultilineInlineMath(text) {
  return text.replace(/\$([^$]+)\$/g, (full, inner) => (inner.includes("\n") ? `\n\n$$\n${inner.trim()}\n$$\n\n` : full));
}

function convertBody(raw) {
  let text = raw;
  text = replaceBalancedCommand(text, "emph", (_, inner) => `*${inner}*`);
  text = replaceBalancedCommand(text, "textbf", (_, inner) => `**${inner}**`);
  text = convertSubparts(text);
  text = convertAlignEnvironments(text);
  text = convertDisplayMath(text);

  // Protect every $$...$$ block produced above before scanning for multi-line $...$ spans, so that scan
  // can't mistake a $$ delimiter pair for two single-$ ones (see promoteMultilineInlineMath's comment).
  const blocks = [];
  text = text.replace(/\$\$[\s\S]*?\$\$/g, (m) => {
    blocks.push(m);
    return `@@DISPLAY_MATH_${blocks.length - 1}@@`;
  });
  text = promoteMultilineInlineMath(text);
  text = text.replace(/@@DISPLAY_MATH_(\d+)@@/g, (_, i) => blocks[Number(i)]);

  // Collapse the run of literal newlines LaTeX source wraps at ~80 columns within ordinary prose into
  // single spaces — CommonMark already treats a single newline as a soft break, but this keeps the
  // stored text visually clean rather than relying on that per-renderer behaviour. $$ blocks (now
  // restored) are skipped so their internal line structure survives.
  text = text
    .split(/(\$\$[\s\S]*?\$\$)/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/([^\n])\n(?!\n)([^\n])/g, "$1 $2")))
    .join("");

  return text.trim();
}

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

  let totalInserted = 0;
  let totalUpdated = 0;
  const failures = [];

  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    try {
      const tex = await fetchText(`${ARCHIVE_URL}${year}.tex`);
      // Only top-level problem markers (letter+digit, e.g. [A1] or the pre-2000s [A--1]) — NOT the
      // parenthesized sub-part markers ([(a)], [(i)]) inside \begin{enumerate}, handled separately.
      const blocks = tex.split(/\\item\[([AB])-*(\d+)\]/).slice(1);
      const questions = [];
      for (let j = 0; j < blocks.length; j += 3) {
        const number = `${blocks[j]}${blocks[j + 1]}`;
        const bodyRaw = blocks[j + 2] || "";
        const text = convertBody(bodyRaw);
        if (!text) continue;
        questions.push({
          source_competition: "Putnam",
          year,
          question_number: number,
          subject: "Mathematics",
          topic_tags: ["Putnam"],
          question_text: text,
          has_diagram: false,
          source_url: `${ARCHIVE_URL}${year}.pdf`,
          license_note: LICENSE_NOTE,
          image_base64: null,
        });
      }

      console.log(`[${i + 1}/${years.length}] ${year}: ${questions.length} problems parsed.`);

      if (dryRun) {
        if (i === 0) {
          for (const q of questions) {
            console.log(`--- ${q.question_number} ---`);
            console.log(q.question_text);
          }
        }
        // Structural sanity check across the WHOLE corpus, not just the dumped year — an unbalanced $
        // or {} means remark-math/KaTeX will mis-parse the span (usually swallowing everything after it
        // into one broken block), cheaper to catch here than one broken render at a time in the browser.
        for (const q of questions) {
          const dollars = (q.question_text.match(/\$/g) || []).length;
          const open = (q.question_text.match(/(?<!\\)\{/g) || []).length;
          const close = (q.question_text.match(/(?<!\\)\}/g) || []).length;
          if (dollars % 2 !== 0) console.warn(`  ${year} ${q.question_number} STRUCTURAL: odd $ count (${dollars})`);
          if (open !== close) console.warn(`  ${year} ${q.question_number} STRUCTURAL: unbalanced braces ({=${open} }=${close})`);
        }
        continue;
      }

      const result = await postBatch({ supabaseUrl, token: args.token, questions });
      totalInserted += result.inserted || 0;
      totalUpdated += result.skipped || 0;
      console.log(`  -> inserted ${result.inserted}, updated ${result.skipped}`);
    } catch (e) {
      console.error(`[${i + 1}/${years.length}] ${year} FAILED:`, e.message);
      failures.push({ year, reason: e.message });
    }
  }

  if (!dryRun) {
    console.log("\n=== Done ===");
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
