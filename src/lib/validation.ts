/**
 * Shared validation helpers for the application.
 */

/**
 * Validate a performance rating value (1.0–5.0, max 1 decimal place).
 * Returns an error message or null if valid.
 */
export function validateRating(value: number): string | null {
  if (isNaN(value)) return 'Enter a value between 1.0 and 5.0 (max 1 decimal place)';
  if (value < 1 || value > 5) return 'Enter a value between 1.0 and 5.0 (max 1 decimal place)';
  const decimalPart = value.toString().split('.')[1];
  if (decimalPart && decimalPart.length > 1) return 'Enter a value between 1.0 and 5.0 (max 1 decimal place)';
  return null;
}

/**
 * Normalize a rating to one decimal place.
 */
export function normalizeRating(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Check if a set of weights sums to 1.0 (within tolerance).
 */
export function weightsAreValid(weights: object, tolerance = 0.01): boolean {
  const sum = weightSum(weights);
  return Math.abs(sum - 1) < tolerance;
}

/**
 * Calculate the sum of weight values.
 */
export function weightSum(weights: object): number {
  return (Object.values(weights) as number[]).reduce((a, b) => a + b, 0);
}
