import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, account, session as sessionTable } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(s: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (s?.user as { role?: string })?.role ?? "member";
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: targetId } = await params;
  const isSelf = session.user.id === targetId;
  const body = await req.json();

  // Cannot change own role, banned, or approved
  if (isSelf && (body.role !== undefined || body.banned !== undefined || body.approved !== undefined)) {
    return NextResponse.json(
      { error: "Eigene Rolle, Freigabe oder Status kann nicht geändert werden" },
      { status: 400 }
    );
  }

  const userUpdates: Record<string, unknown> = {};
  if (body.role      !== undefined) userUpdates.role         = body.role;
  if (body.banned    !== undefined) userUpdates.banned       = body.banned;
  if (body.approved  !== undefined) userUpdates.approved     = body.approved;
  if (body.name      !== undefined) userUpdates.name         = body.name.trim();
  if (body.email     !== undefined) userUpdates.email        = body.email.trim().toLowerCase();
  if (body.username  !== undefined) userUpdates.username     = body.username?.trim() || null;
  if (body.function  !== undefined) userUpdates.userFunction = body.function?.trim() || "M";

  // Validate email uniqueness
  if (userUpdates.email) {
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, userUpdates.email as string), ne(user.id, targetId)));
    if (existing) return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 400 });
  }

  // Validate username uniqueness
  if (userUpdates.username) {
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, userUpdates.username as string), ne(user.id, targetId)));
    if (existing) return NextResponse.json({ error: "Benutzername bereits vergeben" }, { status: 400 });
  }

  await db.update(user).set(userUpdates).where(eq(user.id, targetId));

  // Keep account.accountId in sync on email change
  if (userUpdates.email) {
    await db
      .update(account)
      .set({ accountId: userUpdates.email as string })
      .where(and(eq(account.userId, targetId), eq(account.providerId, "credential")));
  }

  // Invalidate all sessions when banning
  if (body.banned === true) {
    await db.delete(sessionTable).where(eq(sessionTable.userId, targetId));
  }

  const [updated] = await db
    .select({ id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, function: user.userFunction, banned: user.banned, approved: user.approved, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, targetId));

  return NextResponse.json(updated);
}
