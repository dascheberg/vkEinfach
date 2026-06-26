import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { travels, travelParticipants } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [travel] = await db.select().from(travels).where(eq(travels.id, parseInt(id)));
  if (!travel) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(travel);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });

  const [updated] = await db
    .update(travels)
    .set({
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
      updatedAt: new Date(),
    })
    .where(eq(travels.id, parseInt(id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const travelId = parseInt(id);

  const [existing] = await db
    .select({ id: travelParticipants.id })
    .from(travelParticipants)
    .where(eq(travelParticipants.travelId, travelId));

  if (existing) {
    return NextResponse.json(
      { error: "Reise kann nicht gelöscht werden — Teilnehmer vorhanden" },
      { status: 409 }
    );
  }

  await db.delete(travels).where(eq(travels.id, travelId));
  return NextResponse.json({ ok: true });
}
