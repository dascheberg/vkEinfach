import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { sendMail } from "@/lib/utils/mailer";
import { getSettings } from "@/lib/utils/settings";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "scda@scschmalfeld.org";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const identifier = (body.identifier ?? "").trim();

  if (!identifier) {
    return NextResponse.json({ error: "Benutzername oder E-Mail erforderlich" }, { status: 400 });
  }

  // Lookup user — don't reveal if found or not (security)
  const isEmail = identifier.includes("@");
  let foundUser: { name: string; email: string; username: string | null } | null = null;

  try {
    const [found] = await db
      .select({ name: user.name, email: user.email, username: user.username })
      .from(user)
      .where(
        isEmail
          ? eq(user.email, identifier)
          : eq(user.username, identifier)
      );
    foundUser = found ?? null;
  } catch {
    // DB error — still return 200 to not reveal internals
  }

  try {
    const settings = await getSettings();
    const appName = settings.appName ?? "vkEinfach";
    const clubName = settings.clubName ?? "";

    const userInfo = foundUser
      ? `<tr><td style="padding:4px 8px;color:#666">Name</td><td style="padding:4px 8px"><strong>${foundUser.name}</strong></td></tr>
         <tr><td style="padding:4px 8px;color:#666">Benutzername</td><td style="padding:4px 8px">${foundUser.username ?? "—"}</td></tr>
         <tr><td style="padding:4px 8px;color:#666">E-Mail</td><td style="padding:4px 8px">${foundUser.email}</td></tr>`
      : `<tr><td style="padding:4px 8px;color:#666">Eingabe</td><td style="padding:4px 8px">${identifier}</td></tr>
         <tr><td style="padding:4px 8px;color:#666">Hinweis</td><td style="padding:4px 8px;color:#c00">Kein passender Benutzer gefunden</td></tr>`;

    const html = `
      <div style="font-family:sans-serif;max-width:480px">
        <h2 style="color:#059669">Passwort-Vergessen-Anfrage</h2>
        <p>Ein Benutzer hat auf der Anmeldeseite von <strong>${appName}</strong>${clubName ? ` (${clubName})` : ""} auf „Passwort vergessen?" geklickt.</p>
        <table style="border-collapse:collapse;margin:16px 0">
          ${userInfo}
          <tr><td style="padding:4px 8px;color:#666">Zeitpunkt</td><td style="padding:4px 8px">${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</td></tr>
        </table>
        <p>Bitte setzen Sie das Passwort über die <strong>Benutzerverwaltung (/users)</strong> zurück und informieren Sie die Person.</p>
        <p style="color:#999;font-size:12px">Diese Nachricht wurde automatisch von ${appName} gesendet.</p>
      </div>
    `;

    await sendMail({
      to: ADMIN_EMAIL,
      subject: `Passwort-Anfrage — ${appName}`,
      html,
      text: `Passwort-Vergessen-Anfrage\nEingabe: ${identifier}\n${foundUser ? `Name: ${foundUser.name}\nBenutzername: ${foundUser.username ?? "—"}\nE-Mail: ${foundUser.email}` : "Kein passender Benutzer gefunden."}\nZeitpunkt: ${new Date().toLocaleString("de-DE")}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
