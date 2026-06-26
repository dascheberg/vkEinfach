import { db } from "@/lib/db";
import { transactions, fiscalYears } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getActiveFiscalYear() {
  const [fy] = await db
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.isActive, true))
    .limit(1);
  return fy ?? null;
}

export async function getNextReceiptNumber(fiscalYearId: number): Promise<string> {
  const [fy] = await db
    .select({ dateFrom: fiscalYears.dateFrom })
    .from(fiscalYears)
    .where(eq(fiscalYears.id, fiscalYearId));

  const yearPrefix = fy
    ? new Date(fy.dateFrom).getFullYear().toString()
    : new Date().getFullYear().toString();

  const rows = await db
    .select({ rn: transactions.receiptNumber })
    .from(transactions)
    .where(eq(transactions.fiscalYearId, fiscalYearId));

  let maxNum = 0;
  for (const row of rows) {
    const m = row.rn?.match(/^\d{4}-(\d+)$/);
    if (m) {
      const n = parseInt(m[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${yearPrefix}-${String(maxNum + 1).padStart(4, "0")}`;
}
