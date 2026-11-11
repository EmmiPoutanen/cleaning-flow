/** @file Calendar-date validation shared by visit and report handlers. */

/**
 * Narrows to a YYYY-MM-DD string representing a real calendar date, rejecting rollover dates.
 *
 * @param value - Untrusted date value to validate.
 * @returns True for a valid calendar-date string, narrowing value to string; otherwise false.
 */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
