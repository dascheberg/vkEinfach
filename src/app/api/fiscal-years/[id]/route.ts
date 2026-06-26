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

    const [row] = await db
      .update(fiscalYears)
      .set({ ...body })
      .where(eq(fiscalYears.id, fyId))
      .returning();

    if (!row) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("PATCH /api/fiscal-years/[id]:", e);
    return NextResponse.json({ error: "Datenbankfehler." }, { status: 500 });
  }
}
