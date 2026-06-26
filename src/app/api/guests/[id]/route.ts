import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guests, travelParticipants } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
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

  if (!body.lastName || !body.firstName) {
    return NextResponse.json({ error: "Vor- und Nachname erforderlich" }, { status: 400 });
  }

  const [updated] = await db
    .update(guests)
    .set({
      lastName: body.lastName.trim(),
      firstName: body.firstName.trim(),
      contactInfo: body.contactInfo?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .where(eq(guests.id, parseInt(id)))
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
  const guestId = parseInt(id);

  const [existing] = await db
    .select({ id: travelParticipants.id })
    .from(travelParticipants)
    .where(eq(travelParticipants.guestId, guestId));

  if (existing) {
    return NextResponse.json(
      { error: "Gast kann nicht gelöscht werden — Reise-Teilnahme vorhanden" },
      { status: 409 }
    );
  }

  await db.delete(guests).where(eq(guests.id, guestId));
  return NextResponse.json({ ok: true });
}
