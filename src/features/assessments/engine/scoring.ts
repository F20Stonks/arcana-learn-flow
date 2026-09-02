/**
 * Scoring.
 *
 * Each firm's rule is data on the ModuleSpec, not a branch here: `negativeMarking` decides whether
 * a wrong answer costs a point, and an unanswered item is always worth zero. That is exactly the
 * published rule for the speed batteries — Optiver, Akuna, Flow Traders and All Options all mark
 * +1 / −1 with no credit for blanks — and it degrades correctly to +1 / 0 for everyone else.
 */
import type { ItemResult, ModuleSpec, RunResult, SectionResult } from "../types";

export function scoreSection(module: ModuleSpec, items: ItemResult[], durationS: number): SectionResult {
  const answered = items.filter((i) => !i.skipped);
  const correct = answered.filter((i) => i.correct).length;
  const wrong = answered.length - correct;
  const skipped = items.length - answered.length;

  // Floored at zero: no firm reports a negative headline score, and a −14 on the debrief reads as
  // a bug rather than as feedback.
  const rawScore = Math.max(0, module.negativeMarking ? correct - wrong : correct);

  return {
    moduleId: module.id,
    moduleName: module.name,
    items,
    rawScore,
    seen: items.length,
    correct,
    wrong,
    skipped,
    durationS,
    passMark: module.passMark,
  };
}

export type BarVerdict = "above" | "near" | "below" | "unknown";

/**
 * Against the firm's own competitive bar, not a percentage. Candidate reports are given as raw
 * scores ("about 70 on Akuna", "roughly 72 on Flow"), so that is what we compare.
 * `near` is within 10% below the bar — close enough that the debrief should say "borderline"
 * rather than "you failed".
 */
export function barVerdict(section: SectionResult): BarVerdict {
  if (section.passMark === null) return "unknown";
  if (section.rawScore >= section.passMark) return "above";
  return section.rawScore >= section.passMark * 0.9 ? "near" : "below";
}

export function accuracy(section: SectionResult): number {
  const answered = section.correct + section.wrong;
  return answered === 0 ? 0 : section.correct / answered;
}

/** Items attempted per minute — the number that makes a 6-minute test comparable to an 8-minute one. */
export function attemptRate(section: SectionResult): number {
  if (section.durationS <= 0) return 0;
  return ((section.correct + section.wrong) / section.durationS) * 60;
}

/** Median latency in ms over answered items. The speed batteries live or die on this. */
export function medianLatency(section: SectionResult): number {
  const latencies = section.items.filter((i) => !i.skipped).map((i) => i.latencyMs).sort((a, b) => a - b);
  if (latencies.length === 0) return 0;
  const mid = Math.floor(latencies.length / 2);
  return latencies.length % 2 === 0 ? (latencies[mid - 1] + latencies[mid]) / 2 : latencies[mid];
}

/** Per-tag accuracy, worst first — the debrief's "what to drill next" panel. */
export function tagBreakdown(result: RunResult): Array<{ tag: string; attempts: number; correct: number; accuracy: number }> {
  const byTag = new Map<string, { attempts: number; correct: number }>();
  for (const section of result.sections) {
    for (const item of section.items) {
      if (item.skipped) continue;
      const row = byTag.get(item.tag) ?? { attempts: 0, correct: 0 };
      row.attempts += 1;
      if (item.correct) row.correct += 1;
      byTag.set(item.tag, row);
    }
  }
  return [...byTag.entries()]
    .map(([tag, r]) => ({ tag, ...r, accuracy: r.correct / r.attempts }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}

/** "8:00", "0:06" — the clock format every one of these tests shows. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
