import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  transactions,
  externalAccounts,
  internalAccounts,
  fiscalYears,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getNextReceiptNumber } from "@/lib/utils/transactions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const sourceFyId = parseInt(id);
    const body = await req.json();
    const targetFyId = parseInt(body.targetFyId ?? "0");

    if (!targetFyId) return NextResponse.json({ error: "targetFyId fehlt." }, { status: 400 });

    const [sourceFY] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, sourceFyId));
    if (!sourceFY) return NextResponse.json({ error: "Quell-Buchungsjahr nicht gefunden." }, { status: 404 });
    if (!sourceFY.isClosed) {
      return NextResponse.json(
        { error: `Buchungsjahr „${sourceFY.label}" muss zuerst abgeschlossen werden.` },
        { status: 400 }
      );
    }

    const [targetFY] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, targetFyId));
    if (!targetFY) return NextResponse.json({ error: "Ziel-Buchungsjahr nicht gefunden." }, { status: 404 });
    if (targetFY.isClosed) {
      return NextResponse.json(
        { error: `Ziel-Buchungsjahr „${targetFY.label}" ist bereits abgeschlossen.` },
        { status: 400 }
      );
    }

    // Internes Konto 100 (Übertrag Vorjahr) suchen
    const [account100] = await db
      .select()
      .from(internalAccounts)
      .where(eq(internalAccounts.number, 100));
    if (!account100) {
      return NextResponse.json(
        { error: "Internes Konto 100 (Übertrag Vorjahr) nicht gefunden. Bitte zuerst anlegen." },
        { status: 400 }
      );
    }

    // Duplikatprüfung: Übertragsb uchungen (Konto 100) bereits im Ziel-Jahr vorhanden?
    const [dupResult] = await db
      .select({ cnt: sql<string>`COUNT(*)` })
      .from(transactions)
      .where(sql`fiscal_year_id = ${targetFyId} AND internal_account_id = ${account100.id}`);
    if (parseInt(dupResult.cnt) > 0) {
      return NextResponse.json(
        { error: `Im Ziel-Jahr „${targetFY.label}" existieren bereits Übertragsbuchungen (Konto 100).` },
        { status: 400 }
      );
    }

    // Abschlusssalden je externem Konto im Quell-Buchungsjahr
    const [extActive, balanceRows] = await Promise.all([
      db.select({ id: externalAccounts.id, name: externalAccounts.name })
        .from(externalAccounts)
        .where(eq(externalAccounts.isActive, true)),
      db.select({
        externalAccountId: transactions.externalAccountId,
        net: sql<string>`COALESCE(SUM(CASE WHEN direction='in' THEN amount::numeric ELSE -(amount::numeric) END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.fiscalYearId, sourceFyId))
      .groupBy(transactions.externalAccountId),
    ]);

    const balances: Record<number, number> = {};
    for (const r of balanceRows) {
      balances[r.externalAccountId] = parseFloat(r.net);
    }

    // Buchungsdatum = erster Tag des Ziel-Buchungsjahres
    const bookingDate = targetFY.dateFrom;
    let created = 0;

    for (const ext of extActive) {
      const bal = balances[ext.id] ?? 0;
      if (bal === 0) continue;

      const direction: "in" | "out" = bal > 0 ? "in" : "out";
      const amount = Math.abs(bal).toFixed(2);

      // Belegnummer sequenziell ermitteln (nach jedem Insert aktualisiert)
      const receiptNumber = await getNextReceiptNumber(targetFyId);

      await db.insert(transactions).values({
        receiptNumber,
        bookingDate,
        fiscalYearId:      targetFyId,
        amount,
        direction,
        externalAccountId: ext.id,
        internalAccountId: account100.id,
        description:       `Übertrag aus ${sourceFY.label} – ${ext.name}`,
        createdBy:         1,
      });

      created++;
    }

    return NextResponse.json({ created, targetLabel: targetFY.label });
  } catch (e) {
    console.error("POST /api/fiscal-years/carry-over:", e);
    return NextResponse.json({ error: "Datenbankfehler." }, { status: 500 });
  }
}
