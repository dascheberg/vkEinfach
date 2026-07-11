import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { dayMonthKey, formatDate } from "@/lib/utils/calculations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from und to erforderlich" }, { status: 400 });

  const fromKey = dayMonthKey(from);
  const toKey   = dayMonthKey(to);
  const toYear  = parseInt(to.slice(0, 4));

  const rows = await db
    .select({
      lastName:  members.lastName,
      firstName: members.firstName,
      birthDate: members.birthDate,
    })
    .from(members)
    .where(and(
      eq(members.isActive, true),
      isNotNull(members.birthDate),
      sql`(EXTRACT(MONTH FROM ${members.birthDate})::int * 100 + EXTRACT(DAY FROM ${members.birthDate})::int) BETWEEN ${fromKey} AND ${toKey}`,
    ))
    .orderBy(
      sql`EXTRACT(MONTH FROM ${members.birthDate})`,
      sql`EXTRACT(DAY FROM ${members.birthDate})`,
      members.lastName,
    );

  const BOM = "﻿";
  const header = "Nachname;Vorname;Geburtsdatum;Alter wird\r\n";
  const csvRows = rows
    .map(m => {
      const age = toYear - parseInt(m.birthDate!.slice(0, 4));
      return [m.lastName, m.firstName, formatDate(m.birthDate), String(age)]
        .map(v => `"${v.replace(/"/g, '""')}"`)
        .join(";");
    })
    .join("\r\n");

  const csv = BOM + header + csvRows;

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="geburtstage-${from}-bis-${to}.csv"`,
    },
  });
}
