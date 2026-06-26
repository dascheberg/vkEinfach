import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { internalAccounts, settings } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

async function getRange(): Promise<{ min: number; max: number }> {
  const rows = await db.select().from(settings).where(
    eq(settings.key, "internal_accounts_min")
  );
  const rows2 = await db.select().from(settings).where(
    eq(settings.key, "internal_accounts_max")
  );
  return {
    min: parseInt(rows[0]?.value ?? "100"),
    max: parseInt(rows2[0]?.value ?? "999"),
  };
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accounts = await db
    .select()
    .from(internalAccounts)
    .orderBy(asc(internalAccounts.number));

  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const number = parseInt(body.number);

  if (isNaN(number)) {
    return NextResponse.json({ error: "Kontonummer ist erforderlich." }, { status: 400 });
  }

  const range = await getRange();
  if (number < range.min || number > range.max) {
    return NextResponse.json(
      { error: `Kontonummer muss zwischen ${range.min} und ${range.max} liegen.` },
      { status: 400 }
    );
  }

  try {
    const [account] = await db
      .insert(internalAccounts)
      .values({
        number,
        name: body.name,
        accountKind: body.accountKind || null,
        isActive: true,
        notes: body.notes || null,
      })
      .returning();

    return NextResponse.json(account, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Kontonummer bereits vorhanden." }, { status: 409 });
    }
    return NextResponse.json({ error: "Datenbankfehler beim Speichern." }, { status: 500 });
  }
}
