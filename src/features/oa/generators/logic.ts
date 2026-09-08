/**
 * Deductive reasoning — the non-numerate half of several OAs.
 *
 * Kept to puzzle shapes with a single forced answer that the generator derives rather than asserts:
 * an ordering read off a shuffled list, a Venn count computed by inclusion-exclusion, an age puzzle
 * solved from the equations it was built from. Anything whose answer is a matter of interpretation
 * is not here, because a candidate arguing with the marker has already lost the time.
 */
import type { Rng } from "../rng";
import type { Question } from "../types";

const NAMES = [
  "Ada", "Ben", "Cara", "Dev", "Elin", "Femi", "Gus", "Hana", "Ivo", "Juno",
];

interface Built {
  prompt: string;
  explanation: string;
  /** A numeric answer. */
  value?: number;
  /** Or a multiple choice: the options shown, and the text of the right one. */
  choices?: string[];
  correct?: string;
}

type Builder = (rng: Rng) => Built;

/** Ordering from pairwise comparisons — the answer is a name, so it is multiple choice. */
const ordering: Builder = (rng) => {
  const people = rng.shuffle(NAMES).slice(0, 4);
  // Truth: people[0] is tallest, descending to people[3]. The facts below pin that down exactly.
  const facts = [
    `${people[0]} is taller than ${people[1]}.`,
    `${people[2]} is shorter than ${people[1]}.`,
    `${people[3]} is the shortest.`,
  ];
  const position = rng.int(0, 3);
  const ordinal = ["tallest", "second tallest", "third tallest", "shortest"][position];
  return {
    prompt: `${rng.shuffle(facts).join(" ")} Who is the ${ordinal}?`,
    choices: rng.shuffle(people),
    correct: people[position],
    explanation: `The order from tallest is ${people.join(" > ")}, so the ${ordinal} is ${people[position]}.`,
  };
};

/** Inclusion-exclusion on two sets — a count, so it is numeric. */
const twoSets: Builder = (rng) => {
  const total = rng.pick([30, 40, 50, 60, 100]);
  // Built forwards from the four disjoint regions, so the overlap can never come out negative or
  // larger than either set — which is what happens if you pick the totals and solve backwards.
  const both = rng.int(2, Math.floor(total * 0.25));
  const rest = total - both;
  const onlyA = rng.int(1, Math.floor(rest * 0.45));
  const onlyB = rng.int(1, Math.floor(rest * 0.45));
  const neither = rest - onlyA - onlyB;
  const a = both + onlyA;
  const b = both + onlyB;
  return {
    prompt: `Of ${total} people, ${a} play chess and ${b} play go. ${neither} play neither. How many play both?`,
    value: both,
    explanation: `${a} + ${b} − both = ${total} − ${neither}, so both = ${a} + ${b} − ${total - neither} = ${both}.`,
  };
};

const ages: Builder = (rng) => {
  const childNow = rng.int(4, 16);
  const multiple = rng.int(2, 5);
  const parentNow = childNow * multiple;
  const years = rng.int(3, 12);
  return {
    prompt: `A parent is ${multiple} times as old as their child, who is ${childNow}. In ${years} years, how much older than the child will the parent be?`,
    value: parentNow - childNow,
    explanation: `The gap never changes: ${parentNow} − ${childNow} = ${parentNow - childNow}, in ${years} years as much as today.`,
  };
};

/** The counterfeit-coin weighing, which is a genuine deduction rather than a definition. */
const weighings: Builder = (rng) => {
  const coins = rng.pick([9, 12, 27, 30, 45, 81]);
  const n = Math.ceil(Math.log(coins) / Math.log(3) - 1e-9);
  return {
    prompt: `You have ${coins} identical-looking coins, exactly one of which is heavier. Using a balance scale, what is the smallest number of weighings that is guaranteed to find it?`,
    value: n,
    explanation: `Each weighing has three outcomes, so k weighings separate at most 3^k coins. 3^${n} = ${3 ** n} ≥ ${coins}, and 3^${n - 1} = ${3 ** (n - 1)} is not enough.`,
  };
};

const rateWork: Builder = (rng) => {
  const workers = rng.int(2, 8);
  const days = rng.int(2, 12);
  const newWorkers = rng.pick([workers * 2, Math.max(1, Math.floor(workers / 2))]);
  const newDays = (workers * days) / newWorkers;
  return {
    prompt: `${workers} people finish a job in ${days} days. Working at the same rate, how many days would ${newWorkers} people take?`,
    value: newDays,
    explanation: `The work is ${workers} × ${days} = ${workers * days} person-days, so ${workers * days} ÷ ${newWorkers} = ${newDays}.`,
  };
};

const handshakes: Builder = (rng) => {
  const n = rng.int(5, 14);
  return {
    prompt: `${n} people each shake hands once with everyone else. How many handshakes take place?`,
    value: (n * (n - 1)) / 2,
    explanation: `Each of ${n} shakes ${n - 1} hands, and every shake is counted twice: ${n} × ${n - 1} / 2 = ${(n * (n - 1)) / 2}.`,
  };
};

const clockAngle: Builder = (rng) => {
  const hour = rng.int(1, 12);
  const minute = rng.pick([0, 10, 15, 20, 30, 40, 45]);
  const raw = Math.abs(30 * hour - 5.5 * minute);
  const angle = Math.min(raw, 360 - raw);
  return {
    prompt: `What is the smaller angle between the hands of a clock at ${hour}:${String(minute).padStart(2, "0")}, in degrees?`,
    value: angle,
    explanation: `The hour hand sits at ${(30 * hour + 0.5 * minute) % 360}° and the minute hand at ${6 * minute}°. The gap is ${raw}°, so the smaller angle is ${angle}°.`,
  };
};

const MIX: Record<number, Builder[]> = {
  1: [handshakes, ages, twoSets],
  2: [handshakes, ages, twoSets, rateWork],
  3: [twoSets, rateWork, clockAngle, handshakes, ordering],
  4: [twoSets, rateWork, clockAngle, ordering, weighings],
  5: [clockAngle, ordering, weighings, twoSets, rateWork],
};

export function generateLogic(rng: Rng, level: number, id: string): Question {
  const built = rng.pick(MIX[Math.min(5, Math.max(1, level))])(rng);

  if (built.choices && built.correct) {
    return {
      id,
      kind: "logic",
      prompt: built.prompt,
      choices: built.choices,
      answer: { type: "choice", index: built.choices.indexOf(built.correct) },
      explanation: built.explanation,
    };
  }

  return {
    id,
    kind: "logic",
    prompt: built.prompt,
    answer: { type: "numeric", value: built.value ?? 0 },
    explanation: built.explanation,
  };
}
