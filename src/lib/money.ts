/**
 * All money in DuesDesk is integer cents. These are the only two places in
 * the codebase where dollars and cents are converted.
 */

export function formatCents(cents: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Parse user input like "350", "$350.5", "1,200.00" into integer cents.
 * Returns null for anything ambiguous — callers show a friendly error.
 * Integer math only; floats never touch a money value.
 */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [dollars, fraction = ""] = cleaned.split(".");
  const cents =
    parseInt(dollars, 10) * 100 +
    (fraction ? parseInt(fraction.padEnd(2, "0"), 10) : 0);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  if (cents > 10_000_000) return null; // $100,000 sanity cap, matches the DB check
  return cents;
}
