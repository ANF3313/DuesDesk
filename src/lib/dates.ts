/** Date-only helpers. Everything works on ISO "YYYY-MM-DD" strings in UTC. */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Advance a billing date by one cadence step, clamping to month end so
 * "Jan 31 monthly" bills Feb 28, Mar 31, Apr 30 — never skips a month.
 */
export function addCadence(
  iso: string,
  cadence: "monthly" | "quarterly" | "annually",
): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}
