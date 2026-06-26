import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  calculateAge,
  isRoundBirthday,
  calculateMemberYears,
  isMemberAnniversary,
  formatDate,
} from "@/lib/utils/calculations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const type = new URL(req.url).searchParams.get("type") ?? "all";

  const all = await db
    .select()
    .from(members)
    .where(eq(members.isActive, true))
    .orderBy(asc(members.lastName), asc(members.firstName));

  let rows = all;
  let filename = "mitglieder.csv";

  if (type === "jubilaeum") {
    rows = all.filter((m) => isMemberAnniversary(calculateMemberYears(m.joinedAt)));
    filename = "jubilaeumsliste.csv";
  } else if (type === "geburtstag") {
    rows = all.filter((m) => isRoundBirthday(calculateAge(m.birthDate)));
    filename = "geburtstagsliste.csv";
  }

  const BOM = "﻿";
  const header =
    "Nachname;Vorname;Geburtsdatum;Alter;Funktion;Eingetreten;Mitgliedsjahre;Telefon;Mobil;E-Mail;Beitrag bezahlt\r\n";

  const csvRows = rows
    .map((m) => {
      const age = calculateAge(m.birthDate);
      const years = calculateMemberYears(m.joinedAt);
      return [
        m.lastName,
        m.firstName,
        formatDate(m.birthDate),
        age !== null ? String(age) : "",
        m.function,
        formatDate(m.joinedAt),
        years !== null ? String(years) : "",
        m.phoneLandline ?? "",
        m.phoneMobile ?? "",
        m.email ?? "",
        m.feePaidCurrentYear ? "Ja" : "Nein",
      ]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(";");
    })
    .join("\r\n");

  const csv = BOM + header + csvRows;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
