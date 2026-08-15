// Whether a document may be HOSTED, decided by its source's licence — enforced at write time.
//
// Two facts make this worth being structural rather than a rule someone remembers:
//
//   1. "Publicly available" is not a licence. Copyright attaches on creation, so a lecturer's problem
//      set on an open URL is no more redistributable than a textbook. Linking to it is unrestricted;
//      storing a copy is the licensed act, and that distinction is invisible at the call site.
//   2. NonCommercial licences (MIT OCW, most of LibreTexts) cannot be hosted inside a product that
//      sells subscriptions, even where the page itself is free to the student — the content is still
//      operating as acquisition for a paid offering.
//
// So mirroring is DENIED BY DEFAULT. A document is only ever stored when its URL matches a registered
// source whose licence permits it. An unrecognised domain is treated as all-rights-reserved, which is
// also what it legally is. The failure mode is "we linked out instead of hosting" — recoverable, and
// invisible to the student, who gets the resource either way.

export interface ResourceSource {
  name: string;
  url_patterns: string[];
  license_code: string;
  license_url: string | null;
  attribution: string;
  mirror_allowed: boolean;
}

/**
 * Licences under which hosting a copy is permitted. ShareAlike is included because hosting is fine —
 * the obligation it carries applies to ADAPTATIONS, which is a separate decision made wherever
 * derived material is produced, not here.
 */
const HOSTABLE = new Set([
  "CC-BY-4.0",
  "CC-BY-3.0",
  "CC-BY-SA-4.0",
  "CC-BY-SA-3.0",
  "CC0-1.0",
  "PD",
  "MIT",
  "APACHE-2.0",
]);

let cache: { at: number; rows: ResourceSource[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

// deno-lint-ignore no-explicit-any
export async function loadSources(supabase: any): Promise<ResourceSource[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const { data, error } = await supabase
    .from("resource_sources")
    .select("name, url_patterns, license_code, license_url, attribution, mirror_allowed");
  if (error) {
    // Deny-by-default has to survive infrastructure failure too: an unreadable registry must not
    // become an accidental "mirror everything".
    console.error("resource_sources unreadable — treating every source as no-mirror:", error.message);
    return [];
  }
  cache = { at: Date.now(), rows: (data || []) as ResourceSource[] };
  return cache.rows;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** The registered source a URL belongs to, matched on hostname or any suffix of it. */
export function matchSource(url: string, sources: ResourceSource[]): ResourceSource | null {
  const host = hostOf(url);
  if (!host) return null;
  for (const s of sources) {
    for (const p of s.url_patterns || []) {
      const pat = p.toLowerCase().trim();
      if (!pat) continue;
      if (host === pat || host.endsWith(`.${pat}`)) return s;
    }
  }
  return null;
}

export interface MirrorDecision {
  allowed: boolean;
  source: ResourceSource | null;
  /** The credit line to display wherever this resource is shown. Empty when unknown. */
  attribution: string;
  reason: string;
}

export function mayMirror(url: string, sources: ResourceSource[]): MirrorDecision {
  const source = matchSource(url, sources);
  if (!source) {
    return {
      allowed: false,
      source: null,
      attribution: "",
      reason: "unrecognised source — treated as all rights reserved, linking out instead",
    };
  }
  if (!source.mirror_allowed) {
    return {
      allowed: false,
      source,
      attribution: source.attribution,
      reason: `${source.name} is ${source.license_code} — not hostable here, linking out instead`,
    };
  }
  if (!HOSTABLE.has(source.license_code.toUpperCase())) {
    // The registry says yes but the licence code is not one we recognise as hostable. The stricter
    // of the two answers wins, every time.
    return {
      allowed: false,
      source,
      attribution: source.attribution,
      reason: `${source.name} is flagged mirror_allowed but its licence (${source.license_code}) is not on the hostable list`,
    };
  }
  return { allowed: true, source, attribution: source.attribution, reason: `${source.license_code} permits hosting` };
}
