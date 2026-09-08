/**
 * Grid scanning, the shape of Optiver's "zap" round.
 *
 * The real game puts a grid of numbers in front of you and asks you to find things in it faster
 * than you can think about them — pairs that sum to a target, the largest, the one that's missing.
 * The arithmetic is trivial by design; what is being measured is how fast your eye moves and
 * whether it keeps working when the clock is visibly running out.
 *
 * Every answer is computed from the grid the candidate is actually shown, never asserted alongside
 * it, so the two cannot drift apart.
 */
import type { Rng } from "../rng";
import type { Question } from "../types";

const ROWS = 4;
const COLS = 5;

/** KaTeX renders this as a real grid; the fallback in `Tex` is the raw text, which is still legible. */
function gridLatex(values: number[]): string {
  const rows: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    rows.push(values.slice(r * COLS, (r + 1) * COLS).join(" & "));
  }
  return `\\begin{array}{${"r".repeat(COLS)}}${rows.join(" \\\\ ")}\\end{array}`;
}

interface Built {
  question: string;
  value: number;
  explanation: string;
}

type Builder = (rng: Rng, values: number[]) => Built;

/** How many unordered pairs of distinct cells sum to the target. */
const pairsSummingTo: Builder = (rng, values) => {
  const target = values[rng.int(0, values.length - 1)] + values[rng.int(0, values.length - 1)];
  let count = 0;
  const found: string[] = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[i] + values[j] === target) {
        count++;
        if (found.length < 4) found.push(`${values[i]}+${values[j]}`);
      }
    }
  }
  return {
    question: `How many pairs of cells add up to ${target}?`,
    value: count,
    explanation: count
      ? `There are ${count}${found.length < count ? "" : ""}: ${found.join(", ")}${count > found.length ? ", and more" : ""}.`
      : `No two cells add to ${target}.`,
  };
};

const howManyAbove: Builder = (rng, values) => {
  const threshold = rng.int(
    Math.min(...values) + 1,
    Math.max(Math.min(...values) + 2, Math.max(...values) - 1),
  );
  const count = values.filter((v) => v > threshold).length;
  return {
    question: `How many cells are strictly greater than ${threshold}?`,
    value: count,
    explanation: `${count} of the ${values.length} cells beat ${threshold}.`,
  };
};

const sumOfRow: Builder = (rng, values) => {
  const row = rng.int(0, ROWS - 1);
  const cells = values.slice(row * COLS, (row + 1) * COLS);
  return {
    question: `What is the sum of row ${row + 1}?`,
    value: cells.reduce((a, b) => a + b, 0),
    explanation: `${cells.join(" + ")} = ${cells.reduce((a, b) => a + b, 0)}.`,
  };
};

const largestMinusSmallest: Builder = (_rng, values) => {
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  return {
    question: `What is the largest value minus the smallest?`,
    value: hi - lo,
    explanation: `${hi} − ${lo} = ${hi - lo}.`,
  };
};

const countOfValue: Builder = (rng, values) => {
  const target = values[rng.int(0, values.length - 1)];
  return {
    question: `How many times does ${target} appear?`,
    value: values.filter((v) => v === target).length,
    explanation: `${target} appears ${values.filter((v) => v === target).length} time(s).`,
  };
};

const missingNumber: Builder = (_rng, values) => {
  // Which value from 1..N never appears. The grid builder guarantees at least one gap.
  const present = new Set(values);
  for (let n = 1; n <= ROWS * COLS + 5; n++) if (!present.has(n)) {
    return {
      question: `What is the smallest positive whole number that does not appear in the grid?`,
      value: n,
      explanation: `Every number below ${n} is somewhere in the grid; ${n} is not.`,
    };
  }
  return { question: "What is the sum of the whole grid?", value: values.reduce((a, b) => a + b, 0), explanation: "Add every cell." };
};

const BUILDERS: Record<number, Builder[]> = {
  1: [howManyAbove, largestMinusSmallest, countOfValue],
  2: [howManyAbove, largestMinusSmallest, countOfValue, sumOfRow],
  3: [howManyAbove, sumOfRow, countOfValue, missingNumber, pairsSummingTo],
  4: [pairsSummingTo, missingNumber, sumOfRow, howManyAbove],
  5: [pairsSummingTo, missingNumber, sumOfRow],
};

export function generateZap(rng: Rng, level: number, id: string): Question {
  // A tighter spread at higher levels: near-duplicates are what make the eye work.
  const span = [0, 40, 30, 22, 16, 12][Math.min(5, Math.max(1, level))];
  const values = Array.from({ length: ROWS * COLS }, () => rng.int(1, span));
  const built = rng.pick(BUILDERS[Math.min(5, Math.max(1, level))])(rng, values);
  return {
    id,
    kind: "zap",
    prompt: `${gridLatex(values)} \\quad \\text{${built.question}}`,
    answer: { type: "numeric", value: built.value },
    explanation: built.explanation,
  };
}
