import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sendMail } from "@/lib/utils/mailer";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminEmail = session.user.email;
  if (!adminEmail) {
    return NextResponse.json({ error: "Kein E-Mail-Konto für diesen Admin hinterlegt." }, { status: 400 });
  }

  try {
    await sendMail({
      to: adminEmail,
      subject: "vkEinfach — SMTP-Test erfolgreich",
      html: `<p>Hallo,</p><p>die SMTP-Konfiguration funktioniert korrekt. Diese E-Mail wurde von vkEinfach als Test gesendet.</p>`,
      text: "Die SMTP-Konfiguration funktioniert korrekt.",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
