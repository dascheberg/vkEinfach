import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateSetting } from "@/lib/utils/settings";

export const dynamic = "force-dynamic";

export async function POST() {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "setup_complete"));

  if (row?.value === "true") {
    return NextResponse.json({ error: "Setup bereits abgeschlossen" }, { status: 403 });
  }

  await updateSetting("setup_complete", "true");

  return NextResponse.json({ ok: true });
}
