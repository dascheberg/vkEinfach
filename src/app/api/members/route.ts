import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, and, or, ilike, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const showInactive = searchParams.get("active") === "false";
  const feePaid = searchParams.get("feePaid");

  const conditions = [];
  if (!showInactive) conditions.push(eq(members.isActive, true));
  if (feePaid === "true") conditions.push(eq(members.feePaidCurrentYear, true));
  if (feePaid === "false") conditions.push(eq(members.feePaidCurrentYear, false));

  const nameFilter = search
    ? or(ilike(members.lastName, `%${search}%`), ilike(members.firstName, `%${search}%`))
    : null;

  const where =
    nameFilter && conditions.length > 0
      ? and(...conditions, nameFilter)
      : nameFilter
      ? nameFilter
      : conditions.length > 0
      ? and(...conditions)
      : undefined;

  const results = await db
    .select()
    .from(members)
    .where(where)
    .orderBy(asc(members.lastName), asc(members.firstName));

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const [member] = await db
    .insert(members)
    .values({
      lastName: body.lastName,
      firstName: body.firstName,
      street: body.street || null,
      zip: body.zip || null,
      city: body.city || null,
      birthDate: body.birthDate || null,
      phoneLandline: body.phoneLandline || null,
      phoneMobile: body.phoneMobile || null,
      email: body.email || null,
      function: body.function || "M",
      joinedAt: body.joinedAt || null,
      leftAt: body.leftAt || null,
      deceased: body.deceased ?? false,
      isActive: body.isActive ?? true,
      feePaidCurrentYear: body.feePaidCurrentYear ?? false,
      feeNotes: body.feeNotes || null,
      notes: body.notes || null,
    })
    .returning();

  return NextResponse.json(member, { status: 201 });
}
