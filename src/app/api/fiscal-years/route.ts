import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalYears } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select()
    .from(fiscalYears)
    .orderBy(asc(fiscalYears.dateFrom));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    if (!body.label?.trim() || !body.dateFrom || !body.dateTo) {
      return NextResponse.json({ error: "Bezeichnung, Beginn und Ende sind erforderlich." }, { status: 400 });
    }
    if (body.dateFrom >= body.dateTo) {
      return NextResponse.json({ error: "Beginn muss vor Ende liegen." }, { status: 400 });
    }

    const [row] = await db
      .insert(fiscalYears)
      .values({
        label:    body.label.trim(),
        dateFrom: body.dateFrom,
        dateTo:   body.dateTo,
        isActive: false,
        isClosed: false,
        notes:    body.notes?.trim() || null,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    console.error("POST /api/fiscal-years:", e);
    return NextResponse.json({ error: "Datenbankfehler." }, { status: 500 });
  }
}
