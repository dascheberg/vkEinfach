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

// Format: 2 Großbuchstaben + 4 Ziffern + 2 Kleinbuchstaben
// Keine verwechslungsgefährdeten Zeichen (I, O, l, o, 0, 1)
function generateTempPassword(): string {
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  let pw = "";
  for (let i = 0; i < 2; i++) pw += upper[Math.floor(Math.random() * upper.length)];
  for (let i = 0; i < 4; i++) pw += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 0; i < 2; i++) pw += lower[Math.floor(Math.random() * lower.length)];
  return pw;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: targetId } = await params;

  const [targetUser] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, targetId));
  if (!targetUser) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });

  const tempPassword = generateTempPassword();
  const hashed = await hashPassword(tempPassword);

  await db
    .update(account)
    .set({ password: hashed })
    .where(and(eq(account.userId, targetId), eq(account.providerId, "credential")));

  return NextResponse.json({ ok: true, password: tempPassword });
}
