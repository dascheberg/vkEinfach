import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { internalAccounts, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

async function getRange(): Promise<{ min: number; max: number }> {
  const [rMin] = await db.select().from(settings).where(eq(settings.key, "internal_accounts_min"));
  const [rMax] = await db.select().from(settings).where(eq(settings.key, "internal_accounts_max"));
  return {
    min: parseInt(rMin?.value ?? "100"),
    max: parseInt(rMax?.value ?? "999"),
  };
}

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
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

  const [account] = await db
    .update(internalAccounts)
    .set({
      number,
      name: body.name,
      accountKind: body.accountKind || null,
      notes: body.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(internalAccounts.id, parseInt(id)))
    .returning();

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const [account] = await db
    .update(internalAccounts)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(internalAccounts.id, parseInt(id)))
    .returning();

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}
