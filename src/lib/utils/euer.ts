/** Parst ausgeklammerte Kontonummern aus Query-Parametern (?excl=140&excl=150 oder ?excl=140,150). */
export function parseExcludedNumbers(v: string | string[] | null | undefined): number[] {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  const nums = list
    .flatMap(s => s.split(","))
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isInteger(n));
  return Array.from(new Set(nums));
}

export type EuerAccountRow = { number: number; name: string; totalIn: string; totalOut: string };
export type EuerLine = { number: number; name: string; total: number };

/**
 * Verteilt Konten nach ihrem Saldo (Einnahmen − Ausgaben) auf die EÜR-Seiten:
 * Saldo > 0 → Einnahmen, Saldo < 0 → Ausgaben, Saldo = 0 → entfällt.
 */
export function splitBySaldo(rows: EuerAccountRow[]): { incomeRows: EuerLine[]; expenseRows: EuerLine[] } {
  const incomeRows: EuerLine[] = [];
  const expenseRows: EuerLine[] = [];
  for (const r of rows) {
    const saldo = Math.round((parseFloat(r.totalIn) - parseFloat(r.totalOut)) * 100) / 100;
    if (saldo > 0) incomeRows.push({ number: r.number, name: r.name, total: saldo });
    else if (saldo < 0) expenseRows.push({ number: r.number, name: r.name, total: -saldo });
  }
  return { incomeRows, expenseRows };
}
