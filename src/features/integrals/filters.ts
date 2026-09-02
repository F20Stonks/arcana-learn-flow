/**
 * Practice filters.
 *
 * Two independent ways to narrow the bank, because they answer different questions and neither
 * replaces the other. By technique, multi-select: "drill parts and trig substitution together,
 * nothing else." By source: "give me the MIT set as it was actually posed, uncurated." Difficulty
 * cuts across both — a mixed queue of every problem in the bank is not practice, it is a haystack.
 *
 * The whole filter lives in the URL, so a session someone has set up is a link they can keep.
 */
import { PROBLEMS } from "./problems";
import type { Difficulty, Problem, ProblemSource, TechniqueId } from "./types";

export interface ProblemFilter {
  /** Empty means every technique — not none. Same for the other two. */
  techniques: TechniqueId[];
  levels: Difficulty[];
  sources: string[];
}

export const EMPTY_FILTER: ProblemFilter = { techniques: [], levels: [], sources: [] };

const UNATTRIBUTED = "unattributed";

/** A source's stable id — what goes in the URL, and what the filter matches on. */
export function sourceId(source: ProblemSource): string {
  return [source.name, source.year, source.round]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sourceLabel(source: ProblemSource): string {
  return [source.name, source.year, source.round].filter(Boolean).join(" · ");
}

/**
 * The bulk of the bank was mined from four PDFs without a per-problem note of which, so most
 * problems genuinely have no provenance to report. They group under one honest bucket rather than
 * being assigned a source nobody checked.
 */
export function sourceOf(problem: Problem): ProblemSource {
  return problem.source ?? { name: "Unattributed" };
}

export interface SourceSummary {
  id: string;
  label: string;
  count: number;
}

/** Every source present in the bank, commonest first, with the unattributed bucket always last. */
export function allSources(pool: readonly Problem[] = PROBLEMS): SourceSummary[] {
  const byId = new Map<string, SourceSummary>();
  for (const problem of pool) {
    const source = sourceOf(problem);
    const id = sourceId(source);
    const existing = byId.get(id);
    if (existing) existing.count++;
    else byId.set(id, { id, label: sourceLabel(source), count: 1 });
  }
  return [...byId.values()].sort((a, b) => {
    if (a.id === UNATTRIBUTED) return 1;
    if (b.id === UNATTRIBUTED) return -1;
    return b.count - a.count || a.label.localeCompare(b.label);
  });
}

export function applyFilter(pool: readonly Problem[], filter: ProblemFilter): Problem[] {
  return pool.filter((p) => {
    if (filter.techniques.length && !filter.techniques.some((t) => p.techniques.includes(t))) {
      return false;
    }
    if (filter.levels.length && !filter.levels.includes(p.difficulty)) return false;
    if (filter.sources.length && !filter.sources.includes(sourceId(sourceOf(p)))) return false;
    return true;
  });
}

export function isEmptyFilter(filter: ProblemFilter): boolean {
  return !filter.techniques.length && !filter.levels.length && !filter.sources.length;
}

const csv = (params: URLSearchParams, key: string): string[] =>
  (params.get(key) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function parseFilter(params: URLSearchParams): ProblemFilter {
  return {
    techniques: csv(params, "techniques") as TechniqueId[],
    // Anything outside 1–5 is dropped rather than silently matching nothing.
    levels: csv(params, "levels")
      .map(Number)
      .filter((n): n is Difficulty => n >= 1 && n <= 5 && Number.isInteger(n)),
    sources: csv(params, "sources"),
  };
}

export function filterToQuery(filter: ProblemFilter): string {
  const params = new URLSearchParams();
  if (filter.techniques.length) params.set("techniques", filter.techniques.join(","));
  if (filter.levels.length) params.set("levels", filter.levels.join(","));
  if (filter.sources.length) params.set("sources", filter.sources.join(","));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Bookmarks are per queue, and two different filters are two different queues — otherwise a
 * custom session would resume onto a problem that is not in it.
 */
export function filterKey(filter: ProblemFilter): string {
  return isEmptyFilter(filter) ? "mixed" : `mixed${filterToQuery(filter)}`;
}

/** One line naming what a filtered queue actually contains. */
export function describeFilter(filter: ProblemFilter, count: number): string {
  const parts: string[] = [];
  if (filter.techniques.length) {
    parts.push(`${filter.techniques.length} technique${filter.techniques.length === 1 ? "" : "s"}`);
  }
  if (filter.levels.length) parts.push(`level ${[...filter.levels].sort().join(", ")}`);
  if (filter.sources.length) {
    parts.push(`${filter.sources.length} source${filter.sources.length === 1 ? "" : "s"}`);
  }
  const scope = parts.length ? parts.join(" · ") : "every problem in the bank";
  return `${count} problem${count === 1 ? "" : "s"} — ${scope}`;
}
