import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, fiscalYears } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = getRole(session);
  if (role !== "admin" && role !== "finanzen") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const [original] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, parseInt(id)));

    if (!original) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 });

    if (original.receiptNumber?.includes("-ST-")) {
      return NextResponse.json(
        { error: "Stornobuchungen können nicht nochmals storniert werden." },
        { status: 400 }
      );
    }

    const fiscalYearId = original.fiscalYearId;
    const reverseDir   = original.direction === "in" ? "out" : "in";
    const amount       = original.amount;

    // Buchungsjahr prüfen
    const [fy] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, fiscalYearId));
    if (fy?.isClosed) {
      return NextResponse.json(
        { error: `Buchungsjahr „${fy.label}" ist abgeschlossen – Storno nicht möglich.` },
        { status: 400 }
      );
    }

    // Jahrespräfix aus dateFrom ableiten
    const yearPrefix = fy
      ? new Date(fy.dateFrom).getFullYear().toString()
      : new Date().getFullYear().toString();

    // Storno-Belegnummer ermitteln
    const allForYear = await db
      .select({ rn: transactions.receiptNumber })
      .from(transactions)
      .where(eq(transactions.fiscalYearId, fiscalYearId));

    let maxST = 0;
    for (const row of allForYear) {
      const m = row.rn?.match(/^\d{4}-ST-(\d+)$/);
      if (m) {
        const n = parseInt(m[1]);
        if (n > maxST) maxST = n;
      }
    }
    const stornoNumber = `${yearPrefix}-ST-${String(maxST + 1).padStart(3, "0")}`;

    // Storno-Buchung einfügen
    const [storno] = await db
      .insert(transactions)
      .values({
        receiptNumber:      stornoNumber,
        bookingDate:        original.bookingDate,
        fiscalYearId,
        amount,
        direction:          reverseDir,
        externalAccountId:  original.externalAccountId,
        internalAccountId:  original.internalAccountId,
        memberId:           original.memberId,
        referenceBookingNo: original.receiptNumber,
        description:        `Storno zu Buchung ${original.receiptNumber}`,
        createdBy:          1,
      })
      .returning();

    return NextResponse.json(storno, { status: 201 });
  } catch (e) {
    console.error("POST /api/transactions/storno:", e);
    return NextResponse.json({ error: "Datenbankfehler beim Stornieren." }, { status: 500 });
  }
}
