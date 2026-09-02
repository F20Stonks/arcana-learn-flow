/**
 * Market making — quoting, getting filled, and knowing your position afterwards.
 *
 * This is the part of an OA that is not really a maths test. The arithmetic is trivial; what is
 * being checked is whether "you are hit on your bid" instantly means *long, at your bid* rather
 * than a sentence you have to translate first. So every question here is posed in desk language
 * and the explanation says the translation out loud.
 */
import type { Rng } from "../rng";
import type { Question } from "../types";

interface Built {
  prompt: string;
  value: number;
  explanation: string;
  tolerance?: number;
}

type Builder = (rng: Rng) => Built;

/** Fair value of a game, which is the number every quote is built around. */
function diceSumFair(n: number, faces: number): number {
  return (n * (faces + 1)) / 2;
}

const quoteAroundFair: Builder = (rng) => {
  const n = rng.int(2, 4);
  const faces = rng.pick([6, 8]);
  const width = rng.pick([2, 4, 6]);
  const fair = diceSumFair(n, faces);
  const bid = fair - width / 2;
  return {
    prompt: `A contract settles at the total of ${n} fair ${faces}-sided dice. You want to show a ${width}-wide market around fair value. What is your bid?`,
    value: bid,
    explanation: `Fair is ${n} × ${(faces + 1) / 2} = ${fair}. A ${width}-wide market around it is ${bid} at ${fair + width / 2}, so the bid is ${bid}.`,
  };
};

const widthOfMarket: Builder = (rng) => {
  const bid = rng.int(20, 180);
  const width = rng.int(1, 12);
  return {
    prompt: `The market is ${bid} bid, ${bid + width} offered. How wide is it?`,
    value: width,
    explanation: `Width is offer − bid = ${bid + width} − ${bid} = ${width}.`,
  };
};

const positionAfterFill: Builder = (rng) => {
  const bid = rng.int(30, 90);
  const width = rng.pick([2, 4]);
  const size = rng.int(5, 50);
  const hit = rng.chance(0.5);
  return {
    prompt: `You are quoting ${bid} bid / ${bid + width} offered, ${size} up. A counterparty ${hit ? "hits your bid" : "lifts your offer"}. What is your position, in lots (long positive, short negative)?`,
    value: hit ? size : -size,
    explanation: hit
      ? `Hitting your bid means they sold to you, so you are long ${size}.`
      : `Lifting your offer means they bought from you, so you are short ${size}.`,
  };
};

const edgeCaptured: Builder = (rng) => {
  const fair = rng.int(40, 160);
  const width = rng.pick([2, 4, 6, 8]);
  const size = rng.int(2, 25);
  const hit = rng.chance(0.5);
  const edge = (width / 2) * size;
  return {
    prompt: `Fair value is ${fair}. You quote ${fair - width / 2} / ${fair + width / 2} and are ${hit ? "hit on the bid" : "lifted on the offer"} for ${size} lots. How much theoretical edge have you captured, in dollars?`,
    value: edge,
    explanation: `You traded ${width / 2} away from fair on ${size} lots, so ${width / 2} × ${size} = ${edge}.`,
  };
};

const pnlAfterMove: Builder = (rng) => {
  const entry = rng.int(40, 120);
  const size = rng.int(3, 30);
  const move = rng.int(-9, 9) || 3;
  const long = rng.chance(0.5);
  const pnl = (long ? 1 : -1) * size * move;
  return {
    prompt: `You are ${long ? "long" : "short"} ${size} lots at ${entry}. The market settles at ${entry + move}. What is your P&L, in dollars?`,
    value: pnl,
    explanation: `${long ? "Long" : "Short"} ${size} and the price moved ${move > 0 ? "up" : "down"} ${Math.abs(move)}, so ${long ? "" : "−"}${size} × ${move} = ${pnl}.`,
  };
};

const averagePrice: Builder = (rng) => {
  const p1 = rng.int(40, 80);
  const q1 = rng.pick([10, 20, 25, 50]);
  const p2 = p1 + rng.int(2, 12);
  const q2 = rng.pick([10, 20, 25, 50]);
  const avg = (p1 * q1 + p2 * q2) / (q1 + q2);
  return {
    prompt: `You buy ${q1} lots at ${p1} and then ${q2} lots at ${p2}. What is your average price?`,
    value: avg,
    explanation: `(${p1} × ${q1} + ${p2} × ${q2}) / ${q1 + q2} = ${avg.toFixed(4)}.`,
    tolerance: 0.005,
  };
};

/** Whether the quote on screen is one you should trade against at all. */
const whichSide: Builder = (rng) => {
  const fair = rng.int(50, 150);
  const skew = rng.int(3, 12);
  const cheap = rng.chance(0.5);
  // Their market sits entirely below fair (buy it) or entirely above (sell it).
  const bid = cheap ? fair - skew - 2 : fair + skew;
  const ask = bid + 2;
  return {
    prompt: `You believe fair value is ${fair}. Another trader shows ${bid} bid / ${ask} offered. How much theoretical edge is there in trading one lot against the better side?`,
    value: cheap ? fair - ask : bid - fair,
    explanation: cheap
      ? `Their offer of ${ask} is below your fair of ${fair}, so you buy it and pick up ${fair} − ${ask} = ${fair - ask}.`
      : `Their bid of ${bid} is above your fair of ${fair}, so you sell it and pick up ${bid} − ${fair} = ${bid - fair}.`,
  };
};

const breakEvenFill: Builder = (rng) => {
  const size = rng.int(4, 20);
  const buy = rng.int(40, 90);
  const soldQty = rng.int(1, size - 1);
  const soldAt = buy + rng.int(2, 10);
  const remaining = size - soldQty;
  // Price at which the rest must be sold to end flat on the whole position.
  const target = (buy * size - soldAt * soldQty) / remaining;
  return {
    prompt: `You bought ${size} lots at ${buy} and have sold ${soldQty} of them at ${soldAt}. At what price must you sell the remaining ${remaining} to break even overall?`,
    value: target,
    explanation: `Cost was ${buy * size}; you have taken in ${soldAt * soldQty}. The rest must fetch ${buy * size - soldAt * soldQty} over ${remaining} lots = ${target.toFixed(4)}.`,
    tolerance: 0.005,
  };
};

const MIX: Record<number, Builder[]> = {
  1: [widthOfMarket, positionAfterFill, pnlAfterMove],
  2: [widthOfMarket, positionAfterFill, pnlAfterMove, quoteAroundFair],
  3: [positionAfterFill, pnlAfterMove, quoteAroundFair, edgeCaptured, averagePrice],
  4: [quoteAroundFair, edgeCaptured, averagePrice, whichSide, breakEvenFill],
  5: [edgeCaptured, whichSide, breakEvenFill, averagePrice, quoteAroundFair],
};

export function generateMarketMaking(rng: Rng, level: number, id: string): Question {
  const built = rng.pick(MIX[Math.min(5, Math.max(1, level))])(rng);
  return {
    id,
    kind: "market-making",
    prompt: built.prompt,
    answer: { type: "numeric", value: built.value, tolerance: built.tolerance },
    explanation: built.explanation,
  };
}
