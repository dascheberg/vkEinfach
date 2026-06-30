import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalYears } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const fyId = parseInt(id);
  const body = await req.json();

  try {
    // Wenn dieses Jahr als aktiv gesetzt wird: alle anderen deaktivieren
    if (body.isActive === true) {
      await db.update(fiscalYears).set({ isActive: false });
    }

    const updateData: Partial<typeof fiscalYears.$inferInsert> = {};
    if (body.isActive  !== undefined) updateData.isActive  = body.isActive;
    if (body.isClosed  !== undefined) updateData.isClosed  = body.isClosed;
    if (body.notes     !== undefined) updateData.notes     = body.notes     || null;
    if (body.label     !== undefined) updateData.label     = body.label;
    if (body.dateFrom  !== undefined) updateData.dateFrom  = body.dateFrom;
    if (body.dateTo    !== undefined) updateData.dateTo    = body.dateTo;
    if (body.membershipFee !== undefined) {
      const fee = body.membershipFee ? parseFloat(String(body.membershipFee).replace(",", ".")) : null;
      updateData.membershipFee = fee !== null && !isNaN(fee) && fee > 0 ? String(fee.toFixed(2)) : null;
    }

    const [row] = await db
      .update(fiscalYears)
      .set(updateData)
      .where(eq(fiscalYears.id, fyId))
      .returning();

    if (!row) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("PATCH /api/fiscal-years/[id]:", e);
    return NextResponse.json({ error: "Datenbankfehler." }, { status: 500 });
  }
}
