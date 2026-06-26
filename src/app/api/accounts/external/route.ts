import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externalAccounts } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accounts = await db
    .select()
    .from(externalAccounts)
    .orderBy(asc(externalAccounts.sortOrder), asc(externalAccounts.id));

  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const active = await db
    .select({ id: externalAccounts.id })
    .from(externalAccounts)
    .where(eq(externalAccounts.isActive, true));
  if (active.length >= 5) {
    return NextResponse.json({ error: "Maximal 5 aktive externe Konten erlaubt" }, { status: 400 });
  }

  const body = await req.json();
  const [account] = await db
    .insert(externalAccounts)
    .values({
      name: body.name,
      accountType: body.accountType || null,
      iban: body.iban || null,
      currentBalance: "0",
      sortOrder: body.sortOrder ?? 0,
      isActive: true,
      notes: body.notes || null,
    })
    .returning();

  return NextResponse.json(account, { status: 201 });
}
