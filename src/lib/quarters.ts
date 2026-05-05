/**
 * Quarterly Time Machine — helper utilities
 *
 * Generates a list of completed fiscal quarters from a given start date
 * up to (but not including) the current live quarter.
 */

export interface Quarter {
  label: string;   // e.g. "Q1 2025"
  endDate: string; // ISO date of last trading day of that quarter (approx)
}

/** Returns ISO date string for the last calendar day of a quarter */
function quarterEndDate(year: number, q: number): string {
  const endMonths = [3, 6, 9, 12]; // Mar, Jun, Sep, Dec
  const month = endMonths[q - 1];
  // Last day of that month
  const lastDay = new Date(year, month, 0); // day 0 = last day of prev month
  return lastDay.toISOString().split('T')[0];
}

/**
 * Builds a list of completed quarters between firstTxDate and today.
 * A quarter is "completed" only if its end date is strictly before today.
 */
export function buildQuarterList(firstTxDate: string): Quarter[] {
  if (!firstTxDate) return [];

  const start = new Date(firstTxDate);
  if (isNaN(start.getTime())) return [];
  const today = new Date();

  const quarters: Quarter[] = [];

  // Find the quarter that contains the first transaction
  let year = start.getFullYear();
  let q = Math.ceil((start.getMonth() + 1) / 3); // 1-4

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const endDate = quarterEndDate(year, q);
    const end = new Date(endDate);

    // Only include quarters that have fully ended before today
    if (end >= today) break;

    quarters.push({
      label: `Q${q} ${year}`,
      endDate,
    });

    // Advance to next quarter
    q++;
    if (q > 4) {
      q = 1;
      year++;
    }
  }

  return quarters;
}
