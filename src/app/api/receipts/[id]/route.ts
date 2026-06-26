import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    await db.delete(receipts).where(eq(receipts.id, parseInt(id)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/receipts/[id]:", e);
    return NextResponse.json({ error: "Datenbankfehler." }, { status: 500 });
  }
}
