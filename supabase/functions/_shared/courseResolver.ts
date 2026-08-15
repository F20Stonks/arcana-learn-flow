// Course resource resolution by ENUMERATION, for courses that have no exam board.
//
// Why this exists alongside pastPaperResolver.ts, rather than extending it:
//
//   pastPaperResolver asks Tavily for `max_results: 8` and then keeps `.slice(0, 6)`. That is a
//   RELEVANCE api, and relevance is the wrong instrument for "find all past papers". Six hits is not
//   an archive — it is a sample of one, and it is why `past_papers` holds 18 rows in total. No amount
//   of prompt or query tuning fixes that, because completeness is simply not what search returns.
//
// The shape that does work: search ONCE to discover the archive INDEX page, then enumerate every
// document link on that page deterministically, then verify each link by actually fetching it. A
// university faculty publishes its papers on exactly such an index; that page is the authority, not
// a search ranking.
//
// The hard rule this module exists to enforce: NOTHING is reported as found on a model's say-so, or
// on a search snippet. A document counts as found only if its URL was fetched, returned 200, and
// came back with a plausible content type. Everything else is recorded as a GAP, with the reason.
// A known gap is useful; a fabricated URL that looks identical to a real one is poison.

const FETCH_TIMEOUT_MS = 9000;
const MAX_INDEX_BYTES = 4 * 1024 * 1024;
const MAX_ENUMERATED = 400;
const MAX_VERIFY = 120;
const VERIFY_CONCURRENCY = 6;

export type ResourceKind = "past-paper" | "example-sheet" | "notes" | "syllabus" | "other";

export interface CourseResource {
  title: string;
  url: string;
  kind: ResourceKind;
  year: string | null;
  /** true only when the URL was actually fetched and came back usable */
  verified: boolean;
  contentType: string | null;
  /** why verification failed — the honest half of the manifest */
  reason?: string;
}

export interface CourseManifest {
  course: string;
  indexUrl: string | null;
  /** links found on the index page before verification */
  discovered: number;
  /** links that survived an actual fetch */
  verified: number;
  resources: CourseResource[];
  /** everything known to be missing or unreachable, in plain language */
  gaps: string[];
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

async function fetchText(url: string): Promise<{ text: string; contentType: string } | null> {
  const { signal, done } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Cortexed/1.0)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) return null;
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_INDEX_BYTES) return null;
    return { text: await res.text(), contentType };
  } catch {
    return null;
  } finally {
    done();
  }
}

/** Classifies by URL and link text — cheap, and good enough to route a document to the right bucket. */
function classify(title: string, url: string): ResourceKind {
  const hay = `${title} ${url}`.toLowerCase();
  if (/example\s*sheet|problem\s*sheet|exercise\s*sheet|sheet\s*\d/.test(hay)) return "example-sheet";
  if (/past\s*paper|exam|question\s*paper|tripos|\bpaper\s*\d/.test(hay)) return "past-paper";
  if (/schedule|syllabus|curriculum|specification/.test(hay)) return "syllabus";
  if (/notes|lecture/.test(hay)) return "notes";
  return "other";
}

const yearOf = (s: string): string | null => {
  const m = s.match(/\b(19[89]\d|20[0-4]\d)\b/);
  return m ? m[0] : null;
};

/**
 * Every document link on a page, resolved to absolute URLs and deduped.
 *
 * Regex rather than a DOM parser because edge functions have no DOM and pulling one in for anchor
 * extraction is not worth the cold start. Attribute order and quoting vary, so this is deliberately
 * permissive about the tag and strict about the href.
 */
export function extractDocumentLinks(html: string, baseUrl: string): Array<{ title: string; url: string }> {
  const out = new Map<string, string>();
  const anchor = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchor.exec(html)) !== null && out.size < MAX_ENUMERATED) {
    const rawHref = m[1].trim();
    if (!rawHref || rawHref.startsWith("#") || /^(mailto|javascript):/i.test(rawHref)) continue;
    let abs: string;
    try {
      abs = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }
    // Documents only. A faculty index page is mostly navigation chrome; papers are the PDFs on it.
    if (!/\.(pdf|ps|dvi)(\?|$)/i.test(abs)) continue;
    const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!out.has(abs)) out.set(abs, title || abs.split("/").pop() || abs);
  }
  return [...out.entries()].map(([url, title]) => ({ title, url }));
}

/** A document counts as real only if fetching it works. This is the whole anti-hallucination gate. */
async function verify(url: string): Promise<{ ok: boolean; contentType: string | null; reason?: string }> {
  const { signal, done } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    // HEAD first: an archive of 200 PDFs should not be downloaded in full just to prove it exists.
    let res = await fetch(url, { method: "HEAD", signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; Cortexed/1.0)" } });
    // Plenty of academic servers reject HEAD outright; fall back to a ranged GET before believing it.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; Cortexed/1.0)", Range: "bytes=0-1023" } });
    }
    if (!res.ok) return { ok: false, contentType: null, reason: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type");
    // A login wall usually answers 200 with HTML rather than the document — that is not the paper.
    if (contentType && contentType.includes("html")) {
      return { ok: false, contentType, reason: "returned HTML (likely a login wall or error page)" };
    }
    return { ok: true, contentType };
  } catch (e) {
    return { ok: false, contentType: null, reason: e instanceof Error ? e.message : "fetch failed" };
  } finally {
    done();
  }
}

async function pooled<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Finds the archive index page for a course.
 *
 * Candidates are scored by how many document links their page ACTUALLY contains, not by search rank
 * or title. An index of 200 papers beats a nicely-titled landing page with three, which is exactly
 * the judgement a relevance ranking cannot make.
 */
export async function findArchiveIndex(
  course: string,
  tavilyApiKey: string,
  what: string,
): Promise<{ url: string; html: string; links: Array<{ title: string; url: string }> } | null> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${tavilyApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `${course} ${what} archive index official`,
      max_results: 8,
      search_depth: "advanced",
      include_raw_content: false,
    }),
  });
  if (!res.ok) {
    console.error("course archive search failed:", res.status);
    return null;
  }
  const data = await res.json();
  const results: Array<{ url: string }> = data.results || [];

  let best: { url: string; html: string; links: Array<{ title: string; url: string }> } | null = null;
  for (const r of results.slice(0, 6)) {
    const page = await fetchText(r.url);
    if (!page) continue;
    const links = extractDocumentLinks(page.text, r.url);
    if (!best || links.length > best.links.length) best = { url: r.url, html: page.text, links };
    // A page with this many documents is unambiguously the archive; stop paying for more fetches.
    if (links.length >= 40) break;
  }
  return best && best.links.length > 0 ? best : null;
}

/**
 * Resolve a course's downloadable resources into a manifest of VERIFIED items plus explicit gaps.
 *
 * The manifest is the product. "47 papers verified, example sheets found for 4 of 8 courses, two
 * lecturer pages 404, three behind institutional login" is worth far more than a confident list that
 * silently mixes real and invented URLs — and it is the only form of "did we get everything" that can
 * actually be checked.
 */
export async function resolveCourseResources(
  course: string,
  tavilyApiKey: string,
  what = "past papers",
): Promise<CourseManifest> {
  const manifest: CourseManifest = {
    course,
    indexUrl: null,
    discovered: 0,
    verified: 0,
    resources: [],
    gaps: [],
  };

  const index = await findArchiveIndex(course, tavilyApiKey, what);
  if (!index) {
    manifest.gaps.push(`no archive index page could be found and fetched for "${course}" (${what})`);
    return manifest;
  }

  manifest.indexUrl = index.url;
  manifest.discovered = index.links.length;

  const toCheck = index.links.slice(0, MAX_VERIFY);
  if (index.links.length > MAX_VERIFY) {
    manifest.gaps.push(
      `index lists ${index.links.length} documents; only the first ${MAX_VERIFY} were verified in this pass`,
    );
  }

  const checked = await pooled(toCheck, VERIFY_CONCURRENCY, async (l) => {
    const v = await verify(l.url);
    const r: CourseResource = {
      title: l.title,
      url: l.url,
      kind: classify(l.title, l.url),
      year: yearOf(`${l.title} ${l.url}`),
      verified: v.ok,
      contentType: v.contentType,
      ...(v.reason ? { reason: v.reason } : {}),
    };
    return r;
  });

  manifest.resources = checked;
  manifest.verified = checked.filter((r) => r.verified).length;

  const failed = checked.filter((r) => !r.verified);
  if (failed.length) {
    const byReason = new Map<string, number>();
    for (const f of failed) byReason.set(f.reason || "unknown", (byReason.get(f.reason || "unknown") ?? 0) + 1);
    for (const [reason, n] of byReason) manifest.gaps.push(`${n} document(s) unreachable: ${reason}`);
  }
  if (manifest.verified === 0) {
    manifest.gaps.push("no document on the index page could be verified — nothing was recorded");
  }

  return manifest;
}
