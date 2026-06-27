import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { encryptPassword } from "@/lib/utils/mailer";
import { updateSetting } from "@/lib/utils/settings";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.password || typeof body.password !== "string") {
    return NextResponse.json({ error: "Kein Passwort angegeben" }, { status: 400 });
  }

  try {
    const encrypted = encryptPassword(body.password);
    await updateSetting("smtp_password", encrypted);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
