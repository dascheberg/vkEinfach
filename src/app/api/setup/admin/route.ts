import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, settings } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { updateSetting } from "@/lib/utils/settings";

export const dynamic = "force-dynamic";

async function isSetupComplete(): Promise<boolean> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "setup_complete"));
  return row?.value === "true";
}

export async function POST(req: NextRequest) {
  if (await isSetupComplete()) {
    return NextResponse.json({ error: "Setup bereits abgeschlossen" }, { status: 403 });
  }

  const body = await req.json();
  const { appName, clubName, clubSubtitle, adminName, adminEmail, adminPassword } = body;

  if (!adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: "Admin-Daten unvollständig" }, { status: 400 });
  }

  // Save app settings
  await updateSetting("app_name", appName || "vkEinfach");
  await updateSetting("club_name", clubName || "Mein Verein");
  await updateSetting("club_subtitle", clubSubtitle || "Vereinskasse");

  // Existiert bereits ein User mit dieser E-Mail?
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, adminEmail));

  if (!existingUser) {
    try {
      await auth.api.signUpEmail({
        body: { name: adminName, email: adminEmail, password: adminPassword },
      });
    } catch {
      return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 400 });
    }
  }

  // Rolle + approved setzen (ob neu oder bereits vorhanden)
  await db.update(user).set({ role: "admin", approved: true }).where(eq(user.email, adminEmail));

  return NextResponse.json({ ok: true }, { status: 201 });
}
