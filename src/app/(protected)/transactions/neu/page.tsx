import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { externalAccounts, internalAccounts, members, transactions } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import TransactionForm from "@/modules/transactions/components/TransactionForm";
import { getActiveFiscalYear, getNextReceiptNumber } from "@/lib/utils/transactions";

export default async function NewTransactionPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") redirect("/transactions");

  const activeFY = await getActiveFiscalYear();

  if (!activeFY) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">Neue Buchung</h1>
        <div className="alert alert-warning text-base">
          <span>
            Kein aktives Buchungsjahr gefunden.{" "}
            <a href="/fiscal-years" className="link">Buchungsjahr anlegen und aktivieren →</a>
          </span>
        </div>
      </div>
    );
  }

  const [extAccounts, intAccounts, memberList, nextBN, extBalanceRows] = await Promise.all([
    db.select({ id: externalAccounts.id, name: externalAccounts.name })
      .from(externalAccounts)
      .where(eq(externalAccounts.isActive, true))
      .orderBy(asc(externalAccounts.sortOrder), asc(externalAccounts.id)),

    db.select({
        id:          internalAccounts.id,
        number:      internalAccounts.number,
        name:        internalAccounts.name,
        accountKind: internalAccounts.accountKind,
        isActive:    internalAccounts.isActive,
      })
      .from(internalAccounts)
      .where(eq(internalAccounts.isActive, true))
      .orderBy(asc(internalAccounts.number)),

    db.select({ id: members.id, lastName: members.lastName, firstName: members.firstName })
      .from(members)
      .where(eq(members.isActive, true))
      .orderBy(asc(members.lastName), asc(members.firstName)),

    getNextReceiptNumber(activeFY.id),

    db.select({
        externalAccountId: transactions.externalAccountId,
        net: sql<string>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0)`,
      })
      .from(transactions)
      .groupBy(transactions.externalAccountId),
  ]);

  const externalBalances: Record<number, number> = {};
  for (const row of extBalanceRows) {
    externalBalances[row.externalAccountId] = parseFloat(row.net);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-xl font-bold">Neue Buchung</h1>
        <span className="font-mono text-base text-black">- Nächste BN: {nextBN}</span>
      </div>
      <TransactionForm
        externalAccounts={extAccounts}
        internalAccounts={intAccounts}
        members={memberList}
        externalBalances={externalBalances}
        activeFiscalYear={{ id: activeFY.id, label: activeFY.label, isClosed: activeFY.isClosed }}
      />
    </div>
  );
}
