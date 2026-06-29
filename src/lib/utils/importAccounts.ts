import { db } from "@/lib/db";
import { internalAccounts } from "@/lib/db/schema";

const VALID_KINDS = ["income", "expense", "neutral", "transfer", "cancel"];

export interface AccountImportRow {
  number?: string;
  name?: string;
  accountKind?: string;
}

export interface ImportPreviewRow {
  status: "ok" | "warn" | "error";
  data: AccountImportRow;
  issues: string[];
}

export function previewAccountRow(row: AccountImportRow): ImportPreviewRow {
  const issues: string[] = [];
  const num = parseInt(row.number ?? "");
  if (!row.number?.trim()) {
    issues.push("Kontonummer fehlt");
  } else if (isNaN(num) || num < 1 || num > 9999) {
    issues.push("Kontonummer muss eine Zahl zwischen 1 und 9999 sein");
  }
  if (!row.name?.trim()) {
    issues.push("Bezeichnung fehlt");
  }
  if (row.accountKind && !VALID_KINDS.includes(row.accountKind.trim())) {
    issues.push(`Unbekannter Typ '${row.accountKind}' — wird auf 'income' gesetzt`);
  }
  const hasError = issues.some((i) => i.includes("fehlt") || i.includes("muss eine Zahl"));
  return {
    status: hasError ? "error" : issues.length > 0 ? "warn" : "ok",
    data: row,
    issues,
  };
}

export async function importAccounts(
  rows: AccountImportRow[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const existing = await db.select({ number: internalAccounts.number }).from(internalAccounts);
  const existingNumbers = new Set(existing.map((r) => r.number));

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const num = parseInt(row.number ?? "");
    if (isNaN(num) || !row.name?.trim()) {
      skipped++;
      errors.push(`Zeile ${i + 2}: Nummer oder Bezeichnung fehlt`);
      continue;
    }
    if (existingNumbers.has(num)) {
      skipped++;
      continue;
    }
    const kind = VALID_KINDS.includes(row.accountKind?.trim() ?? "")
      ? row.accountKind!.trim()
      : "income";
    try {
      await db.insert(internalAccounts).values({
        number: num,
        name: row.name.trim(),
        accountKind: kind,
        isActive: true,
      });
      existingNumbers.add(num);
      imported++;
    } catch {
      skipped++;
      errors.push(`Zeile ${i + 2}: Konto ${num} — Fehler beim Einfügen`);
    }
  }

  return { imported, skipped, errors };
}
