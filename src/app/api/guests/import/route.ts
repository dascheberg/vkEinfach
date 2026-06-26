import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guests } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

interface GuestRow {
  lastName: string;
  firstName: string;
  contactInfo?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows: GuestRow[] = body.rows ?? [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Keine Zeilen übergeben" }, { status: 400 });
  }

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
    try {
      await db.insert(guests).values({
        lastName:    row.lastName.trim(),
        firstName:   row.firstName.trim(),
        contactInfo: row.contactInfo?.trim() || null,
        notes:       row.notes?.trim() || null,
      });
      imported++;
    } catch {
      skipped++;
      errors.push(`Zeile ${i + 2}: ${row.lastName}, ${row.firstName} — Fehler beim Einfügen`);
    }
  }

  return NextResponse.json({ imported, skipped, errors });
}
