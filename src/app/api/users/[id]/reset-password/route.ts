import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, account } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { hashPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: targetId } = await params;

  const [targetUser] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, targetId));

  if (!targetUser) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const tempPassword = generatePassword();
  const hashed = await hashPassword(tempPassword);

  await db
    .update(account)
    .set({ password: hashed })
    .where(and(eq(account.userId, targetId), eq(account.providerId, "credential")));

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";

  try {
    await resend.emails.send({
      from: fromEmail,
      to: targetUser.email,
      subject: "Ihr neues Einmalpasswort",
      html: `
        <p>Hallo ${targetUser.name},</p>
        <p>Der Kassenwart hat Ihr Passwort zurückgesetzt.</p>
        <p><strong>Ihr neues Einmalpasswort:</strong> <code>${tempPassword}</code></p>
        <p>Bitte melden Sie sich damit an und ändern Sie Ihr Passwort anschließend.</p>
      `,
    });
  } catch {
    return NextResponse.json({ error: "Passwort zurückgesetzt, E-Mail konnte nicht gesendet werden" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
