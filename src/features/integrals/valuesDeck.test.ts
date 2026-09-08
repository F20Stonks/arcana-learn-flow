import { describe, expect, it } from "vitest";
import { buildValuesDeck, valuesDeckForTechnique } from "./valuesDeck";
import { PROBLEMS } from "./problems";
import { TECHNIQUES } from "./techniques";

describe("buildValuesDeck", () => {
  const deck = buildValuesDeck();

  it("is non-empty and every card has real content", () => {
    expect(deck.length).toBeGreaterThan(0);
    for (const card of deck) {
      expect(card.front.trim().length).toBeGreaterThan(0);
      expect(card.back.trim().length).toBeGreaterThan(0);
      expect(card.technique).toBeTruthy();
    }
  });

  it("every card has a unique id", () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });

  it("includes exactly one bank card per definite problem, and no indefinite ones", () => {
    const bankCards = deck.filter((c) => c.source === "bank");
    const definiteCount = PROBLEMS.filter((p) => p.kind === "definite").length;
    expect(bankCards).toHaveLength(definiteCount);
    // Spot-check a couple of real ids round-trip correctly.
    const first = PROBLEMS.find((p) => p.kind === "definite")!;
    expect(bankCards.some((c) => c.id === `bank:${first.id}` && c.back === first.answerLatex)).toBe(true);
  });

  it("draws lesson cards only from worked examples with a literal stated result", () => {
    const lessonCards = deck.filter((c) => c.source === "lesson");
    expect(lessonCards.length).toBeGreaterThan(0);

    let expectedCount = 0;
    for (const t of TECHNIQUES) {
      const examples = t.examples ?? [t.example];
      expectedCount += examples.filter((ex) => ex.resultExpr !== undefined).length;
    }
    expect(lessonCards).toHaveLength(expectedCount);
  });

  it("wraps a lesson example's integrand exactly like LessonBody.tsx does — no bounds added, even for a definite example whose own text already states its domain as prose", () => {
    const feynman = TECHNIQUES.find((t) => t.id === "feynman")!;
    const frullani = (feynman.examples ?? [feynman.example]).find((ex) => ex.result.includes("\\ln 2"));
    expect(frullani).toBeDefined();
    const card = deck.find((c) => c.source === "lesson" && c.technique === "feynman" && c.back === frullani!.result);
    expect(card?.front).toBe(`\\int ${frullani!.integrand}\\,dx`);
    // The regression this guards: adding \int_{0}^{\infty} on top of integrand text that already
    // says "on [0,\infty)" would double the bounds up.
    expect(card?.front.match(/\\infty/g)?.length).toBe((frullani!.integrand.match(/\\infty/g) ?? []).length);
  });
});

describe("valuesDeckForTechnique", () => {
  it("filters to just the requested technique", () => {
    const deck = buildValuesDeck();
    const powerCards = valuesDeckForTechnique(deck, "power");
    expect(powerCards.length).toBeGreaterThan(0);
    expect(powerCards.every((c) => c.technique === "power")).toBe(true);
    expect(powerCards.length).toBeLessThan(deck.length);
  });

  it("returns an empty array for a technique with no cards, without throwing", () => {
    const deck: ReturnType<typeof buildValuesDeck> = [];
    expect(valuesDeckForTechnique(deck, "power")).toEqual([]);
  });
});
