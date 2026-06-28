import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, members, travelParticipants, fiscalYears, internalAccounts } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getNextReceiptNumber } from "@/lib/utils/transactions";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

interface Participant {
  memberId?: number;
  guestId?: number;
}

function isReiseKonto(number: number, name: string): boolean {
  return (number >= 160 && number <= 199) ||
    /reise|eigenanteil/i.test(name);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = getRole(session);
  if (role !== "admin" && role !== "finanzen") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { date, externalAccountId, internalAccountId, amountPerPerson, description, totalAmount, travelId, participants } = body;

    if (!date || !externalAccountId || !internalAccountId || !amountPerPerson || !participants?.length) {
      return NextResponse.json({ error: "Pflichtfelder fehlen." }, { status: 400 });
    }

    const amount = parseFloat(String(amountPerPerson));
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Betrag muss größer als 0 sein." }, { status: 400 });
    }

    const participantList = participants as Participant[];

    // Gesamtbetrag-Validierung wenn angegeben
    if (totalAmount !== undefined && totalAmount !== null && totalAmount !== "") {
      const expectedTotal = amount * participantList.length;
      const givenTotal = parseFloat(String(totalAmount));
      if (!isNaN(givenTotal) && Math.abs(givenTotal - expectedTotal) > 0.01) {
        return NextResponse.json({
          error: `Gesamtbetrag stimmt nicht: erwartet ${expectedTotal.toFixed(2)} €, angegeben ${givenTotal.toFixed(2)} €.`,
        }, { status: 400 });
      }
    }

    // Buchungsjahr prüfen
    const [activeFY] = await db
      .select()
      .from(fiscalYears)
      .where(eq(fiscalYears.isActive, true))
      .limit(1);
    if (!activeFY) return NextResponse.json({ error: "Kein aktives Buchungsjahr gefunden." }, { status: 400 });
    if (activeFY.isClosed) return NextResponse.json({ error: `Buchungsjahr „${activeFY.label}" ist abgeschlossen.` }, { status: 400 });

    // Internes Konto laden
    const [intAccount] = await db
      .select({ number: internalAccounts.number, name: internalAccounts.name })
      .from(internalAccounts)
      .where(eq(internalAccounts.id, parseInt(String(internalAccountId))));

    const intAccountNumber = intAccount?.number ?? 0;
    const intAccountName   = intAccount?.name ?? "";
    const reiseKonto       = isReiseKonto(intAccountNumber, intAccountName);

    // travelId Pflicht bei Reise-Konto
    if (reiseKonto && !travelId) {
      return NextResponse.json({ error: "Bitte eine Reise auswählen." }, { status: 400 });
    }

    const selectedTravelId = travelId ? parseInt(String(travelId)) : null;
    const amountStr        = amount.toFixed(2);
    const extId            = parseInt(String(externalAccountId));
    const intId            = parseInt(String(internalAccountId));
    const createdBy        = 1;
    const today            = new Date().toISOString().split("T")[0];

    const receiptNumbers: string[] = [];
    let created         = 0;
    let travelPaid      = 0;
    let travelRegistered = 0;

    // Sequenzielle Inserts (kein db.transaction() — Neon HTTP-Treiber)
    for (const p of participantList) {
      const receiptNumber = await getNextReceiptNumber(activeFY.id);
      try {
        await db.insert(transactions).values({
          receiptNumber,
          bookingDate:       date,
          fiscalYearId:      activeFY.id,
          amount:            amountStr,
          direction:         "in",
          externalAccountId: extId,
          internalAccountId: intId,
          memberId:          p.memberId ?? null,
          travelId:          selectedTravelId,
          description:       description || null,
          createdBy,
        });
        receiptNumbers.push(receiptNumber);
        created++;
      } catch (e) {
        console.error(`Insert fehlgeschlagen für memberId=${p.memberId} guestId=${p.guestId}:`, e);
        continue;
      }

      // Reise-Konto: Upsert in travel_participants
      if (reiseKonto && selectedTravelId) {
        try {
          const whereClause = p.memberId
            ? and(eq(travelParticipants.travelId, selectedTravelId), eq(travelParticipants.memberId, p.memberId))
            : and(eq(travelParticipants.travelId, selectedTravelId), eq(travelParticipants.guestId, p.guestId!));

          const existing = await db
            .select({ id: travelParticipants.id })
            .from(travelParticipants)
            .where(whereClause)
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(travelParticipants)
              .set({ isPaid: true, paidAt: today })
              .where(eq(travelParticipants.id, existing[0].id));
            travelPaid++;
          } else {
            await db.insert(travelParticipants).values({
              travelId:     selectedTravelId,
              memberId:     p.memberId ?? null,
              guestId:      p.guestId  ?? null,
              isRegistered: true,
              isPaid:       true,
              paidAt:       today,
            });
            travelRegistered++;
            travelPaid++;
          }
        } catch (e) {
          console.error(`travel_participants Upsert fehlgeschlagen für memberId=${p.memberId}:`, e);
        }
      }
    }

    // Konto 103: fee_paid_current_year = true
    let feesPaid = 0;
    if (intAccountNumber === 103) {
      const memberIds = participantList.filter((p) => p.memberId).map((p) => p.memberId as number);
      if (memberIds.length > 0) {
        try {
          await db.update(members).set({ feePaidCurrentYear: true }).where(inArray(members.id, memberIds));
          feesPaid = memberIds.length;
        } catch (e) {
          console.error("fee_paid Update fehlgeschlagen:", e);
        }
      }
    }

    return NextResponse.json({
      created,
      totalAmount: amount * created,
      receiptNumbers,
      statusUpdates: { feesPaid, travelPaid, travelRegistered },
    }, { status: 201 });
  } catch (e) {
    console.error("POST /api/transactions/sammel:", e);
    return NextResponse.json({ error: "Datenbankfehler." }, { status: 500 });
  }
}
