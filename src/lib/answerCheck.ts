import { create, all } from "mathjs";

const math = create(all);

const DEFAULT_TOLERANCE_PCT = 0.02;

function withinTolerance(actual: number, expected: number, tolerancePct: number): boolean {
  if (!Number.isFinite(actual)) return false;
  if (expected === 0) return Math.abs(actual) < 1e-9;
  return Math.abs(actual - expected) / Math.abs(expected) <= tolerancePct;
}

export interface NumericVerdict {
  numericCorrect: boolean;
  /** null when the question is unitless (no unit expected at all) */
  unitCorrect: boolean | null;
}

/**
 * Checks a student's numeric(+unit) answer against the value the tutor embedded in the <choices>
 * tag. Unit correctness is checked by PHYSICAL EQUIVALENCE (m/s^2 accepted for N/kg, mm/s^2, ...),
 * not string match, using mathjs's unit algebra — a fixed, repeatable verdict rather than relying
 * on the model's own arithmetic each time.
 */
export function checkNumericAnswer(
  studentValue: string,
  studentUnit: string,
  expectedValue: string,
  expectedUnit: string,
  tolerancePct = DEFAULT_TOLERANCE_PCT,
): NumericVerdict {
  const expected = parseFloat(expectedValue);
  const hasExpectedUnit = expectedUnit.trim().length > 0;

  if (!hasExpectedUnit) {
    return { numericCorrect: withinTolerance(parseFloat(studentValue), expected, tolerancePct), unitCorrect: null };
  }

  if (!studentUnit.trim()) {
    // Unit omitted entirely — still credit a correct bare number (assumed already in the expected
    // unit's scale) but flag the unit as missing so grading can call that out separately.
    return { numericCorrect: withinTolerance(parseFloat(studentValue), expected, tolerancePct), unitCorrect: false };
  }

  try {
    const studentQty = math.unit(parseFloat(studentValue) || 0, studentUnit.trim());
    const expectedQty = math.unit(expected, expectedUnit.trim());
    if (!studentQty.equalBase(expectedQty)) return { numericCorrect: false, unitCorrect: false };
    const studentInExpectedScale = studentQty.toNumber(expectedUnit.trim());
    return { numericCorrect: withinTolerance(studentInExpectedScale, expected, tolerancePct), unitCorrect: true };
  } catch {
    // Unparseable unit string.
    return { numericCorrect: false, unitCorrect: false };
  }
}

export interface MatrixVerdict {
  correct: boolean;
}

/**
 * Cell-wise numeric-tolerance comparison against the expected matrix/vector the tutor embedded in
 * the tag. `expected` is rows joined by ";", cells within a row joined by ",".
 */
export function checkMatrixAnswer(
  cells: string[],
  expected: string,
  tolerancePct = DEFAULT_TOLERANCE_PCT,
): MatrixVerdict {
  const expectedCells = expected.split(";").flatMap((row) => row.split(",").map((c) => c.trim()));
  if (expectedCells.length !== cells.length) return { correct: false };
  const correct = cells.every((c, i) => {
    const a = parseFloat(c);
    const b = parseFloat(expectedCells[i]);
    return Number.isFinite(a) && Number.isFinite(b) && withinTolerance(a, b, tolerancePct);
  });
  return { correct };
}
