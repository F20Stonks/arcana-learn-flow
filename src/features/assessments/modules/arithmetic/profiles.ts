/**
 * Arithmetic profiles.
 *
 * The speed battery is one engine; a firm is a profile over it. Optiver's 80-in-8 and Akuna's
 * 80-in-8 differ in their operation mix, not in their code — Akuna's is reported as heavier on
 * division and fractions, Jane Street's on multiplication, division, percentages and decimals.
 *
 * A weight of 0 switches an operation off. Weights are relative, not percentages, so a profile can
 * be tuned by nudging one number without rebalancing the rest.
 */

export type ArithmeticOp =
  | "add"
  | "sub"
  | "mul_2x1"
  | "mul_2x2"
  | "div_exact"
  | "decimal_addsub"
  | "decimal_mul"
  | "fraction_addsub"
  | "percent_of"
  | "missing_operand";

export interface ArithmeticProfile {
  id: string;
  weights: Record<ArithmeticOp, number>;
  /** Subtraction may produce a negative result. The real tests do include them. */
  allowNegative: boolean;
}

const NONE: Record<ArithmeticOp, number> = {
  add: 0,
  sub: 0,
  mul_2x1: 0,
  mul_2x2: 0,
  div_exact: 0,
  decimal_addsub: 0,
  decimal_mul: 0,
  fraction_addsub: 0,
  percent_of: 0,
  missing_operand: 0,
};

/**
 * Optiver 80-in-8. Candidate reports describe integers, decimals, fractions and missing-operand
 * forms across all four operations, at roughly six seconds an item — so the mix is broad and the
 * individual items are small.
 */
export const OPTIVER_PROFILE: ArithmeticProfile = {
  id: "optiver-80-in-8",
  weights: {
    ...NONE,
    add: 18,
    sub: 16,
    mul_2x1: 14,
    mul_2x2: 10,
    div_exact: 16,
    decimal_addsub: 8,
    decimal_mul: 6,
    fraction_addsub: 4,
    percent_of: 5,
    missing_operand: 3,
  },
  allowNegative: true,
};

/**
 * Jane Street mental math. Candidate reports describe it as multiplication- and division-heavy,
 * with real weight on percentages and decimals, and comparatively little plain addition — so
 * addition is the one operation pulled well below Optiver's mix rather than just reshuffled.
 */
export const JANE_STREET_PROFILE: ArithmeticProfile = {
  id: "jane-street-mental-math",
  weights: {
    ...NONE,
    add: 6,
    sub: 10,
    mul_2x1: 18,
    mul_2x2: 16,
    div_exact: 18,
    decimal_addsub: 10,
    decimal_mul: 10,
    fraction_addsub: 6,
    percent_of: 12,
    missing_operand: 4,
  },
  allowNegative: true,
};

/**
 * Akuna Capital. Reported as Optiver-shaped overall but noticeably heavier on division and
 * fractions, so this profile starts from Optiver's mix and moves weight from addition/
 * subtraction into div_exact and fraction_addsub specifically, rather than a fresh mix.
 */
export const AKUNA_PROFILE: ArithmeticProfile = {
  id: "akuna-math-test",
  weights: {
    ...NONE,
    add: 14,
    sub: 14,
    mul_2x1: 10,
    mul_2x2: 8,
    div_exact: 24,
    decimal_addsub: 8,
    decimal_mul: 6,
    fraction_addsub: 10,
    percent_of: 4,
    missing_operand: 2,
  },
  allowNegative: true,
};

/**
 * Flow Traders math test. Candidate reports describe integers, decimals and fractions; nobody
 * reports percentage or missing-operand items on this one, so both are switched off rather than
 * given a token low weight — this is the multiple-choice battery (see modules/arithmetic/index.ts
 * and distractors.ts).
 */
export const FLOW_TRADERS_PROFILE: ArithmeticProfile = {
  id: "flow-traders-math-test",
  weights: {
    ...NONE,
    add: 20,
    sub: 18,
    mul_2x1: 14,
    mul_2x2: 10,
    div_exact: 16,
    decimal_addsub: 10,
    decimal_mul: 8,
    fraction_addsub: 4,
    percent_of: 0,
    missing_operand: 0,
  },
  allowNegative: true,
};

/**
 * All Options. Candidate reports don't distinguish its arithmetic mix from Optiver's own 80-in-8,
 * so this mirrors OPTIVER_PROFILE's weights value-for-value rather than guessing a difference that
 * isn't reported. It keeps its own id anyway, so the firm stays a first-class entry a candidate can
 * pick and score against separately even though the mix underneath is the same.
 */
export const ALL_OPTIONS_PROFILE: ArithmeticProfile = {
  id: "all-options-math-test",
  weights: {
    ...NONE,
    add: 18,
    sub: 16,
    mul_2x1: 14,
    mul_2x2: 10,
    div_exact: 16,
    decimal_addsub: 8,
    decimal_mul: 6,
    fraction_addsub: 4,
    percent_of: 5,
    missing_operand: 3,
  },
  allowNegative: true,
};

/**
 * IMC mental math. Candidate reports converge on two named drills — two-digit-by-two-digit
 * multiplication and percentages — so those two carry most of the weight, with the rest kept on
 * at a low level for coverage rather than switched off entirely.
 */
export const IMC_PROFILE: ArithmeticProfile = {
  id: "imc-mental-math",
  weights: {
    ...NONE,
    add: 6,
    sub: 6,
    mul_2x1: 10,
    mul_2x2: 30,
    div_exact: 8,
    decimal_addsub: 4,
    decimal_mul: 4,
    fraction_addsub: 2,
    percent_of: 28,
    missing_operand: 2,
  },
  allowNegative: true,
};

export const ARITHMETIC_PROFILES: Record<string, ArithmeticProfile> = {
  [OPTIVER_PROFILE.id]: OPTIVER_PROFILE,
  [JANE_STREET_PROFILE.id]: JANE_STREET_PROFILE,
  [AKUNA_PROFILE.id]: AKUNA_PROFILE,
  [FLOW_TRADERS_PROFILE.id]: FLOW_TRADERS_PROFILE,
  [ALL_OPTIONS_PROFILE.id]: ALL_OPTIONS_PROFILE,
  [IMC_PROFILE.id]: IMC_PROFILE,
};
