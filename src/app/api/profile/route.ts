import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, account } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [u] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      function: user.userFunction,
    })
    .from(user)
    .where(eq(user.id, session.user.id));

  return NextResponse.json(u);
}

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name     !== undefined) updates.name     = body.name.trim();
  if (body.email    !== undefined) updates.email    = body.email.trim().toLowerCase();
  if (body.username !== undefined) updates.username = body.username?.trim() || null;

  await db.update(user).set(updates).where(eq(user.id, session.user.id));

  if (updates.email) {
    await db
      .update(account)
      .set({ accountId: updates.email as string })
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, "credential")));
  }

  const [updated] = await db
    .select({ id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, function: user.userFunction })
    .from(user)
    .where(eq(user.id, session.user.id));

  return NextResponse.json(updated);
}
