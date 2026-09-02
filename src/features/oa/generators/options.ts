/**
 * Options — payoffs, parity, spreads and breakevens.
 *
 * Akuna's assessment is the one that leans on this outright, and several others fold a handful in.
 * Everything here is expiry-value arithmetic and put-call parity, which is deliberate: those are
 * the parts a candidate is expected to have cold, and unlike a pricing model they have exact
 * answers a browser can check without a single assumption about volatility.
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

const strike = (rng: Rng) => rng.int(2, 24) * 5;

const callPayoff: Builder = (rng) => {
  const k = strike(rng);
  const s = k + rng.int(-30, 30);
  const value = Math.max(0, s - k);
  return {
    prompt: `A ${k}-strike call expires with the underlying at ${s}. What is it worth?`,
    value,
    explanation:
      value > 0
        ? `max(S − K, 0) = ${s} − ${k} = ${value}.`
        : `The underlying finished below the strike, so the call expires worthless at 0.`,
  };
};

const putPayoff: Builder = (rng) => {
  const k = strike(rng);
  const s = k + rng.int(-30, 30);
  const value = Math.max(0, k - s);
  return {
    prompt: `A ${k}-strike put expires with the underlying at ${s}. What is it worth?`,
    value,
    explanation:
      value > 0
        ? `max(K − S, 0) = ${k} − ${s} = ${value}.`
        : `The underlying finished above the strike, so the put expires worthless at 0.`,
  };
};

const longCallBreakeven: Builder = (rng) => {
  const k = strike(rng);
  const premium = rng.int(1, 12);
  return {
    prompt: `You buy a ${k}-strike call for ${premium}. Where is your breakeven at expiry?`,
    value: k + premium,
    explanation: `A long call breaks even at strike + premium = ${k} + ${premium} = ${k + premium}.`,
  };
};

const longPutBreakeven: Builder = (rng) => {
  const k = strike(rng);
  const premium = rng.int(1, 12);
  return {
    prompt: `You buy a ${k}-strike put for ${premium}. Where is your breakeven at expiry?`,
    value: k - premium,
    explanation: `A long put breaks even at strike − premium = ${k} − ${premium} = ${k - premium}.`,
  };
};

/** C − P = S − K, ignoring rates and dividends — the identity every options desk assumes you know. */
const putCallParity: Builder = (rng) => {
  const k = strike(rng);
  const s = k + rng.int(-20, 20);
  const known = rng.int(2, 20);
  const solveForCall = rng.chance(0.5);
  // C = P + S − K
  const call = solveForCall ? known + s - k : known;
  const put = solveForCall ? known : known - (s - k);
  return solveForCall
    ? {
        prompt: `The underlying is at ${s} and the ${k}-strike put is worth ${known}. Ignoring rates, what is the ${k}-strike call worth?`,
        value: call,
        explanation: `Put-call parity: C = P + S − K = ${known} + ${s} − ${k} = ${call}.`,
      }
    : {
        prompt: `The underlying is at ${s} and the ${k}-strike call is worth ${known}. Ignoring rates, what is the ${k}-strike put worth?`,
        value: put,
        explanation: `Put-call parity: P = C − S + K = ${known} − ${s} + ${k} = ${put}.`,
      };
};

const callSpreadMax: Builder = (rng) => {
  const lower = strike(rng);
  const gap = rng.pick([5, 10, 15, 20]);
  const debit = rng.int(1, gap - 1);
  const max = gap - debit;
  return {
    prompt: `You buy the ${lower}/${lower + gap} call spread for ${debit}. What is the most you can make?`,
    value: max,
    explanation: `The spread is worth at most the width, ${gap}. You paid ${debit}, so the maximum profit is ${gap} − ${debit} = ${max}.`,
  };
};

const callSpreadMaxLoss: Builder = (rng) => {
  const lower = strike(rng);
  const gap = rng.pick([5, 10, 20]);
  const debit = rng.int(1, gap - 1);
  return {
    prompt: `You buy the ${lower}/${lower + gap} call spread for ${debit}. What is the most you can lose?`,
    value: debit,
    explanation: `A debit spread's worst case is the premium paid: ${debit}.`,
  };
};

const straddlePayoff: Builder = (rng) => {
  const k = strike(rng);
  const s = k + rng.int(-40, 40);
  const cost = rng.int(4, 20);
  const value = Math.abs(s - k) - cost;
  return {
    prompt: `You buy the ${k}-strike straddle for ${cost}. The underlying expires at ${s}. What is your profit?`,
    value,
    explanation: `A straddle is worth |S − K| = ${Math.abs(s - k)} at expiry. Less the ${cost} paid, that is ${value}.`,
  };
};

const intrinsicVsExtrinsic: Builder = (rng) => {
  const k = strike(rng);
  const s = k + rng.int(1, 25);
  const price = s - k + rng.int(1, 10);
  return {
    prompt: `The underlying is at ${s}. The ${k}-strike call trades at ${price}. How much of that is extrinsic value?`,
    value: price - (s - k),
    explanation: `Intrinsic is ${s} − ${k} = ${s - k}. Extrinsic is the rest: ${price} − ${s - k} = ${price - (s - k)}.`,
  };
};

const coveredCall: Builder = (rng) => {
  const k = strike(rng);
  const buy = k - rng.int(1, 15);
  const premium = rng.int(1, 8);
  const value = k - buy + premium;
  return {
    prompt: `You buy the underlying at ${buy} and sell the ${k}-strike call for ${premium}. What is the most you can make by expiry?`,
    value,
    explanation: `Capped at the strike: (${k} − ${buy}) + ${premium} = ${value}.`,
  };
};

const MIX: Record<number, Builder[]> = {
  1: [callPayoff, putPayoff],
  2: [callPayoff, putPayoff, longCallBreakeven, longPutBreakeven],
  3: [callPayoff, putPayoff, longCallBreakeven, longPutBreakeven, callSpreadMax, callSpreadMaxLoss],
  4: [putCallParity, callSpreadMax, straddlePayoff, intrinsicVsExtrinsic, coveredCall],
  5: [putCallParity, straddlePayoff, intrinsicVsExtrinsic, coveredCall, callSpreadMax],
};

export function generateOptions(rng: Rng, level: number, id: string): Question {
  const built = rng.pick(MIX[Math.min(5, Math.max(1, level))])(rng);
  return {
    id,
    kind: "options",
    prompt: built.prompt,
    answer: { type: "numeric", value: built.value, tolerance: built.tolerance },
    explanation: built.explanation,
  };
}
