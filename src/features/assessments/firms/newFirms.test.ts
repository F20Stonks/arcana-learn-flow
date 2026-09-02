import { describe, expect, it } from "vitest";
import { seededRng } from "../engine/rng";
import { defaultCheck } from "../engine/check";
import type { FirmSpec } from "../types";
import { citadel } from "./citadel";
import { drw } from "./drw";
import { sig } from "./sig";
import { gResearch } from "./gResearch";

/**
 * `firms/registry.ts` is off-limits to this agent (the lead wires new firms in at merge time), so
 * `firms/firms.test.ts` never sees these four firms until that happens. This file applies the
 * exact same spec-sanity checks directly to citadel/drw/sig/gResearch, so they are proven to pass
 * firms.test.ts's rules *before* the merge, not after.
 *
 * Keep this in sync with firms/firms.test.ts's checks. Once the lead adds these firms to
 * FIRM_REGISTRY, firms.test.ts covers them too and this file becomes a (harmless) duplicate — safe
 * to delete then, but not required.
 */
const NEW_FIRMS: FirmSpec[] = [citadel, drw, sig, gResearch];

describe("new probability firms (pre-registry spec sanity)", () => {
  it("uses distinct firm ids", () => {
    const ids = NEW_FIRMS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const firm of NEW_FIRMS) {
    describe(firm.name, () => {
      it("carries provenance", () => {
        expect(firm.lastVerified, "lastVerified must be an ISO date").toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(firm.sourceNote.length).toBeGreaterThan(20);
        expect(firm.specVersion).toBeGreaterThanOrEqual(1);
      });

      it("has at least one module, each with a unique id", () => {
        expect(firm.modules.length).toBeGreaterThan(0);
        const ids = firm.modules.map((m) => m.id);
        expect(new Set(ids).size, `duplicate module id in ${firm.id}`).toBe(ids.length);
      });

      for (const module of firm.modules) {
        describe(module.name, () => {
          it("is internally coherent", () => {
            expect(module.itemCount).toBeGreaterThan(0);
            expect(
              module.durationS !== null || module.perItemMs !== null,
              "a module needs a section clock, a per-item clock, or both",
            ).toBe(true);
            if (module.durationS !== null) expect(module.durationS).toBeGreaterThan(0);
            if (module.perItemMs !== null) expect(module.perItemMs).toBeGreaterThan(0);
            if (module.passMark !== null) {
              expect(module.passMark).toBeGreaterThan(0);
              expect(module.passMark, "pass mark cannot exceed a perfect score").toBeLessThanOrEqual(module.itemCount);
            }
            expect(module.rules.length, "the instruction screen needs rules").toBeGreaterThan(0);
          });

          it("states its marking rule truthfully on the instruction screen", () => {
            const text = module.rules.join(" ");
            expect(
              text.includes(module.negativeMarking ? "−1" : "+1"),
              "the rules must name the marking the engine applies",
            ).toBe(true);
            if (!module.negativeMarking) {
              expect(text, "a +1/0 module must not promise a penalty").not.toContain("−1");
            }
          });

          it("states its skip rule truthfully", () => {
            const text = module.rules.join(" ").toLowerCase();
            expect(text).toContain("skip");
            if (!module.allowSkip) expect(text).toMatch(/cannot skip|no skipping/);
          });

          it("generates valid items across a whole paper", () => {
            const rng = seededRng(4242);
            const items = Array.from({ length: module.itemCount }, (_, index) =>
              module.generate({ index, count: module.itemCount, rng }),
            );

            for (const item of items) {
              expect(item.id, "every item needs an id").toBeTruthy();
              expect(item.tag, "every item needs a tag for the debrief breakdown").toBeTruthy();
              expect(item.prompt.trim().length).toBeGreaterThan(0);
              expect(item.answer.trim().length).toBeGreaterThan(0);

              if (module.input === "choice") {
                expect(item.choices, "a choice module must supply choices").toBeDefined();
                expect(item.choices!.length).toBeGreaterThanOrEqual(2);
                const ids = item.choices!.map((c) => c.id);
                expect(new Set(ids).size, "choice ids must be unique").toBe(ids.length);
                expect(ids, `correct answer missing from options: ${item.prompt}`).toContain(item.answer);
                const labels = item.choices!.map((c) => c.label);
                expect(new Set(labels).size, `duplicate option labels: ${item.prompt}`).toBe(labels.length);
              }
            }

            const ids = items.map((i) => i.id);
            expect(new Set(ids).size, "duplicate item ids within one paper").toBe(ids.length);
          });

          it("marks its own correct answer as correct", () => {
            const rng = seededRng(777);
            const check = module.check ?? defaultCheck;
            for (let index = 0; index < Math.min(module.itemCount, 40); index++) {
              const item = module.generate({ index, count: module.itemCount, rng });
              expect(check(item, item.answer), `grader rejects its own answer: ${item.prompt}`).toBe(true);
            }
          });

        });
      }
    });
  }

  it("Citadel allows both skip and back navigation", () => {
    expect(citadel.modules[0].allowSkip).toBe(true);
    expect(citadel.modules[0].allowBack).toBe(true);
  });

  it("DRW, SIG and G-Research all allow skip", () => {
    for (const firm of [drw, sig, gResearch]) {
      expect(firm.modules[0].allowSkip, `${firm.id} should allow skip`).toBe(true);
    }
  });

  it("every module in all four firms marks +1 / 0 (no negative marking)", () => {
    for (const firm of NEW_FIRMS) {
      for (const module of firm.modules) {
        expect(module.negativeMarking, `${firm.id}/${module.id} should not use negative marking`).toBe(false);
      }
    }
  });

  it("every module in all four firms has passMark: null (no reliable published bar)", () => {
    for (const firm of NEW_FIRMS) {
      for (const module of firm.modules) {
        expect(module.passMark, `${firm.id}/${module.id} should have passMark: null`).toBeNull();
      }
    }
  });

  it("G-Research offers 5 options per item; the others offer 4", () => {
    const rng = seededRng(1);
    const gItem = gResearch.modules[0].generate({ index: 0, count: gResearch.modules[0].itemCount, rng });
    expect(gItem.choices).toHaveLength(5);

    for (const firm of [citadel, drw, sig]) {
      const r = seededRng(1);
      const item = firm.modules[0].generate({ index: 0, count: firm.modules[0].itemCount, rng: r });
      expect(item.choices, `${firm.id} should offer 4 options`).toHaveLength(4);
    }
  });

  it("item counts and clocks match the specified format", () => {
    expect(citadel.modules[0].itemCount).toBe(15);
    expect(citadel.modules[0].durationS).toBe(1800);
    expect(drw.modules[0].itemCount).toBe(6);
    expect(drw.modules[0].durationS).toBe(2700);
    expect(sig.modules[0].itemCount).toBe(16);
    expect(sig.modules[0].durationS).toBe(1200);
    expect(gResearch.modules[0].itemCount).toBe(10);
    expect(gResearch.modules[0].durationS).toBe(5400);
  });
});
