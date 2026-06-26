import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { travelParticipants } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { pid } = await params;
  const body = await req.json();

  const updates: { isRegistered?: boolean; isPaid?: boolean } = {};
  if (body.isRegistered !== undefined) updates.isRegistered = body.isRegistered;
  if (body.isPaid !== undefined) updates.isPaid = body.isPaid;

  const [updated] = await db
    .update(travelParticipants)
    .set(updates)
    .where(eq(travelParticipants.id, parseInt(pid)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { pid } = await params;
  await db.delete(travelParticipants).where(eq(travelParticipants.id, parseInt(pid)));
  return NextResponse.json({ ok: true });
}
