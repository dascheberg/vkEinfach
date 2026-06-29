import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, account } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { hashPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: targetId } = await params;
  const body = await req.json();
  const { password } = body;

  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen lang sein" }, { status: 400 });
  }

  const [targetUser] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetId));
  if (!targetUser) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });

  const hashed = await hashPassword(password);
  await db
    .update(account)
    .set({ password: hashed })
    .where(and(eq(account.userId, targetId), eq(account.providerId, "credential")));

  return NextResponse.json({ ok: true });
}
