import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externalAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const [account] = await db
    .update(externalAccounts)
    .set({
      name: body.name,
      accountType: body.accountType || null,
      iban: body.iban || null,
      sortOrder: body.sortOrder ?? 0,
      notes: body.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(externalAccounts.id, parseInt(id)))
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
    .update(externalAccounts)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(externalAccounts.id, parseInt(id)))
    .returning();

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}
