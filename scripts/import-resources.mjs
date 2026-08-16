#!/usr/bin/env node
/**
 * Bulk-import a folder of PDFs into the resource library.
 *
 * WHY A TOKEN AND NOT A SERVICE KEY: uploads land in the `user-resources` bucket, whose storage policy
 * checks that the first path segment equals auth.uid(). That is deliberate — it is what keeps one
 * student's uploads out of another's — and it means an import has to act AS a user rather than around
 * them. Same `--token <JWT>` shape ingest-papers-batch.mjs already uses, for the same reason: no
 * service-role key is kept on disk in this repo.
 *
 * Get the token from a signed-in browser tab on the app:
 *   JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('auth-token'))[1]).access_token
 * It expires in about an hour; re-copy it if a long run stops with 401s.
 *
 * Publishing to the SHARED library additionally requires that account to hold the 'admin' role, since
 * that is what the resources insert policy checks. A non-admin token can still import privately.
 *
 * Metadata comes from the PATH so nothing is typed twice:
 *   <root>/<Subject>/<Kind>/<Title>.pdf     e.g.  corpus/Mathematics/book/Real Analysis.pdf
 * Any missing level just falls back to the flags. The title always defaults to the filename, which is
 * usually right and is easy to correct in the app afterwards.
 *
 * Usage:
 *   node scripts/import-resources.mjs --root ./corpus --token <JWT> [--visibility global|private]
 *     [--subject Mathematics] [--kind book] [--dry-run] [--limit N] [--force]
 *
 * RESUME: state lives in <root>/.import-state.json, keyed by path + size, so a re-run skips what
 * already landed. The unique index on (storage_bucket, storage_path) is the real backstop.
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join, relative, basename, extname, sep } from "node:path";
import { PDFParse } from "pdf-parse";

const STATE_FILE = ".import-state.json";
const TARGET_CHUNK = 1200;
const MIN_CHUNK = 40;
const VALID_KINDS = ["book", "past_paper", "mark_scheme", "notes", "handout", "problem_set", "other"];

function parseArgs(argv) {
  const out = { visibility: "private", kind: "book", limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (a.startsWith("--")) out[a.slice(2)] = argv[++i];
  }
  if (out.limit !== Infinity) out.limit = Number(out.limit);
  return out;
}

function env() {
  // Read straight from .env rather than requiring the caller to export anything — the same file Vite
  // already uses, so there is one source of truth for which project this points at.
  const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const get = (k) => raw.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  return { url: get("VITE_SUPABASE_URL"), anon: get("VITE_SUPABASE_PUBLISHABLE_KEY") };
}

async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, acc);
    else if (extname(entry.name).toLowerCase() === ".pdf") acc.push(p);
  }
  return acc;
}

/** Split page text into retrieval chunks. Mirrors src/lib/pdf.ts so a bulk import and an in-app upload
 *  produce the same shape — two different chunkers over one corpus would make retrieval quality depend
 *  on how a document happened to arrive. */
function splitToChunks(text) {
  const out = [];
  let current = "";
  const flush = () => {
    const t = current.trim();
    if (t.length >= MIN_CHUNK) out.push(t);
    current = "";
  };
  for (const paragraph of text.split(/\n\s*\n/)) {
    const p = paragraph.trim();
    if (!p) continue;
    if (p.length > TARGET_CHUNK) {
      flush();
      for (const s of p.split(/(?<=[a-z0-9)\]])\.\s+(?=[A-Z$\\])/)) {
        if (current.length + s.length > TARGET_CHUNK) flush();
        current += (current ? " " : "") + s;
      }
      flush();
      continue;
    }
    if (current.length + p.length > TARGET_CHUNK) flush();
    current += (current ? "\n\n" : "") + p;
  }
  flush();
  return out;
}

async function extract(bytes) {
  const parser = new PDFParse({ data: bytes });
  try {
    const parsed = await parser.getText();
    const pages = parsed?.pages ?? [];
    const chunks = [];
    if (pages.length) {
      for (const page of pages) {
        const num = page?.num ?? page?.pageNumber ?? null;
        const text = String(page?.text ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        if (text.length < MIN_CHUNK) continue;
        for (const c of splitToChunks(text)) chunks.push({ page: num, content: c });
      }
    } else {
      // No per-page breakdown available: still index, just without page citations.
      for (const c of splitToChunks(String(parsed?.text ?? ""))) chunks.push({ page: null, content: c });
    }
    return { chunks, pageCount: parsed?.total ?? pages.length ?? null };
  } catch {
    // A scan has no text layer. The document is still worth uploading — it is readable, just not
    // quotable — so this is an empty index, not a failure.
    return { chunks: [], pageCount: null };
  } finally {
    await parser.destroy?.().catch(() => {});
  }
}

/** Subject/kind from the path, falling back to the flags. */
function metaFromPath(root, file, args) {
  const parts = relative(root, file).split(sep);
  const title = basename(file, extname(file)).replace(/[_]+/g, " ").replace(/\s{2,}/g, " ").trim();
  const dirs = parts.slice(0, -1);
  const kindFromPath = dirs.find((d) => VALID_KINDS.includes(d.toLowerCase().replace(/\s+/g, "_")));
  return {
    title,
    subject: args.subject || dirs[0] || null,
    kind: kindFromPath?.toLowerCase().replace(/\s+/g, "_") || args.kind,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.root) {
    console.error("--root <dir> is required");
    process.exit(1);
  }
  if (!args.dryRun && !args.token) {
    console.error("--token <JWT> is required (or pass --dry-run to inspect first)");
    process.exit(1);
  }
  if (!VALID_KINDS.includes(args.kind)) {
    console.error(`--kind must be one of: ${VALID_KINDS.join(", ")}`);
    process.exit(1);
  }
  if (!["global", "private"].includes(args.visibility)) {
    console.error("--visibility must be global or private");
    process.exit(1);
  }

  const root = resolve(args.root);
  const { url, anon } = env();
  const files = (await walk(root)).slice(0, args.limit);

  const statePath = join(root, STATE_FILE);
  const state = existsSync(statePath) ? JSON.parse(await readFile(statePath, "utf8")) : {};

  console.log(`${files.length} PDF(s) under ${root}\n`);

  let userId = null;
  if (!args.dryRun) {
    const who = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${args.token}` },
    });
    if (!who.ok) {
      console.error(`Token rejected (HTTP ${who.status}). Copy a fresh one from a signed-in tab.`);
      process.exit(1);
    }
    const me = await who.json();
    userId = me.id;
    console.log(`Importing as ${me.email} (${userId}), visibility=${args.visibility}\n`);
  }

  let done = 0, skipped = 0, failed = 0;

  for (const file of files) {
    const info = await stat(file);
    const key = `${relative(root, file)}:${info.size}`;
    if (state[key] && !args.force) {
      console.log(`— skip (already imported) ${relative(root, file)}`);
      skipped++;
      continue;
    }

    const meta = metaFromPath(root, file, args);
    const bytes = new Uint8Array(await readFile(file));
    const { chunks, pageCount } = await extract(bytes);

    const label = `${meta.title} [${meta.kind}${meta.subject ? `, ${meta.subject}` : ""}]`;
    const textNote = chunks.length
      ? `${chunks.length} chunks, ${pageCount ?? "?"} pages`
      : "NO TEXT LAYER (readable, not searchable)";

    if (args.dryRun) {
      console.log(`• ${label}\n    ${(info.size / 1024 / 1024).toFixed(1)} MB · ${textNote}`);
      done++;
      continue;
    }

    try {
      const path = `${userId}/${crypto.randomUUID()}.pdf`;

      const up = await fetch(`${url}/storage/v1/object/user-resources/${path}`, {
        method: "POST",
        headers: {
          apikey: anon,
          Authorization: `Bearer ${args.token}`,
          "Content-Type": "application/pdf",
        },
        body: bytes,
      });
      if (!up.ok) throw new Error(`storage ${up.status}: ${(await up.text()).slice(0, 200)}`);

      const ins = await fetch(`${url}/rest/v1/resources`, {
        method: "POST",
        headers: {
          apikey: anon,
          Authorization: `Bearer ${args.token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          title: meta.title,
          kind: meta.kind,
          subject: meta.subject,
          visibility: args.visibility,
          // Global rows carry no owner: that is what makes their chunks readable by everyone.
          owner_id: args.visibility === "global" ? null : userId,
          created_by: userId,
          storage_bucket: "user-resources",
          storage_path: path,
          content_type: "application/pdf",
          byte_size: info.size,
          page_count: pageCount,
        }),
      });
      if (!ins.ok) {
        // Don't leave an unreferenced object behind — nothing can ever find or reclaim it.
        await fetch(`${url}/storage/v1/object/user-resources/${path}`, {
          method: "DELETE",
          headers: { apikey: anon, Authorization: `Bearer ${args.token}` },
        }).catch(() => {});
        throw new Error(`insert ${ins.status}: ${(await ins.text()).slice(0, 200)}`);
      }
      const [row] = await ins.json();

      if (chunks.length) {
        const idx = await fetch(`${url}/functions/v1/index-resource`, {
          method: "POST",
          headers: {
            apikey: anon,
            Authorization: `Bearer ${args.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resourceId: row.id, chunks, pageCount }),
        });
        if (!idx.ok) console.warn(`    ! indexing failed (${idx.status}) — uploaded but not searchable`);
      }

      state[key] = { id: row.id, at: new Date().toISOString() };
      await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
      console.log(`✓ ${label}\n    ${textNote}`);
      done++;
    } catch (e) {
      console.error(`✗ ${label}\n    ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${args.dryRun ? "Would import" : "Imported"} ${done}, skipped ${skipped}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
