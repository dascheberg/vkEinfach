import { NextRequest, NextResponse } from "next/server";
import { syncExitedMembers } from "@/lib/utils/memberStatus.server";

export const dynamic = "force-dynamic";

/**
 * Täglicher Abgleich: deaktiviert Mitglieder, deren Austrittsdatum erreicht ist.
 * Wird von Vercel Cron aufgerufen (siehe vercel.json) und ist über CRON_SECRET
 * geschützt. Ohne gesetztes CRON_SECRET wird der Zugriff verweigert.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET ist nicht konfiguriert." },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deactivated = await syncExitedMembers();
    return NextResponse.json({ ok: true, deactivated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
