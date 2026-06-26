import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { internalAccounts, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { accountsSeniorenclub, accountsAllgemein, type InternalAccountTemplate } from "@/lib/data/internalAccountsDefault";

export const dynamic = "force-dynamic";

async function isSetupComplete(): Promise<boolean> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "setup_complete"));
  return row?.value === "true";
}

export async function POST(req: NextRequest) {
  if (await isSetupComplete()) {
    return NextResponse.json({ error: "Setup bereits abgeschlossen" }, { status: 403 });
  }

  const body = await req.json();
  const mode: "seniorenclub" | "allgemein" | "csv" | "empty" = body.mode ?? "empty";

  let list: InternalAccountTemplate[] = [];

  if (mode === "seniorenclub") list = accountsSeniorenclub;
  else if (mode === "allgemein") list = accountsAllgemein;
  else if (mode === "csv") {
    const accounts = body.accounts as InternalAccountTemplate[] | undefined;
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json({ error: "Keine Konten übergeben" }, { status: 400 });
    }
    list = accounts;
  }

  let count = 0;
  for (const acc of list) {
    await db
      .insert(internalAccounts)
      .values({ number: acc.number, name: acc.name, accountKind: acc.accountKind })
      .onConflictDoNothing();
    count++;
  }

  return NextResponse.json({ ok: true, count });
}
