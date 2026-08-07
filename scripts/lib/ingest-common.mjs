// Shared bits for reference_questions scrapers (scrape-step.mjs, scrape-putnam-index.mjs,
// scrape-imo-index.mjs): CLI arg parsing, .env loading, and posting to the ingest-parsed-questions
// edge function. Kept here instead of duplicated per-script now that a third scraper exists.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function parseArgs(argv) {
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

export async function loadEnv() {
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

// Several free archives (AoPS wiki in particular) 403 a bare/no-UA request but serve a normal browser
// UA fine — confirmed during research for this scraper family. Always send one.
export async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

export async function postBatch({ supabaseUrl, token, questions }) {
  const res = await fetch(`${supabaseUrl}/functions/v1/ingest-parsed-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ questions }),
  });
  const result = await res.json();
  if (!res.ok || result.ok === false) {
    throw new Error(`ingest failed: ${res.status} ${JSON.stringify(result)}`);
  }
  return result;
}

export function resolveSupabaseUrl(args, env) {
  return args["supabase-url"] || env.VITE_SUPABASE_URL;
}
