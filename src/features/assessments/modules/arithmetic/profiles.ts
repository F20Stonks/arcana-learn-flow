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

export const ARITHMETIC_PROFILES: Record<string, ArithmeticProfile> = {
  [OPTIVER_PROFILE.id]: OPTIVER_PROFILE,
};
