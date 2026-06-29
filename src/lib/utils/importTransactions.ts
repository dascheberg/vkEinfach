import { db } from "@/lib/db";
import { transactions, externalAccounts, internalAccounts } from "@/lib/db/schema";
import { getNextReceiptNumber } from "./transactions";

function parseDate(val: string | undefined): string | null {
  if (!val?.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  const m = val.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function normalizeDirection(val: string | undefined): "in" | "out" | null {
  const v = val?.trim().toLowerCase() ?? "";
  if (v === "in" || v === "ein") return "in";
  if (v === "out" || v === "aus") return "out";
  return null;
}

export interface TransactionImportRow {
  bookingDate?: string;
  amount?: string;
  direction?: string;
  externalAccountName?: string;
  internalAccountNumber?: string;
  description?: string;
  memberLastName?: string;
}

export interface ImportPreviewRow {
  status: "ok" | "warn" | "error";
  data: TransactionImportRow;
  issues: string[];
}

export function previewTransactionRow(row: TransactionImportRow): ImportPreviewRow {
  const issues: string[] = [];
  if (!row.bookingDate?.trim()) {
    issues.push("Buchungsdatum fehlt");
  } else if (!parseDate(row.bookingDate)) {
    issues.push(`Ungültiges Datum: ${row.bookingDate}`);
  }
  const amountRaw = parseFloat(row.amount?.replace(",", ".") ?? "");
  if (!row.amount?.trim()) {
    issues.push("Betrag fehlt");
  } else if (isNaN(amountRaw) || amountRaw <= 0) {
    issues.push("Betrag ungültig");
  }
  if (!row.direction?.trim()) {
    issues.push("Richtung fehlt");
  } else if (!normalizeDirection(row.direction)) {
    issues.push("Richtung muss 'in', 'out', 'ein' oder 'aus' sein");
  }
  if (!row.externalAccountName?.trim()) issues.push("Ext. Konto fehlt");
  if (!row.internalAccountNumber?.trim()) issues.push("Int. Konto-Nummer fehlt");

  const hasError = issues.some((i) => i.includes("fehlt") || i.includes("ungültig"));
  return {
    status: hasError ? "error" : issues.length > 0 ? "warn" : "ok",
    data: row,
    issues,
  };
}

export async function importTransactions(
  rows: TransactionImportRow[],
  createdBy: number,
  fiscalYearId: number
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const extAccounts = await db.select().from(externalAccounts);
  const intAccounts = await db.select().from(internalAccounts);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const date = parseDate(row.bookingDate);
    const amountRaw = parseFloat(row.amount?.replace(",", ".") ?? "");
    const direction = normalizeDirection(row.direction);

    if (!date || isNaN(amountRaw) || amountRaw <= 0 || !direction) {
      skipped++;
      errors.push(`Zeile ${i + 2}: Datum, Betrag oder Richtung ungültig`);
      continue;
    }

    const extVal = row.externalAccountName?.trim() ?? "";
    const extAccount = extAccounts.find(
      (a) =>
        a.name.toLowerCase() === extVal.toLowerCase() ||
        String(a.sortOrder) === extVal ||
        String(a.id) === extVal
    );
    const intNum = parseInt(row.internalAccountNumber ?? "");
    const intAccount = intAccounts.find((a) => a.number === intNum);

    if (!extAccount) {
      skipped++;
      errors.push(
        `Zeile ${i + 2}: Ext. Konto '${row.externalAccountName}' nicht gefunden`
      );
      continue;
    }
    if (!intAccount) {
      skipped++;
      errors.push(`Zeile ${i + 2}: Int. Konto ${intNum} nicht gefunden`);
      continue;
    }

    try {
      const receiptNumber = await getNextReceiptNumber(fiscalYearId);
      await db.insert(transactions).values({
        receiptNumber,
        bookingDate:       date,
        fiscalYearId,
        amount:            amountRaw.toFixed(2),
        direction,
        externalAccountId: extAccount.id,
        internalAccountId: intAccount.id,
        description:       row.description?.trim() || null,
        createdBy,
      });
      imported++;
    } catch {
      skipped++;
      errors.push(`Zeile ${i + 2}: Fehler beim Einfügen`);
    }
  }

  return { imported, skipped, errors };
}
