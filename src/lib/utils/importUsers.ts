import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

const VALID_ROLES = ["admin", "finanzen", "vorstand", "auditor", "member"];
const VALID_FUNCTIONS = ["M", "1.V", "2.V", "KW", "SW", "KS", "B1", "B2", "B3", "KP1", "KP2"];

export interface UserImportRow {
  name?: string;
  email?: string;
  username?: string;
  role?: string;
  function?: string;
  approved?: string;
  password?: string;
}

export interface ImportPreviewRow {
  status: "ok" | "warn" | "error";
  data: UserImportRow & { usernameGenerated?: string; passwordGenerated?: string };
  issues: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9.]/g, "");
}

export function generateUsername(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = slugify(parts[0] ?? "user");
  if (parts.length === 1) return first;
  const last = slugify(parts[parts.length - 1]);
  return `${first}.${last}`;
}

export function generatePassword(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "user";
  return `${first.toLowerCase()}24640`;
}

export function previewUserRow(row: UserImportRow): ImportPreviewRow {
  const issues: string[] = [];
  if (!row.name?.trim()) {
    return { status: "error", data: row, issues: ["Name fehlt"] };
  }

  const usernameGenerated = row.username?.trim() || generateUsername(row.name);
  const passwordGenerated = row.password?.trim() || generatePassword(row.name);

  if (!row.email?.trim() && !row.username?.trim()) {
    issues.push(`Benutzername wird generiert: ${usernameGenerated}`);
  }
  if (!row.password?.trim()) {
    issues.push(`Standard-Passwort: ${passwordGenerated}`);
  }
  if (row.role && !VALID_ROLES.includes(row.role.trim())) {
    issues.push(`Unbekannte Rolle '${row.role}' — wird auf 'member' gesetzt`);
  }
  if (row.function && !VALID_FUNCTIONS.includes(row.function.trim())) {
    issues.push(`Unbekannte Funktion '${row.function}' — wird auf 'M' gesetzt`);
  }

  return {
    status: issues.length > 0 ? "warn" : "ok",
    data: { ...row, usernameGenerated, passwordGenerated },
    issues,
  };
}

export async function importUsers(
  rows: UserImportRow[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const existing = await db
    .select({ email: user.email, username: user.username })
    .from(user);
  const existingEmails = new Set(existing.map((u) => u.email?.toLowerCase()).filter(Boolean));
  const existingUsernames = new Set(
    existing.map((u) => u.username?.toLowerCase()).filter(Boolean) as string[]
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name?.trim()) {
      skipped++;
      errors.push(`Zeile ${i + 2}: Name fehlt`);
      continue;
    }

    const name = row.name.trim();
    const email = row.email?.trim() || null;
    const role = VALID_ROLES.includes(row.role?.trim() ?? "") ? row.role!.trim() : "member";
    const func = VALID_FUNCTIONS.includes(row.function?.trim() ?? "") ? row.function!.trim() : "M";
    const approved =
      ["true", "ja", "1", "yes"].includes(row.approved?.trim().toLowerCase() ?? "");
    const password = row.password?.trim() || generatePassword(name);

    // Skip if email already exists
    if (email && existingEmails.has(email.toLowerCase())) {
      skipped++;
      continue;
    }

    // Generate unique username
    let baseUsername = row.username?.trim() || generateUsername(name);
    let username = baseUsername;
    let suffix = 2;
    while (existingUsernames.has(username.toLowerCase())) {
      username = `${baseUsername}${suffix}`;
      suffix++;
    }

    const effectiveEmail = email || `${username}@intern.local`;

    try {
      await auth.api.signUpEmail({
        body: { name, email: effectiveEmail, password },
      });

      await db.update(user).set({
        role,
        userFunction: func,
        approved,
        username,
      }).where(eq(user.email, effectiveEmail));

      existingEmails.add(effectiveEmail.toLowerCase());
      existingUsernames.add(username.toLowerCase());
      imported++;
    } catch {
      skipped++;
      errors.push(`Zeile ${i + 2}: ${name} — Fehler beim Anlegen`);
    }
  }

  return { imported, skipped, errors };
}
