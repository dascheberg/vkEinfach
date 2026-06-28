import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalYears, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
  const { label, dateFrom, dateTo } = body;

  if (!label || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "Bezeichnung und Zeitraum erforderlich" }, { status: 400 });
  }

  // Duplikat-Schutz: gleiches Label bereits vorhanden?
  const [existing] = await db
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.label, label));
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const [fy] = await db
    .insert(fiscalYears)
    .values({ label, dateFrom, dateTo, isActive: true })
    .returning();

  return NextResponse.json(fy, { status: 201 });
}
