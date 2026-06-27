import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Aktuelles und neues Passwort erforderlich" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
  }

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: false },
      headers: await headers(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Aktuelles Passwort falsch oder Fehler beim Ändern" }, { status: 400 });
  }
}
