/**
 * The practice filters. The load-bearing rule is that an untouched row means *everything*, never
 * nothing — a filter that quietly empties the queue is worse than no filter at all.
 */
import { describe, expect, it } from "vitest";
import {
  allSources,
  applyFilter,
  describeFilter,
  EMPTY_FILTER,
  filterKey,
  filterToQuery,
  isEmptyFilter,
  parseFilter,
  sourceId,
  sourceOf,
} from "./filters";
import { PROBLEMS } from "./problems";
import type { Problem } from "./types";

const find = (id: string) => PROBLEMS.find((p) => p.id === id)!;

describe("narrowing the bank", () => {
  it("takes everything when nothing is chosen", () => {
    expect(applyFilter(PROBLEMS, EMPTY_FILTER)).toHaveLength(PROBLEMS.length);
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true);
  });

  it("unions techniques rather than intersecting them", () => {
    // "Parts and trig substitution" means either, not both at once — no problem is tagged both.
    const both = applyFilter(PROBLEMS, { ...EMPTY_FILTER, techniques: ["parts", "trig-sub"] });
    const parts = applyFilter(PROBLEMS, { ...EMPTY_FILTER, techniques: ["parts"] });
    const trig = applyFilter(PROBLEMS, { ...EMPTY_FILTER, techniques: ["trig-sub"] });
    expect(both.length).toBeGreaterThan(parts.length);
    expect(both.length).toBeGreaterThan(trig.length);
    expect(both.every((p) => p.techniques.some((t) => t === "parts" || t === "trig-sub"))).toBe(true);
  });

  it("matches a technique anywhere in the list, not just the primary one", () => {
    const multi = PROBLEMS.find((p) => p.techniques.length > 1)!;
    const secondary = multi.techniques[1];
    expect(applyFilter(PROBLEMS, { ...EMPTY_FILTER, techniques: [secondary] })).toContain(multi);
  });

  it("intersects across the three rows", () => {
    const filter = { techniques: ["parts"] as const, levels: [1, 2] as const, sources: [] };
    const got = applyFilter(PROBLEMS, {
      techniques: [...filter.techniques],
      levels: [...filter.levels],
      sources: [],
    });
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((p) => p.techniques.includes("parts") && p.difficulty <= 2)).toBe(true);
  });

  it("filters by source", () => {
    const hmmt = applyFilter(PROBLEMS, { ...EMPTY_FILTER, sources: ["hmmt-integration-bee-practice-pt1"] });
    expect(hmmt.length).toBeGreaterThan(0);
    expect(hmmt.every((p) => p.source?.name === "HMMT Integration Bee")).toBe(true);
  });
});

describe("sources", () => {
  it("groups everything without recorded provenance rather than inventing one", () => {
    const plain = { id: "x", techniques: [] } as unknown as Problem;
    expect(sourceOf(plain).name).toBe("Unattributed");
    expect(sourceId(sourceOf(plain))).toBe("unattributed");
  });

  it("lists what the bank holds, unattributed last", () => {
    const sources = allSources();
    expect(sources.length).toBeGreaterThan(1);
    expect(sources[sources.length - 1].id).toBe("unattributed");
    expect(sources.reduce((n, s) => n + s.count, 0)).toBe(PROBLEMS.length);
  });

  it("keeps round and year apart in the id", () => {
    expect(sourceId(find("hmmt2-x-ln-one-plus-x-def").source!)).toBe(
      "hmmt-integration-bee-practice-pt2",
    );
    expect(sourceId({ name: "MIT Integration Bee", year: 2025, round: "Qualifier" })).toBe(
      "mit-integration-bee-2025-qualifier",
    );
  });
});

describe("the filter as a URL", () => {
  it("round-trips", () => {
    const filter = { techniques: ["parts", "u-sub"] as const, levels: [2, 4] as const, sources: ["putnam"] };
    const original = { techniques: [...filter.techniques], levels: [...filter.levels], sources: [...filter.sources] };
    const query = filterToQuery(original);
    expect(parseFilter(new URLSearchParams(query))).toEqual(original);
  });

  it("writes nothing for an empty filter, so a plain queue keeps a plain URL", () => {
    expect(filterToQuery(EMPTY_FILTER)).toBe("");
    expect(filterKey(EMPTY_FILTER)).toBe("mixed");
  });

  it("drops a level outside 1–5 instead of matching nothing", () => {
    expect(parseFilter(new URLSearchParams("levels=2,9,0,abc")).levels).toEqual([2]);
  });

  it("survives a hand-edited URL", () => {
    expect(parseFilter(new URLSearchParams(""))).toEqual(EMPTY_FILTER);
    expect(parseFilter(new URLSearchParams("techniques=,,"))).toEqual(EMPTY_FILTER);
  });

  it("keys two different sessions to two different bookmarks", () => {
    const a = filterKey({ ...EMPTY_FILTER, techniques: ["parts"] });
    const b = filterKey({ ...EMPTY_FILTER, techniques: ["u-sub"] });
    expect(a).not.toBe(b);
  });
});

describe("saying what a queue holds", () => {
  it("names the whole bank when nothing is narrowed", () => {
    expect(describeFilter(EMPTY_FILTER, 260)).toContain("every problem in the bank");
  });

  it("counts in the singular where it should", () => {
    expect(describeFilter({ ...EMPTY_FILTER, techniques: ["parts"] }, 1)).toBe(
      "1 problem — 1 technique",
    );
  });
});
