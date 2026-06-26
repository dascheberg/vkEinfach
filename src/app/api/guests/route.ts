import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guests } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { asc, or, ilike } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const search = new URL(req.url).searchParams.get("search") ?? "";

  const where = search
    ? or(ilike(guests.lastName, `%${search}%`), ilike(guests.firstName, `%${search}%`))
    : undefined;

  const list = await db
    .select()
    .from(guests)
    .where(where)
    .orderBy(asc(guests.lastName), asc(guests.firstName));

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.lastName || !body.firstName) {
    return NextResponse.json({ error: "Vor- und Nachname erforderlich" }, { status: 400 });
  }

  const [guest] = await db
    .insert(guests)
    .values({
      lastName: body.lastName.trim(),
      firstName: body.firstName.trim(),
      contactInfo: body.contactInfo?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .returning();

  return NextResponse.json(guest, { status: 201 });
}
