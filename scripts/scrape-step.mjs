#!/usr/bin/env node
// Deterministic, zero-AI ingestion of the entire STEP question database (stepdatabase.maths.org) into
// reference_questions. Unlike scripts/ingest-reference-paper.mjs, there is no OCR/vision step here — the
// site publishes real LaTeX source per paper (typeset by the database maintainers, not the exam board's
// original), so this script fetches it, splits it into individual questions, converts the LaTeX into the
// app's markdown+KaTeX convention (see convertBody below), and posts pre-parsed batches to the
// ingest-parsed-questions edge function (service-role writes + per-question image mirroring, no AI call).
//
// Site structure (reverse-engineered, not documented anywhere): every question's metadata (tags, a short
// summary, an "[STEP <paper> <year> Question <n> (<subject>)]" bracket, a link to its own cropped PNG, and
// a link to the FULL PAPER's .tex/.pdf) lives in one static JSON file, database_data.json. The .tex file
// is shared across every question in that paper and must be split on \begin{question}...\end{question} —
// question order in the file matches the qnumber counter (1, 2, 3, ...), which is reliable even where the
// site's own display title has a numbering typo (confirmed present for at least one 2016 paper) — so this
// script pairs by POSITION within a paper, never by parsing the question number out of a title string.
//
// Usage:
//   node scripts/scrape-step.mjs --token <bearer JWT from an admin-listed account> [--limit N] [--dry-run]

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://stepdatabase.maths.org";
const DATA_URL = `${BASE}/database/database_data.json`;

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

// --- LaTeX -> app markdown/KaTeX conversion -------------------------------------------------------

const ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

// A flat "[^}]*" regex breaks on \textit{...} etc. whenever the wrapped span contains its own nested
// braces (near-guaranteed for anything wrapping a math formula, e.g. \textit{...$\dfrac{a}{b}$...}) —
// it truncates at the FIRST inner "}" instead of the real matching one, silently corrupting everything
// after it. This does real brace-depth tracking instead.
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

export function convertBody(raw) {
  let t = raw;
  let hasDiagram = false;
  // A LaTeX control WORD ends at the first non-letter (digit, brace, backslash, punctuation, space all
  // terminate it) — regex \b is the wrong tool here because it treats digits as word characters, so
  // e.g. "\ge0" (extremely common in inequalities, no space before the digit) would never match
  // /\\ge\b/. A negative lookahead for a following letter is the correct boundary; used throughout.
  const end = "(?![a-zA-Z])";

  // Strip line comments (paper source uses "%%%%%%%%%% Q11"-style dividers between questions), but
  // never a literal escaped percent sign (\%).
  t = t.replace(/(^|[^\\])%.*$/gm, "$1");

  // Diagrams (pstricks/tikz figures or raw image includes) are never reconstructed — flag has_diagram
  // and strip the drawing commands; the original page image is mirrored separately and shown instead.
  t = t.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g, (m, inner) => {
    if (/pspicture|includegraphics|tikzpicture/.test(inner)) {
      hasDiagram = true;
      return "";
    }
    return m;
  });
  t = t.replace(/\\psset\{[^}]*\}\s*\\begin\{pspicture\*?\}[\s\S]*?\\end\{pspicture\*?\}/g, () => {
    hasDiagram = true;
    return "";
  });
  t = t.replace(/\\begin\{pspicture\*?\}[\s\S]*?\\end\{pspicture\*?\}/g, () => {
    hasDiagram = true;
    return "";
  });
  t = t.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, () => {
    hasDiagram = true;
    return "";
  });
  t = t.replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, () => {
    hasDiagram = true;
    return "";
  });

  // Decorative spacers that often sit right next to a (now-stripped) diagram.
  t = t.replace(/\$\\,\$/g, "");
  t = t.replace(/\\vspace\*?\{[^}]*\}/g, "");
  t = t.replace(/\\newpage/g, "");
  t = t.replace(/\\filbreak/g, "");
  t = t.replace(/\\noindent/g, "");

  // Sub-parts: (i)/(ii)/... blockquote convention, matching the AI-ingestion pilot's existing rendering.
  // A few papers give an item an explicit label instead of relying on the environment's auto-numbering
  // (\item[\bf (i)] rather than plain \item) — that bracket, once its own {\bf ...} wrapper is stripped,
  // is the label to use verbatim instead of auto-incrementing.
  const renderItemList = (inner, defaultLabels, startN) => {
    let n = startN;
    // A plain /\\item/ split would also match "\itemsep" (from a stray \setlength{\itemsep}{...} that
    // slipped through) as a false list-item boundary — the same end-of-control-word lookahead used
    // throughout this file guards against that.
    const items = inner.split(new RegExp(`\\\\item${end}`)).slice(1);
    const rendered = items
      .map((raw) => {
        let content = raw;
        let label;
        const bracket = content.match(/^\s*\[([^\]]*)\]/);
        if (bracket) {
          // An explicit label already carries its own formatting (usually "(a)") — don't double-wrap it.
          label = bracket[1].replace(/\\bf\b|\\rm\b|[{}]/g, "").trim();
          content = content.slice(bracket[0].length);
          return `\n\n> **${label}** ${content.trim()}`;
        }
        label = defaultLabels[n] || String(n + 1);
        n++;
        return `\n\n> **(${label})** ${content.trim()}`;
      })
      .join("");
    return rendered + "\n\n";
  };
  // A handful of questions nest one list environment inside another (a sub-part list within a
  // sub-part). The non-greedy regexes below always resolve the INNERMOST unconverted environment first
  // (there's no unconverted \end{...} between an inner \begin and its own \end once outer text is still
  // raw), so re-running the same three replacements until the text stops changing walks outside-in
  // automatically without any real nesting-aware parsing.
  let prev;
  do {
    prev = t;
    t = t.replace(/\\begin\{questionparts\}(\[(\d+)\])?([\s\S]*?)\\end\{questionparts\}/g, (_m, _b, startArg, inner) =>
      renderItemList(inner, ROMANS, startArg ? parseInt(startArg, 10) - 1 : 0)
    );
    // Generic \begin{enumerate} / \begin{itemize} fallback — itemize entries in this corpus always carry
    // an explicit \item[...] label (see renderItemList), enumerate falls back to lettered sub-parts.
    t = t.replace(/\\begin\{enumerate\}(\[[^\]]*\])?([\s\S]*?)\\end\{enumerate\}/g, (_m, _opt, inner) => renderItemList(inner, LETTERS, 0));
    t = t.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_m, inner) => renderItemList(inner, ROMANS, 0));
  } while (t !== prev);

  // Display math delimiters. Must use a function replacer — "$$" as a literal replacement string is a
  // special back-reference pattern in String.replace and silently collapses to a single "$". The
  // negative lookbehind matters: a row-break-with-spacing "\\[3mm]" contains the two-character substring
  // "\[" starting at ITS second backslash — without the lookbehind this corrupts the row separator into
  // "\$$3mm]" instead of leaving it alone.
  t = t.replace(/(?<!\\)\\\[/g, () => "$$").replace(/(?<!\\)\\\]/g, () => "$$");

  // Standalone alignment environments -> aligned inside display math (KaTeX supports \begin{aligned}).
  for (const env of ["alignat\\*?", "align\\*?", "eqnarray\\*?"]) {
    const re = new RegExp(`\\\\begin\\{${env}\\}(\\{\\d*\\})?([\\s\\S]*?)\\\\end\\{${env.replace("\\*?", "\\*?")}\\}`, "g");
    t = t.replace(re, (_m, _arg, inner) => `\n\n$$\\begin{aligned}${inner}\\end{aligned}$$\n\n`);
  }

  // Paper-specific single-letter macros (\def\d{{\rm d}} etc., defined identically in every paper's
  // preamble, extended to more letters in later years e.g. \def\C{{\rm C}}, \def\Q{{\rm Q}}) -> portable
  // KaTeX. Deliberately NOT extended to the full alphabet: several lowercase letters are real standalone
  // LaTeX accent commands with unrelated meaning (\i dotless-i, \l polish-l, \o o-slash, etc.) — only
  // letters actually confirmed used as this paper's roman-text macro are included.
  const singleLetter = {
    d: "d", e: "e", g: "g", h: "h", f: "f", p: "p", q: "q", s: "s", t: "t",
    A: "A", B: "B", C: "C", D: "D", E: "E", F: "F", G: "G", H: "H", N: "N", P: "P", Q: "Q", R: "R", S: "S", T: "T",
  };
  for (const [k, v] of Object.entries(singleLetter)) {
    t = t.replace(new RegExp(`\\\\${k}${end}`, "g"), `\\mathrm{${v}}`);
  }

  // Old-style TeX font-switch groups ({\bf ...} etc., rather than \textbf{...}) — non-nested content
  // only (no braces inside), which covers every occurrence actually seen in this corpus.
  // Same declarations, but used like a one-argument command (\rm{i}) rather than the classic
  // enclosing-brace form ({\rm i}) — a handful of papers mix both conventions for the same macro.
  t = t
    .replace(/\{\\bf\s+([^{}]*)\}/g, "**$1**")
    .replace(/\{\\em\s+([^{}]*)\}/g, "*$1*")
    .replace(/\{\\it\s+([^{}]*)\}/g, "*$1*")
    .replace(/\{\\sl\s+([^{}]*)\}/g, "*$1*")
    .replace(/\{\\rm\s+([^{}]*)\}/g, "\\mathrm{$1}")
    .replace(/\{\\cal\s+([^{}]*)\}/g, "\\mathcal{$1}")
    .replace(/\\bf\{([^{}]*)\}/g, "**$1**")
    .replace(/\\em\{([^{}]*)\}/g, "*$1*")
    .replace(/\\it\{([^{}]*)\}/g, "*$1*")
    .replace(/\\sl\{([^{}]*)\}/g, "*$1*")
    .replace(/\\rm\{([^{}]*)\}/g, "\\mathrm{$1}")
    .replace(/\\cal\{([^{}]*)\}/g, "\\mathcal{$1}")
    .replace(/\\nolinebreak/g, "")
    .replace(/\\raisemath\s*\{[^}]*\}/g, "");
  // \ensuremath{X} means "guarantee X renders as math regardless of the surrounding mode" — in this
  // corpus that's always because it sits inside a \text{}/\mbox{}/\hbox{} (real math mode would never
  // need it). Re-wrapping in $...$ rather than just unwrapping lets the \text{}-splitter below break it
  // back out of text mode correctly (dropping the $ outright left bare \mathrm{g} sitting directly in
  // text mode, which KaTeX rejects). Content is routinely itself a substituted macro call
  // (\ensuremath{\mathrm{g}}) — one level of nesting a flat regex can't see past — hence balanced match.
  t = replaceBalancedCommand(t, "ensuremath", (_cmd, content) => `$${content}$`);

  // Prose-level formatting commands that appear OUTSIDE any math span (remark-math only interprets
  // $...$/$$...$$, so a raw \textit{...} in plain prose would otherwise render literally) -> markdown.
  // These can legitimately wrap a whole sentence containing its own nested math (a full \dfrac{a}{b}),
  // so they need real balanced-brace matching, not a flat regex.
  t = replaceBalancedCommand(t, "textit|emph|textsl", (_cmd, content) => `*${content}*`);
  t = replaceBalancedCommand(t, "textbf", (_cmd, content) => `**${content}**`);
  t = replaceBalancedCommand(t, "pmb", (_cmd, content) => `\\boldsymbol{${content}}`);
  t = t
    // \mbox is used inside display math for connector words ("...\mbox{ when }x=0") — \text is the
    // real KaTeX text-mode command with identical meaning, so this must be a rename, not a strip.
    .replace(/\\mbox\s*\{/g, "\\text{")
    // \hbox is plain-TeX's version of the same "text inside math" idiom.
    .replace(/\\hbox\s*\{/g, "\\text{")
    .replace(/\\makebox(\[[^\]]*\])?\s*\{([^{}]*)\}/g, "$2");

  // (h/v)phantom is an invisible spacer — its content is never actually shown, only used to reserve
  // width/height, so nothing is lost by dropping it outright rather than trying to preserve it. That
  // matters because its content sometimes contains its OWN nested inline math ($x\ne a$) that crosses
  // the phantom's own brace boundary in a way the later \text{}-splitter can't safely untangle — instead
  // of fighting that, remove the whole span (balanced-matched, so nesting doesn't truncate it early).
  t = replaceBalancedCommand(t, "[hv]?phantom", () => "");

  // Note: \ensuremath is already unwrapped above, before this point — \tag{\ensuremath{*}} has one
  // level of nested braces that a single-level "\tag{[^}]*}" strip can't match on its own (it would stop
  // at the inner "}", leaving the outer one stranded as a genuine unbalanced brace in the output), so
  // the unwrap has to happen first.

  // Cross-reference / typesetting-only commands meaningless for a single standalone question.
  t = t
    .replace(/\\tag\s*\{[^}]*\}/g, "")
    .replace(/\\eqno\s*\([^)]*\)/g, "")
    .replace(/\\eqno\s*\{[^}]*\}/g, "")
    .replace(/\\label\s*\{[^}]*\}/g, "")
    .replace(/\\eqref\s*\{[^}]*\}/g, "")
    .replace(/\\setlength\s*\{[^}]*\}\s*\{[^}]*\}/g, "")
    .replace(/\\fontsize\s*\{[^}]*\}\s*\{[^}]*\}/g, "")
    .replace(/\\selectfont/g, "")
    .replace(/\\raisemath\s*\{[^}]*\}/g, "")
    .replace(/\\rule(\[[^\]]*\])?\s*\{[^}]*\}\s*\{[^}]*\}/g, "")
    .replace(/\\hspace\*?\s*\{[^}]*\}/g, "")
    .replace(/\\newline/g, "")
    .replace(/\\linebreak/g, "")
    .replace(/\\nolinebreak/g, "")
    .replace(/\\hfil{1,2}/g, "")
    .replace(/\\break/g, "")
    .replace(/\\tabularnewline/g, "")
    .replace(/\\par\b/g, "")
    .replace(/\\pounds/g, "£");

  // \l/\r are this-paper-only shorthand for \left(/\right) (\def\l{\left(} \def\r{\right)}), used
  // heavily enough in some papers (long chains of bracketed sub-expressions) that spelling them out
  // inline would be noise — normalize to the real commands instead of leaving the shorthand meaningless
  // outside this file's own preamble.
  t = t.replace(new RegExp(`\\\\l${end}`, "g"), "\\left(").replace(new RegExp(`\\\\r${end}`, "g"), "\\right)");
  // \ud ("upright d") and \half are undefined-in-preamble personal shorthand that still show up in a
  // few papers' bodies (a gap in the site's own re-typesetting, not this script) — same meaning as the
  // paper's own \d and a plain one-half, respectively.
  t = t.replace(new RegExp(`\\\\ud${end}`, "g"), "\\mathrm{d}").replace(new RegExp(`\\\\half${end}`, "g"), "\\tfrac{1}{2}");

  // \begin{picture}...\end{picture} is LaTeX's native (non-pstricks) diagram mode — same "never
  // reconstruct, mirror the original instead" handling as the pspicture/tikz cases above.
  t = t.replace(/\\begin\{picture\}[\s\S]*?\\end\{picture\}/g, () => {
    hasDiagram = true;
    return "";
  });

  // Inverse/hyperbolic trig functions KaTeX doesn't ship as named operators (sinh/cosh/tanh are — see
  // the KNOWN_OK whitelist below — these aren't).
  for (const fn of ["arcsin", "arccos", "arctan", "arcosh", "arsinh", "artanh", "sech", "cosech", "coth"]) {
    t = t.replace(new RegExp(`\\\\${fn}${end}`, "g"), `\\operatorname{${fn}}`);
  }

  // Last-resort catch-all: any font-switch declaration that survived the brace-scoped conversions above
  // (nested braces, or the declaration spanning to the end of its enclosing group rather than being
  // immediately followed by one) — dropped rather than left as literal "\bf" text in the rendered
  // question. Losing the emphasis on these rare stragglers is a acceptable trade for never showing raw
  // LaTeX to a student.
  t = t.replace(new RegExp(`\\\\(bf|rm|it|em|sl|cal)${end}`, "g"), "");

  t = t
    .replace(/\\bb\b/g, "\\mathbf{b}")
    .replace(/\\bc\b/g, "\\mathbf{c}")
    .replace(/\\bx\b/g, "\\mathbf{x}")
    .replace(/\\bn\b/g, "\\mathbf{n}")
    .replace(new RegExp(`\\\\low${end}`, "g"), "")
    .replace(new RegExp(`\\\\subone${end}`, "g"), "_1")
    .replace(new RegExp(`\\\\subtwo${end}`, "g"), "_2")
    .replace(new RegExp(`\\\\le${end}`, "g"), "\\leqslant")
    .replace(new RegExp(`\\\\ge${end}`, "g"), "\\geqslant")
    .replace(new RegExp(`\\\\cosec${end}`, "g"), "\\operatorname{cosec}")
    .replace(new RegExp(`\\\\Var${end}`, "g"), "\\operatorname{Var}")
    .replace(new RegExp(`\\\\var${end}`, "g"), "\\operatorname{Var}\\,")
    .replace(new RegExp(`\\\\ds${end}`, "g"), "\\displaystyle")
    .replace(new RegExp(`\\\\ts${end}`, "g"), "\\textstyle");

  // \+X is another paper-specific (undefined-in-preamble, like \ud/\half above) shorthand for a bold
  // vector, same convention as \bb/\bc/\bx/\bn.
  t = t.replace(/\\\+([a-zA-Z])/g, "\\mathbf{$1}");

  // A bare single-token \frac/\sqrt argument (valid TeX shorthand: "\frac ab" = "\frac{a}{b}") breaks
  // once that token has been substituted into a multi-token macro like \mathrm{e} above — KaTeX's
  // argument scanner grabs only the bare control word \mathrm as "the token", not \mathrm{e} as a
  // whole, leaving a dangling "{e}" and a parse error. Once substitution has produced one of these,
  // wrap both of \frac's arguments in explicit braces to restore valid two-group syntax.
  const macroArg = "\\\\(?:mathrm|operatorname)\\{[a-zA-Z]+\\}";
  const fracArg = `(?:${macroArg}|\\S)`;
  t = t.replace(new RegExp(`\\\\frac\\s*(${fracArg})\\s*(${fracArg})`, "g"), (m, a, b) => {
    if (!new RegExp(`^${macroArg}$`).test(a) && !new RegExp(`^${macroArg}$`).test(b)) return m; // untouched shorthand, leave as-is
    return `\\frac{${a}}{${b}}`;
  });

  // A handful of source questions use "$...$" for a quick inline aside INSIDE \text{...} (real LaTeX
  // supports re-entering math mode this way; KaTeX's \text does not) — split into alternating
  // \text{...} / bare-math segments instead, which KaTeX renders identically.
  t = replaceBalancedCommand(t, "text", (cmd, inner) => {
    if (!inner.includes("$")) return `\\${cmd}{${inner}}`;
    const segments = inner.split(/\$([^$]*)\$/g);
    return segments.map((seg, i) => (i % 2 === 0 ? (seg ? `\\text{${seg}}` : "") : seg)).join("");
  });

  // A doubled underscore ("d__1") is not valid TeX subscript syntax (only a single "_" triggers a
  // subscript) — a rare typo in the source itself, most plausibly meaning a single subscript.
  t = t.replace(/__/g, "_");

  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return { text: t, hasDiagram };
}

// --- Site metadata parsing -------------------------------------------------------------------------

export function parseEntryMeta(body) {
  const texHref = body.match(/class="linktex"\s+href="([^"]+)"/)?.[1] || null;
  const imgSrc = body.match(/<img src="([^"]+)"/)?.[1] || null;
  const bracket = body.match(/\[STEP\s+(I{1,3})\s+(?:(\d{4})|Specimen)\s+Question\s+([^\s(]+)\s+\(([^)]+)\)\]/);
  if (!texHref || !bracket) return null;
  const [, roman, yearStr, qNum, subjectLabel] = bracket;
  return {
    texHref,
    pngUrl: imgSrc ? new URL(imgSrc, BASE).toString() : null,
    sourceCompetition: `STEP ${roman}`,
    year: yearStr ? parseInt(yearStr, 10) : 1986, // undated bracket = the 1986 Specimen paper
    officialQNumber: qNum,
    subjectLabel: subjectLabel === "Pure" ? "Pure Mathematics" : subjectLabel,
  };
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
  return res.text();
}

async function fetchImageBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadEnv();
  const dryRun = args["dry-run"] === true;
  const supabaseUrl = args["supabase-url"] || env.VITE_SUPABASE_URL;
  if (!dryRun && !supabaseUrl) throw new Error("No Supabase URL — pass --supabase-url or set VITE_SUPABASE_URL in .env");
  if (!dryRun && !args.token) throw new Error("--token is required (a bearer JWT for an account listed in RECONCILE_ADMIN_USER_IDS)");
  const limit = args.limit ? parseInt(args.limit, 10) : Infinity;

  console.log("Fetching STEP database index...");
  const dataJson = JSON.parse(await fetchText(DATA_URL));
  const allEntries = dataJson.questions || [];
  console.log(`${allEntries.length} entries total.`);

  // Group by paper (the .tex link), preserving the JSON array's original order within each group —
  // that order tracks the question_id, which increases monotonically and is reliable even where a
  // display title has a numbering typo.
  const papers = new Map(); // texHref -> { meta: [...], entries: [...] }
  for (const entry of allEntries) {
    const meta = parseEntryMeta(entry.body || "");
    if (!meta) continue; // e.g. the "Start" landing entry, which has no paper link
    if (!papers.has(meta.texHref)) papers.set(meta.texHref, []);
    papers.get(meta.texHref).push({ entry, meta });
  }
  console.log(`Grouped into ${papers.size} papers.`);

  let paperIdx = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const failures = [];

  for (const [texHref, group] of papers) {
    if (paperIdx >= limit) break;
    paperIdx++;
    const label = texHref;
    try {
      const texText = await fetchText(`${BASE}${texHref}`);
      const blocks = texText.split(/\\begin\{question\}/).slice(1).map((b) => b.split(/\\end\{question\}/)[0]);

      if (blocks.length !== group.length) {
        console.warn(`[${paperIdx}/${papers.size}] MISMATCH ${label}: tex has ${blocks.length} questions, site lists ${group.length} — skipping paper for manual review.`);
        failures.push({ texHref, reason: `count mismatch: tex=${blocks.length} site=${group.length}` });
        continue;
      }

      const questions = [];
      for (let i = 0; i < blocks.length; i++) {
        const { entry, meta } = group[i];
        const { text, hasDiagram } = convertBody(blocks[i]);
        if (!text) continue;
        const tags = (entry.tags || []).map((s) => s.replace(/[,.]+$/, "").trim()).filter(Boolean);
        const image_base64 = meta.pngUrl && !dryRun ? await fetchImageBase64(meta.pngUrl) : null;
        questions.push({
          source_competition: meta.sourceCompetition,
          year: meta.year,
          question_number: meta.officialQNumber,
          subject: "Mathematics",
          topic_tags: [meta.subjectLabel, ...tags],
          question_text: text,
          has_diagram: hasDiagram,
          source_url: meta.pngUrl || `${BASE}${texHref}#${meta.officialQNumber}`,
          license_note: "stepdatabase.maths.org — publicly available STEP question database (no explicit license found; flagged for review before wider redistribution)",
          image_base64,
        });
      }

      console.log(`[${paperIdx}/${papers.size}] ${label}: ${questions.length} questions parsed (${questions.filter((q) => q.has_diagram).length} with diagrams).`);

      if (dryRun) {
        if (paperIdx === 1) {
          for (const q of questions) {
            console.log(`--- Q${q.question_number} (diagram=${q.has_diagram}) ---`);
            console.log(q.question_text);
          }
        }
        // Structural sanity check: an unbalanced $ or {} count means remark-math/KaTeX will mis-parse
        // the span (usually swallowing everything after it into one broken block) — cheap to catch here
        // across the whole corpus instead of one broken render at a time in the browser.
        for (const q of questions) {
          const dollars = (q.question_text.match(/\$/g) || []).length;
          // \{ and \} are literal brace CHARACTERS (e.g. \left. ...\right\} for an intentionally
          // one-sided visual bracket) — real LaTeX, not grouping syntax, and legitimately asymmetric.
          // Only bare, unescaped { / } are grouping braces that must balance.
          const open = (q.question_text.match(/(?<!\\)\{/g) || []).length;
          const close = (q.question_text.match(/(?<!\\)\}/g) || []).length;
          if (dollars % 2 !== 0) console.warn(`  Q${q.question_number} STRUCTURAL: odd $ count (${dollars})`);
          if (open !== close) console.warn(`  Q${q.question_number} STRUCTURAL: unbalanced braces ({=${open} }=${close})`);
        }
        // Flag commands remark-math/KaTeX likely can't handle, so gaps in convertBody's coverage show
        // up as a short list instead of being discovered one broken render at a time in the browser.
        const KNOWN_OK = /\\(mathrm|mathbf|operatorname|displaystyle|textstyle|text|leqslant|geqslant|frac|dfrac|tfrac|sqrt|sum|int|lim|limits|binom|pmod|bmod|gcd|det|dim|ker|deg|arg|max|min|sup|inf|sin|cos|tan|cot|sec|sinh|cosh|tanh|log|ln|exp|left|right|begin|end|cdot|cdots|ldots|dots|vdots|ddots|infty|partial|nabla|pi|theta|alpha|beta|gamma|delta|epsilon|lambda|mu|nu|sigma|omega|phi|psi|rho|tau|chi|xi|zeta|eta|kappa|Gamma|Delta|Lambda|Sigma|Omega|Phi|Psi|Theta|hat|bar|vec|dot|ddot|tilde|overline|underline|quad|qquad|times|div|pm|mp|neq|ne|leq|geq|to|approx|equiv|sim|simeq|propto|in|notin|subset|subseteq|cup|cap|emptyset|forall|exists|circ|perp|parallel|angle|triangle|Vert|vert|langle|rangle|lfloor|rfloor|lceil|rceil|choose|imath|jmath|prime|backslash|mathbb|mathcal|mathfrak|boxed|underbrace|overbrace|colon|vdash|models|big|Big|bigl|bigr|bigg|Bigg|Bigl|Bigr|biggl|biggr|phantom|vphantom|hphantom|surd|ell|aligned|rightarrow|overrightarrow|longmapsto|mapsto|Rightarrow|Leftarrow|leftarrow|iff|over|atop|above|Pi|dagger|gg|ll|lozenge|prod|not|mathstrut|tiny|scriptstyle|raisebox|dotsc|dotsb|dotsi|dotsm|boldsymbol|ast|ensuremath)\b/;
        // \\ (LaTeX row/line break) immediately followed by a letter, e.g. a pmatrix's "x\\y", is not a
        // new control word starting at the second backslash — the lookbehind stops the scanner from
        // double-counting it as a fake "\y" command.
        for (const q of questions) {
          const stray = [...q.question_text.matchAll(/(?<!\\)\\[a-zA-Z]+/g)].map((m) => m[0]).filter((c) => !KNOWN_OK.test(c));
          if (stray.length) console.warn(`  Q${q.question_number} unrecognized commands: ${[...new Set(stray)].join(", ")}`);
        }
        continue;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/ingest-parsed-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
        body: JSON.stringify({ questions }),
      });
      const result = await res.json();
      if (!res.ok || result.ok === false) {
        console.error(`[${paperIdx}/${papers.size}] ${label} FAILED:`, res.status, JSON.stringify(result));
        failures.push({ texHref, reason: `ingest failed: ${JSON.stringify(result)}` });
        continue;
      }
      totalInserted += result.inserted || 0;
      totalSkipped += result.skipped || 0;
      console.log(`  -> inserted ${result.inserted}, skipped (already present) ${result.skipped}`);
    } catch (e) {
      console.error(`[${paperIdx}/${papers.size}] ${label} ERROR:`, e.message);
      failures.push({ texHref, reason: e.message });
    }
  }

  console.log("\n=== Done ===");
  console.log(`Inserted: ${totalInserted}, skipped (cache): ${totalSkipped}, failed papers: ${failures.length}`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  ${f.texHref}: ${f.reason}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
