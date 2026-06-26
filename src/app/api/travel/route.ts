import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { travels, travelParticipants, fiscalYears } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { asc, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fyId = new URL(req.url).searchParams.get("fiscalYearId");

  const list = await db
    .select({
      id: travels.id,
      name: travels.name,
      dateFrom: travels.dateFrom,
      dateTo: travels.dateTo,
      status: travels.status,
      minParticipants: travels.minParticipants,
      maxParticipants: travels.maxParticipants,
      ownContribution: travels.ownContribution,
      fiscalYearId: travels.fiscalYearId,
      participantCount: sql<number>`(SELECT COUNT(*) FROM travel_participants tp WHERE tp.travel_id = travels.id)`,
      unpaidCount: sql<number>`(SELECT COUNT(*) FROM travel_participants tp WHERE tp.travel_id = travels.id AND tp.is_paid = false)`,
    })
    .from(travels)
    .where(fyId ? eq(travels.fiscalYearId, parseInt(fyId)) : undefined)
    .orderBy(desc(travels.dateFrom), asc(travels.name));

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });

  const [travel] = await db
    .insert(travels)
    .values({
      name: body.name.trim(),
      dateFrom: body.dateFrom || null,
      dateTo: body.dateTo || null,
      destination: body.destination?.trim() || null,
      totalCost: body.totalCost || null,
      ownContribution: body.ownContribution || null,
      minParticipants: body.minParticipants ? parseInt(body.minParticipants) : 0,
      maxParticipants: body.maxParticipants ? parseInt(body.maxParticipants) : null,
      description: body.description?.trim() || null,
      fiscalYearId: body.fiscalYearId ? parseInt(body.fiscalYearId) : null,
      status: body.status || "planning",
      notes: body.notes?.trim() || null,
    })
    .returning();

  return NextResponse.json(travel, { status: 201 });
}
