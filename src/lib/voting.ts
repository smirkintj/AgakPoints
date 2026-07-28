/**
 * Vote arithmetic shared between the PartyKit room and the Next.js app.
 *
 * Kept free of imports so the PartyKit bundle can pull it in directly.
 */

/**
 * Middle value of a vote spread. Even-sized spreads average the two middle
 * values and round to a whole number, because story points are integers.
 */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** True when everyone who voted landed on the same number. */
export function isConsensus(values: number[]): boolean {
  return values.length > 0 && new Set(values).size === 1;
}
