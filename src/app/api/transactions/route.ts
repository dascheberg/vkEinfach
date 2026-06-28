import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, externalAccounts, internalAccounts, members, fiscalYears } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getNextReceiptNumber } from "@/lib/utils/transactions";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const fyId  = searchParams.get("fyId");
    const extId = searchParams.get("extId");
    const intId = searchParams.get("intId");
    const dir   = searchParams.get("dir");
    const bn    = searchParams.get("bn");

    const conditions = [];
    if (fyId)  conditions.push(eq(transactions.fiscalYearId,        parseInt(fyId)));
    if (extId) conditions.push(eq(transactions.externalAccountId,   parseInt(extId)));
    if (intId) conditions.push(eq(transactions.internalAccountId,   parseInt(intId)));
    if (dir)   conditions.push(eq(transactions.direction,           dir));
    if (bn)    conditions.push(sql`receipt_number ILIKE ${'%' + bn + '%'}`);

    const rows = await db
      .select({
        id:                 transactions.id,
        receiptNumber:      transactions.receiptNumber,
        bookingDate:        transactions.bookingDate,
        fiscalYearId:       transactions.fiscalYearId,
        amount:             transactions.amount,
        direction:          transactions.direction,
        referenceBookingNo: transactions.referenceBookingNo,
        description:        transactions.description,
        extName:            externalAccounts.name,
        intNumber:          internalAccounts.number,
        intName:            internalAccounts.name,
        memberLast:         members.lastName,
        memberFirst:        members.firstName,
      })
      .from(transactions)
      .leftJoin(externalAccounts, eq(transactions.externalAccountId, externalAccounts.id))
      .leftJoin(internalAccounts, eq(transactions.internalAccountId, internalAccounts.id))
      .leftJoin(members,          eq(transactions.memberId,          members.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.bookingDate), desc(transactions.id));

    return NextResponse.json(rows);
  } catch (e) {
    console.error("GET /api/transactions:", e);
    return NextResponse.json({ error: "Datenbankfehler beim Laden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = getRole(session);
  if (role !== "admin" && role !== "finanzen") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();

    if (!body.bookingDate || !body.externalAccountId || !body.direction || !body.amount || !body.internalAccountId || !body.fiscalYearId) {
      return NextResponse.json({ error: "Pflichtfelder fehlen." }, { status: 400 });
    }
    if (!["in", "out"].includes(body.direction)) {
      return NextResponse.json({ error: "Ungültige Richtung." }, { status: 400 });
    }

    const amount    = parseFloat(body.amount).toFixed(2);
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Betrag muss größer als 0 sein." }, { status: 400 });
    }

    const fiscalYearId = parseInt(body.fiscalYearId);
    const direction    = body.direction as "in" | "out";
    const extId        = parseInt(body.externalAccountId);
    const intId        = parseInt(body.internalAccountId);

    // Buchungsjahr prüfen
    const [fy] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, fiscalYearId));
    if (!fy) return NextResponse.json({ error: "Buchungsjahr nicht gefunden." }, { status: 400 });
    if (fy.isClosed) return NextResponse.json({ error: `Buchungsjahr „${fy.label}" ist abgeschlossen.` }, { status: 400 });

    // Belegnummer generieren
    const receiptNumber = await getNextReceiptNumber(fiscalYearId);

    // Buchung einfügen
    const [newTransaction] = await db
      .insert(transactions)
      .values({
        receiptNumber,
        bookingDate:        body.bookingDate,
        fiscalYearId,
        amount,
        direction,
        externalAccountId:  extId,
        internalAccountId:  intId,
        memberId:           body.memberId           ? parseInt(body.memberId) : null,
        referenceBookingNo: body.referenceBookingNo || null,
        description:        body.description        || null,
        createdBy:          1,
      })
      .returning();

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (e) {
    console.error("POST /api/transactions:", e);

    return NextResponse.json({ error: "Datenbankfehler beim Speichern." }, { status: 500 });
  }
}
