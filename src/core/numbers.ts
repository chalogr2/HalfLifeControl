/**
 * Parse a user-typed positive decimal ("2.5", "2,5", " 8 ", ".5", "12.").
 *
 * Android numeric keyboards emit the locale's decimal separator, so a
 * Spanish/European device types "0,5". `parseFloat("0,5")` is 0 and
 * `parseFloat("2,5")` silently truncates to 2, which is why we normalise the
 * comma first and reject anything that isn't a plain number instead of
 * guessing. Returns null for empty, non-numeric, zero or negative input.
 */
export function parsePositiveNumber(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}
