import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

interface MemberRow {
  lastName: string;
  firstName: string;
  street?: string;
  zip?: string;
  city?: string;
  birthDate?: string;
  phoneLandline?: string;
  phoneMobile?: string;
  email?: string;
  function?: string;
  joinedAt?: string;
  leftAt?: string;
  isActive?: boolean;
  feePaidCurrentYear?: boolean;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows: MemberRow[] = body.rows ?? [];

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

    const VALID_FUNCTIONS = ["M", "1.V", "2.V", "KW", "SW", "KS", "B1", "B2", "B3", "KP1", "KP2"];
    const func = row.function?.trim() ?? "M";

    try {
      await db.insert(members).values({
        lastName:           row.lastName.trim(),
        firstName:          row.firstName.trim(),
        street:             row.street?.trim() || null,
        zip:                row.zip?.trim() || null,
        city:               row.city?.trim() || null,
        birthDate:          row.birthDate || null,
        phoneLandline:      row.phoneLandline?.trim() || null,
        phoneMobile:        row.phoneMobile?.trim() || null,
        email:              row.email?.trim() || null,
        function:           VALID_FUNCTIONS.includes(func) ? func : "M",
        joinedAt:           row.joinedAt || null,
        leftAt:             row.leftAt || null,
        isActive:           row.isActive ?? true,
        feePaidCurrentYear: row.feePaidCurrentYear ?? false,
        notes:              row.notes?.trim() || null,
      });
      imported++;
    } catch {
      skipped++;
      errors.push(`Zeile ${i + 2}: ${row.lastName}, ${row.firstName} — Fehler beim Einfügen`);
    }
  }

  return NextResponse.json({ imported, skipped, errors });
}
