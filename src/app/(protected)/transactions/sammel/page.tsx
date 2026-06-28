import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { externalAccounts, internalAccounts, members, guests, travels } from "@/lib/db/schema";
import { eq, asc, and, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import SammelForm from "@/modules/transactions/components/SammelForm";
import { getActiveFiscalYear } from "@/lib/utils/transactions";

export default async function SammelBuchungPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin" && role !== "finanzen") redirect("/transactions");

  const activeFY = await getActiveFiscalYear();

  if (!activeFY) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">Sammelbuchung</h1>
        <div className="alert alert-warning text-base">
          <span>
            Kein aktives Buchungsjahr gefunden.{" "}
            <Link href="/fiscal-years" className="link">Buchungsjahr anlegen und aktivieren →</Link>
          </span>
        </div>
      </div>
    );
  }

  const [extAccounts, intAccounts, memberList, guestList, travelList] = await Promise.all([
    db.select({ id: externalAccounts.id, name: externalAccounts.name })
      .from(externalAccounts)
      .where(eq(externalAccounts.isActive, true))
      .orderBy(asc(externalAccounts.sortOrder), asc(externalAccounts.id)),

    db.select({
        id:          internalAccounts.id,
        number:      internalAccounts.number,
        name:        internalAccounts.name,
        accountKind: internalAccounts.accountKind,
      })
      .from(internalAccounts)
      .where(eq(internalAccounts.isActive, true))
      .orderBy(asc(internalAccounts.number)),

    db.select({
        id:                 members.id,
        lastName:           members.lastName,
        firstName:          members.firstName,
        feePaidCurrentYear: members.feePaidCurrentYear,
        function:           members.function,
      })
      .from(members)
      .where(eq(members.isActive, true))
      .orderBy(asc(members.lastName), asc(members.firstName)),

    db.select({
        id:        guests.id,
        lastName:  guests.lastName,
        firstName: guests.firstName,
      })
      .from(guests)
      .orderBy(asc(guests.lastName), asc(guests.firstName)),

    db.select({
        id:       travels.id,
        name:     travels.name,
        dateFrom: travels.dateFrom,
        dateTo:   travels.dateTo,
      })
      .from(travels)
      .where(
        and(
          eq(travels.fiscalYearId, activeFY.id),
          inArray(travels.status, ["planning", "confirmed"]),
        )
      )
      .orderBy(asc(travels.dateFrom), asc(travels.name)),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-xl font-bold">Sammelbuchung</h1>
        <span className="text-base text-base-content/50">
          — Massenbuchung für Beiträge &amp; Veranstaltungen
        </span>
      </div>
      <SammelForm
        externalAccounts={extAccounts}
        internalAccounts={intAccounts}
        members={memberList}
        guests={guestList}
        travels={travelList}
        activeFiscalYear={{ id: activeFY.id, label: activeFY.label, isClosed: activeFY.isClosed }}
      />
    </div>
  );
}
