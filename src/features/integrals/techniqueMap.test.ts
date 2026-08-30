/**
 * The totality check techniqueMap.ts's own header comment promises, plus spot-checks of
 * familyOf/siblingsOf/crossLinksFor/confusablesFor's documented behavior.
 *
 * TECHNIQUES (techniques.ts) is treated as the canonical list of every real TechniqueId — every
 * other test file in this feature (problems.test.ts, lessonExamples.test.ts) already relies on it
 * being complete, and it's the only runtime-visible source of the TechniqueId union (TypeScript
 * types vanish at build time, so a hardcoded id list here couldn't catch a real drift the way
 * reading TECHNIQUES does).
 */
import { describe, expect, it } from "vitest";
import {
  confusablesFor,
  CROSS_LINKS,
  crossLinksFor,
  familyOf,
  siblingsOf,
  standaloneNoteFor,
  STANDALONE_TECHNIQUES,
  TECHNIQUE_FAMILIES,
} from "./techniqueMap";
import { TECHNIQUES } from "./techniques";
import type { TechniqueId } from "./types";

const ALL_IDS: TechniqueId[] = TECHNIQUES.map((t) => t.id);
const sortedIds = (ids: readonly TechniqueId[]) => [...ids].sort();

describe("totality", () => {
  it("places every real TechniqueId in exactly one of TECHNIQUE_FAMILIES/STANDALONE_TECHNIQUES", () => {
    const placedCounts = new Map<TechniqueId, number>();
    for (const family of TECHNIQUE_FAMILIES) {
      for (const member of family.members) {
        placedCounts.set(member.id, (placedCounts.get(member.id) ?? 0) + 1);
      }
    }
    for (const standalone of STANDALONE_TECHNIQUES) {
      placedCounts.set(standalone.id, (placedCounts.get(standalone.id) ?? 0) + 1);
    }

    // Every id from the real curriculum is placed, and placed exactly once -- this is the check
    // that fails loudly if a 22nd technique is ever added to types.ts/techniques.ts without being
    // placed here (never placed at all -> count 0), and would equally catch a copy-paste duplicate
    // landing a technique in two families, or a family AND STANDALONE_TECHNIQUES (count > 1).
    for (const id of ALL_IDS) {
      expect(placedCounts.get(id)).toBe(1);
    }

    // And nothing placed here is a stale id that no longer exists in the real curriculum.
    const allIdSet = new Set(ALL_IDS);
    for (const placedId of placedCounts.keys()) {
      expect(allIdSet.has(placedId)).toBe(true);
    }

    expect(placedCounts.size).toBe(ALL_IDS.length);
  });

  it("has no id repeated within a single family's own members", () => {
    for (const family of TECHNIQUE_FAMILIES) {
      const ids = family.members.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("STANDALONE_TECHNIQUES has no duplicate ids", () => {
    const ids = STANDALONE_TECHNIQUES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every family has at least two members -- a family of one is just a standalone technique", () => {
    for (const family of TECHNIQUE_FAMILIES) {
      expect(family.members.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("has exactly 21 techniques placed in total, matching the real curriculum's size today", () => {
    // Not the totality check itself (that's the test above, and it's what actually matters) -- just
    // pinning the number so a change in curriculum size is visible here too, not just inferred.
    expect(ALL_IDS.length).toBe(21);
  });
});

describe("CROSS_LINKS", () => {
  it("every endpoint is a real TechniqueId", () => {
    const allIdSet = new Set(ALL_IDS);
    for (const link of CROSS_LINKS) {
      expect(allIdSet.has(link.a)).toBe(true);
      expect(allIdSet.has(link.b)).toBe(true);
    }
  });

  it("never links a technique to itself", () => {
    for (const link of CROSS_LINKS) {
      expect(link.a).not.toBe(link.b);
    }
  });

  it("has no exact duplicate pair, in either direction", () => {
    const seen = new Set<string>();
    for (const link of CROSS_LINKS) {
      const key = sortedIds([link.a, link.b]).join("::");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("familyOf", () => {
  it("returns the containing family for a family member, with its real siblings inside it", () => {
    const family = familyOf("power");
    expect(family?.id).toBe("reverse-a-rule");
    expect(sortedIds(family!.members.map((m) => m.id))).toEqual(sortedIds(["power", "u-sub", "parts"]));
  });

  it("returns undefined for a standalone technique", () => {
    expect(familyOf("floor-function")).toBeUndefined();
  });
});

describe("siblingsOf", () => {
  it("returns the other members of the same family, the technique itself excluded", () => {
    expect(sortedIds(siblingsOf("power"))).toEqual(sortedIds(["u-sub", "parts"]));
  });

  it("is empty for a standalone technique", () => {
    expect(siblingsOf("floor-function")).toEqual([]);
  });

  it("never includes the technique itself", () => {
    for (const id of ALL_IDS) {
      expect(siblingsOf(id)).not.toContain(id);
    }
  });
});

describe("crossLinksFor", () => {
  it("returns the other end of every cross-link touching this id", () => {
    // trig-sub <-> trig-identity is the only cross-link touching trig-sub.
    expect(crossLinksFor("trig-sub")).toEqual(["trig-identity"]);
  });

  it("works from either side of a link (CrossLink is unordered)", () => {
    expect(crossLinksFor("trig-identity")).toContain("trig-sub");
  });

  it("is empty for a technique with no cross-link", () => {
    expect(crossLinksFor("power")).toEqual([]);
  });

  it("gamma-function sits at the hub of two cross-links (zeta-series and gaussian-hypersphere)", () => {
    expect(sortedIds(crossLinksFor("gamma-function"))).toEqual(
      sortedIds(["zeta-series", "gaussian-hypersphere"]),
    );
  });
});

describe("confusablesFor", () => {
  it("unions siblings and cross-links, deduplicated", () => {
    // gamma-function: 3 reduction-formulas siblings + 2 cross-links (zeta-series, gaussian-hypersphere).
    expect(sortedIds(confusablesFor("gamma-function"))).toEqual(
      sortedIds(["recurrence", "beta-integrals", "wallis-product", "zeta-series", "gaussian-hypersphere"]),
    );
  });

  it("is empty exactly for the one technique with neither a family nor a cross-link (floor-function)", () => {
    const emptyOnes = ALL_IDS.filter((id) => confusablesFor(id).length === 0);
    expect(emptyOnes).toEqual(["floor-function"]);
  });

  it("is non-empty for a standalone technique that carries a cross-link, even with no family", () => {
    // introducing-constants has no family (see STANDALONE_TECHNIQUES) but does cross-link to
    // complete-square -- confusablesFor should surface that, not just family siblings.
    expect(confusablesFor("introducing-constants")).toEqual(["complete-square"]);
  });

  it("never includes the technique itself", () => {
    for (const id of ALL_IDS) {
      expect(confusablesFor(id)).not.toContain(id);
    }
  });

  it("never returns duplicates, even when a sibling is also cross-linked", () => {
    for (const id of ALL_IDS) {
      const confusables = confusablesFor(id);
      expect(new Set(confusables).size).toBe(confusables.length);
    }
  });
});

describe("standaloneNoteFor", () => {
  it("returns the note for a standalone technique", () => {
    expect(standaloneNoteFor("floor-function")).toMatch(/floor/i);
  });

  it("returns undefined for a technique that belongs to a family", () => {
    expect(standaloneNoteFor("power")).toBeUndefined();
  });
});
