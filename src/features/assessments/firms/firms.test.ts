import { describe, expect, it } from "vitest";
import { seededRng } from "../engine/rng";
import { defaultCheck } from "../engine/check";
import { FIRM_LIST, FIRM_REGISTRY } from "./registry";

/**
 * Spec sanity, applied to every firm in the registry.
 *
 * This is the guard rail for adding firms: a new firm file is a data edit, and a data edit that
 * contradicts itself — an instruction screen promising +1/−1 on a module that scores +1/0, a
 * multiple-choice module whose correct answer is not among its options, a pass mark higher than
 * the number of questions — would ship a test that lies to a candidate. Every rule below is one
 * this feature promises on the instruction screen.
 */
describe("firm specs", () => {
  it("registers every firm under its own id", () => {
    for (const [key, firm] of Object.entries(FIRM_REGISTRY)) {
      expect(firm.id).toBe(key);
    }
  });

  for (const firm of FIRM_LIST) {
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
            // A module with neither clock would run forever; these are timed assessments.
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

          it("only promises back-navigation it actually allows", () => {
            // The instruction screen is a promise. Telling a candidate they may "come back to it"
            // while the engine refuses teaches them to bank questions they can never return to —
            // which costs more marks than not offering the skip at all.
            const text = module.rules.join(" ").toLowerCase();
            const promisesReturn = /come back to it|return to it|go back to it later/.test(text);
            if (promisesReturn) {
              expect(module.allowBack, "rules promise coming back but allowBack is false").toBe(true);
            }
            if (!module.allowBack) {
              expect(text, "a module without back-navigation must not imply it").not.toMatch(
                /come back to it(?!,? but)/,
              );
            }
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

            // Item ids must be unique within a paper, or the debrief's React keys collide and
            // back-navigation targets the wrong question.
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
});
