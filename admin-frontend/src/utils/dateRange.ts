/** Date-range helpers for the dashboard filter (local-date based). */

export interface DateRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}

/** Format a Date to YYYY-MM-DD using its local date parts. */
export function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Current calendar month: 1st of this month → today. */
export function currentMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toInputDate(start), end: toInputDate(now) };
}

/** Last N days, inclusive of today. */
export function lastNDaysRange(n: number): DateRange {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (n - 1));
  return { start: toInputDate(start), end: toInputDate(now) };
}

/** Convert a YYYY-MM-DD range to inclusive ISO datetimes (UTC) for the API. */
export function toApiRange(range: DateRange): { startDate: string; endDate: string } {
  return {
    startDate: `${range.start}T00:00:00Z`,
    endDate: `${range.end}T23:59:59Z`,
  };
}

/** Parse a YYYY-MM-DD string into a local Date (no timezone shift). */
function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Human-readable label for a range, collapsing shared parts.
 * e.g. "Jun 1 – 22, 2026", "Jan 28 – Feb 3, 2026", "Dec 30, 2025 – Jan 2, 2026".
 */
export function formatRangeLabel(range: DateRange): string {
  if (!range.start || !range.end) return 'Select dates';
  const start = parseLocal(range.start);
  const end = parseLocal(range.end);

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (sameMonth) {
    // "Jun 1 – 22, 2026"
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startLabel} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    // "Jan 28 – Feb 3, 2026"
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startLabel} – ${endLabel}`;
  }
  // "Dec 30, 2025 – Jan 2, 2026"
  const startLabel = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}
