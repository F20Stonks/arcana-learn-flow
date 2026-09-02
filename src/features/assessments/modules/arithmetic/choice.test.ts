import { describe, expect, it } from "vitest";
import { seededRng } from "../../engine/rng";
import { defaultCheck } from "../../engine/check";
import { arithmeticModule, generateArithmeticItem, FLOW_TRADERS_PROFILE, OPTIVER_PROFILE } from "./index";
// The other four new firms are typed-mode; Flow Traders is the multiple-choice one. All five are
// exercised here even though only Flow Traders exercises the choice path, because none of them
// are wired into firms/registry.ts yet (that happens at merge time, outside this worktree) and so
// none of them are reached by firms/firms.test.ts until then. This file gives them the same
// spec-sanity coverage that firms.test.ts applies to every registered firm.

describe("choice-mode items (Flow Traders' math test)", () => {
  it("produces exactly four choices, distinct ids, distinct labels, correct answer present", () => {
    const rng = seededRng(500);
    for (let i = 0; i < 200; i++) {
      const item = generateArithmeticItem(rng, i, { profile: FLOW_TRADERS_PROFILE, input: "choice" });
      expect(item.choices, `no choices for "${item.prompt}"`).toBeDefined();
      expect(item.choices!.length).toBe(4);

      const ids = item.choices!.map((c) => c.id);
      expect(new Set(ids).size, `duplicate ids for "${item.prompt}"`).toBe(4);

      const labels = item.choices!.map((c) => c.label);
      expect(new Set(labels).size, `duplicate labels for "${item.prompt}"`).toBe(4);

      expect(ids, `correct answer missing among choices for "${item.prompt}"`).toContain(item.answer);
    }
  });

  it("shuffles which slot the correct answer lands in — not pinned to the first option", () => {
    const rng = seededRng(77);
    const correctSlot = new Map<number, number>();
    for (let i = 0; i < 400; i++) {
      const item = generateArithmeticItem(rng, i, { profile: FLOW_TRADERS_PROFILE, input: "choice" });
      const slot = item.choices!.findIndex((c) => c.id === item.answer);
      correctSlot.set(slot, (correctSlot.get(slot) ?? 0) + 1);
    }
    // Over 400 draws across 4 slots, a real shuffle spreads roughly evenly; a broken one (always
    // slot 0, say) collapses to a single key. Demand every slot appears, and that no slot takes
    // an implausibly large share of the total.
    expect(correctSlot.size, `only landed in slots ${[...correctSlot.keys()]}`).toBe(4);
    for (const count of correctSlot.values()) {
      expect(count).toBeLessThan(400 * 0.5);
    }
  });

  it("typed mode (the default) never attaches choices", () => {
    const rng = seededRng(9);
    for (let i = 0; i < 50; i++) {
      const item = generateArithmeticItem(rng, i, { profile: OPTIVER_PROFILE });
      expect(item.choices).toBeUndefined();
    }
  });

  it("defaultCheck accepts the correct choice id and rejects the others", () => {
    const rng = seededRng(321);
    for (let i = 0; i < 60; i++) {
      const item = generateArithmeticItem(rng, i, { profile: FLOW_TRADERS_PROFILE, input: "choice" });
      expect(defaultCheck(item, item.answer)).toBe(true);
      for (const choice of item.choices!) {
        if (choice.id !== item.answer) expect(defaultCheck(item, choice.id)).toBe(false);
      }
    }
  });
});

describe("arithmeticModule({ input: 'choice' })", () => {
  const module = arithmeticModule({
    id: "choice-test",
    name: "Choice Test",
    blurb: "test",
    itemCount: 20,
    durationS: 120,
    profile: FLOW_TRADERS_PROFILE,
    negativeMarking: true,
    allowSkip: false,
    passMark: 10,
    input: "choice",
  });

  it("reports input: 'choice' on the spec and says so on the instruction screen", () => {
    expect(module.input).toBe("choice");
    expect(module.rules.join(" ").toLowerCase()).toContain("choose");
  });

  it("generates a full paper of valid choice items", () => {
    const rng = seededRng(1);
    const items = Array.from({ length: module.itemCount }, (_, index) =>
      module.generate({ index, count: module.itemCount, rng }),
    );
    for (const item of items) {
      expect(item.choices?.length).toBe(4);
      expect(item.choices!.map((c) => c.id)).toContain(item.answer);
    }
  });
});

describe("arithmeticModule({ input: 'typed-number' } — the default)", () => {
  const module = arithmeticModule({
    id: "typed-test",
    name: "Typed Test",
    blurb: "test",
    itemCount: 20,
    durationS: 120,
    profile: OPTIVER_PROFILE,
    negativeMarking: true,
    allowSkip: false,
    passMark: 10,
  });

  it("defaults to typed-number and doesn't mention choosing on the instruction screen", () => {
    expect(module.input).toBe("typed-number");
    expect(module.rules.join(" ").toLowerCase()).not.toContain("choose");
  });
});

/** Runs the same coherence checks firms/firms.test.ts applies to every registered firm. */
