/** Parst ausgeklammerte Kontonummern aus Query-Parametern (?excl=140&excl=150 oder ?excl=140,150). */
export function parseExcludedNumbers(v: string | string[] | null | undefined): number[] {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  const nums = list
    .flatMap(s => s.split(","))
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isInteger(n));
  return Array.from(new Set(nums));
}
