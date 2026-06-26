import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externalAccounts, settings } from "@/lib/db/schema";
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
  const accounts: { name: string; accountType: string }[] = body.accounts ?? [];

  if (accounts.length === 0) {
    return NextResponse.json({ error: "Mindestens ein Konto erforderlich" }, { status: 400 });
  }

  const created = [];
  for (let i = 0; i < accounts.length; i++) {
    const { name, accountType } = accounts[i];
    if (!name) continue;
    const [acc] = await db
      .insert(externalAccounts)
      .values({ name, accountType: accountType || "cash", sortOrder: i })
      .returning();
    created.push(acc);
  }

  return NextResponse.json(created, { status: 201 });
}
