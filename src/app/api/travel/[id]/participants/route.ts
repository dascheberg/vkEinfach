import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { travelParticipants, members, guests } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, asc, eq } from "drizzle-orm";

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

  const rows = await db
    .select({
      id: travelParticipants.id,
      travelId: travelParticipants.travelId,
      memberId: travelParticipants.memberId,
      guestId: travelParticipants.guestId,
      isRegistered: travelParticipants.isRegistered,
      isPaid: travelParticipants.isPaid,
      paidAmount: travelParticipants.paidAmount,
      registeredAt: travelParticipants.registeredAt,
      memberLastName: members.lastName,
      memberFirstName: members.firstName,
      guestLastName: guests.lastName,
      guestFirstName: guests.firstName,
    })
    .from(travelParticipants)
    .leftJoin(members, eq(travelParticipants.memberId, members.id))
    .leftJoin(guests, eq(travelParticipants.guestId, guests.id))
    .where(eq(travelParticipants.travelId, parseInt(id)))
    .orderBy(asc(members.lastName), asc(guests.lastName));

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      travelId: r.travelId,
      memberId: r.memberId,
      guestId: r.guestId,
      isRegistered: r.isRegistered,
      isPaid: r.isPaid,
      paidAmount: r.paidAmount,
      registeredAt: r.registeredAt,
      type: r.memberId ? "member" : "guest",
      lastName: r.memberId ? r.memberLastName : r.guestLastName,
      firstName: r.memberId ? r.memberFirstName : r.guestFirstName,
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const travelId = parseInt(id);
  const body = await req.json();

  const memberId: number | null = body.memberId ? parseInt(body.memberId) : null;
  const guestId: number | null = body.guestId ? parseInt(body.guestId) : null;

  if (!memberId && !guestId) {
    return NextResponse.json({ error: "memberId oder guestId erforderlich" }, { status: 400 });
  }

  // Duplicate check
  const [dup] = await db
    .select({ id: travelParticipants.id })
    .from(travelParticipants)
    .where(
      memberId
        ? and(eq(travelParticipants.travelId, travelId), eq(travelParticipants.memberId, memberId))
        : and(eq(travelParticipants.travelId, travelId), eq(travelParticipants.guestId, guestId!))
    );

  if (dup) {
    return NextResponse.json({ error: "Person ist bereits angemeldet" }, { status: 409 });
  }

  const [participant] = await db
    .insert(travelParticipants)
    .values({ travelId, memberId, guestId, isRegistered: true, isPaid: false })
    .returning();

  return NextResponse.json(participant, { status: 201 });
}
