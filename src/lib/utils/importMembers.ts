import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";

const VALID_FUNCTIONS = ["M", "1.V", "2.V", "KW", "SW", "KS", "B1", "B2", "B3", "KP1", "KP2"];

export function parseDate(val: string | undefined): string | null {
  if (!val?.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  const m = val.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parseBool(val: string | undefined, defaultVal: boolean): boolean {
  if (!val?.trim()) return defaultVal;
  return ["true", "ja", "1", "yes"].includes(val.trim().toLowerCase());
}

export interface MemberImportRow {
  lastName?: string;
  firstName?: string;
  street?: string;
  zip?: string;
  city?: string;
  birthDate?: string;
  phoneLandline?: string;
  phoneMobile?: string;
  email?: string;
  function?: string;
  joinedAt?: string;
  isActive?: string;
  feePaidCurrentYear?: string;
  notes?: string;
}

export interface ImportPreviewRow {
  status: "ok" | "warn" | "error";
  data: MemberImportRow;
  issues: string[];
}

export function previewMemberRow(row: MemberImportRow): ImportPreviewRow {
  const issues: string[] = [];
  if (!row.lastName?.trim()) issues.push("Nachname fehlt");
  if (!row.firstName?.trim()) issues.push("Vorname fehlt");
  if (row.birthDate?.trim() && !parseDate(row.birthDate)) {
    issues.push(`Ungültiges Datum: ${row.birthDate}`);
  }
  if (row.joinedAt?.trim() && !parseDate(row.joinedAt)) {
    issues.push(`Ungültiges Eintrittsdatum: ${row.joinedAt}`);
  }
  if (row.function?.trim() && !VALID_FUNCTIONS.includes(row.function.trim())) {
    issues.push(`Unbekannte Funktion '${row.function}' — wird auf 'M' gesetzt`);
  }
  const hasError = issues.some((i) => i.includes("fehlt"));
  return {
    status: hasError ? "error" : issues.length > 0 ? "warn" : "ok",
    data: row,
    issues,
  };
}

export async function importMembers(
  rows: MemberImportRow[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.lastName?.trim() || !row.firstName?.trim()) {
      skipped++;
      errors.push(`Zeile ${i + 2}: Nachname und Vorname erforderlich`);
      continue;
    }

    const func = VALID_FUNCTIONS.includes(row.function?.trim() ?? "")
      ? row.function!.trim()
      : "M";

    try {
      await db.insert(members).values({
        lastName:           row.lastName.trim(),
        firstName:          row.firstName.trim(),
        street:             row.street?.trim() || null,
        zip:                row.zip?.trim() || null,
        city:               row.city?.trim() || null,
        birthDate:          parseDate(row.birthDate),
        phoneLandline:      row.phoneLandline?.trim() || null,
        phoneMobile:        row.phoneMobile?.trim() || null,
        email:              row.email?.trim() || null,
        function:           func,
        joinedAt:           parseDate(row.joinedAt),
        isActive:           parseBool(row.isActive, true),
        feePaidCurrentYear: parseBool(row.feePaidCurrentYear, false),
        notes:              row.notes?.trim() || null,
      });
      imported++;
    } catch {
      skipped++;
      errors.push(
        `Zeile ${i + 2}: ${row.lastName}, ${row.firstName} — Fehler beim Einfügen`
      );
    }
  }

  return { imported, skipped, errors };
}
