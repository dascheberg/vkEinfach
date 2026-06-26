import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { transactions, externalAccounts, internalAccounts, members, fiscalYears, receipts } from "@/lib/db/schema";
import { eq, and, desc, ilike, asc, count, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import TransactionFilters from "@/modules/transactions/components/TransactionFilters";
import TransactionActions from "@/modules/transactions/components/TransactionActions";
import ReceiptBadge from "@/modules/receipts/components/ReceiptBadge";

type SearchParams = Promise<{ fyId?: string; extId?: string; intId?: string; dir?: string; bn?: string; amount?: string }>;

function formatCurrency(value: string | null): string {
  const num = parseFloat(value ?? "0");
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

function formatDate(value: string | null): string {
  if (!value) return "–";
  const [y, m, d] = value.split("-");
  return `${d}.${m}.${y}`;
}

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const params  = await searchParams;
  const isAdmin = role === "admin";

  const [fiscalYearList, extAccounts, intAccounts] = await Promise.all([
    db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom)),
    db.select({ id: externalAccounts.id, name: externalAccounts.name })
      .from(externalAccounts).where(eq(externalAccounts.isActive, true)),
    db.select({ id: internalAccounts.id, number: internalAccounts.number, name: internalAccounts.name })
      .from(internalAccounts).where(eq(internalAccounts.isActive, true)).orderBy(internalAccounts.number),
  ]);

  const activeFY   = fiscalYearList.find((fy) => fy.isActive);
  const defaultFY  = activeFY ?? fiscalYearList[fiscalYearList.length - 1];
  const selectedFY = params.fyId
    ? fiscalYearList.find((fy) => fy.id === parseInt(params.fyId!))
    : defaultFY;

  const extId  = params.extId ? parseInt(params.extId) : null;
  const intId  = params.intId ? parseInt(params.intId) : null;
  const dir    = params.dir ?? null;
  const bn     = params.bn?.trim() || null;
  const rawAmt = params.amount?.trim().replace(",", ".") || null;
  const amount = rawAmt && !isNaN(parseFloat(rawAmt)) ? parseFloat(rawAmt) : null;

  const conditions = [];
  if (selectedFY) conditions.push(eq(transactions.fiscalYearId, selectedFY.id));
  if (extId)  conditions.push(eq(transactions.externalAccountId, extId));
  if (intId)  conditions.push(eq(transactions.internalAccountId, intId));
  if (dir)    conditions.push(eq(transactions.direction, dir));
  if (bn)     conditions.push(ilike(transactions.receiptNumber, `%${bn}%`));
  if (amount !== null) conditions.push(sql`${transactions.amount} = ${amount}`);

  const rows = await db
    .select({
      id:                 transactions.id,
      receiptNumber:      transactions.receiptNumber,
      bookingDate:        transactions.bookingDate,
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

  const totalIn  = rows.filter((r) => r.direction === "in").reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalOut = rows.filter((r) => r.direction === "out").reduce((s, r) => s + parseFloat(r.amount), 0);
  const balance  = totalIn - totalOut;

  // Beleg-Anzahl pro Buchung
  const transactionIds = rows.map((r) => r.id);
  let receiptCountMap: Record<number, number> = {};
  if (transactionIds.length > 0) {
    const counts = await db
      .select({ transactionId: receipts.transactionId, cnt: count() })
      .from(receipts)
      .where(inArray(receipts.transactionId, transactionIds))
      .groupBy(receipts.transactionId);
    receiptCountMap = Object.fromEntries(counts.map((c) => [c.transactionId, Number(c.cnt)]));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Buchungen</h1>
        {isAdmin && (
          <Link href="/transactions/neu" className="btn btn-primary text-base">
            Neue Buchung
          </Link>
        )}
      </div>

      <TransactionFilters
        fiscalYears={fiscalYearList}
        externalAccounts={extAccounts}
        internalAccounts={intAccounts}
        defaultFyId={selectedFY ? String(selectedFY.id) : ""}
        defaultExtId={params.extId ?? ""}
        defaultIntId={params.intId ?? ""}
        defaultDir={params.dir ?? ""}
        defaultBn={params.bn ?? ""}
        defaultAmount={params.amount ?? ""}
      />

      {/* Zusammenfassung */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="stat bg-base-200 rounded-box p-4 min-w-40">
          <div className="stat-title text-base">Einnahmen</div>
          <div className="stat-value text-success text-xl">{formatCurrency(String(totalIn))}</div>
        </div>
        <div className="stat bg-base-200 rounded-box p-4 min-w-40">
          <div className="stat-title text-base">Ausgaben</div>
          <div className="stat-value text-error text-xl">{formatCurrency(String(totalOut))}</div>
        </div>
        <div className="stat bg-base-200 rounded-box p-4 min-w-40">
          <div className="stat-title text-base">Saldo</div>
          <div className={`stat-value text-xl ${balance < 0 ? "text-error" : "text-base-content"}`}>
            {formatCurrency(String(balance))}
          </div>
        </div>
      </div>

      <p className="text-base text-base-content/60 mb-3">{rows.length} Buchungen</p>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-base-content/50 text-base">
          Keine Buchungen für diesen Zeitraum.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full text-base">
            <thead>
              <tr className="text-base">
                <th>Buchungs-Nr.</th>
                <th>Datum</th>
                <th className="w-8">Art</th>
                <th className="text-right">Betrag</th>
                <th>Ext. Konto</th>
                <th>Int. Konto</th>
                <th>Beschreibung / Referenz / Mitglied</th>
                <th>Beleg</th>
                {isAdmin && <th>Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isStorno = row.receiptNumber?.includes("-ST-") ?? false;
                return (
                  <tr key={row.id} className={isStorno ? "opacity-50 italic" : ""}>
                    <td className="font-mono text-base whitespace-nowrap">
                      {row.receiptNumber ?? "–"}
                    </td>
                    <td className="whitespace-nowrap">{formatDate(row.bookingDate)}</td>
                    <td>
                      <span className={`badge text-base ${row.direction === "in" ? "badge-success" : "badge-error"}`}>
                        {row.direction === "in" ? "E" : "A"}
                      </span>
                    </td>
                    <td className={`text-right font-mono font-semibold whitespace-nowrap ${row.direction === "in" ? "text-success" : "text-error"}`}>
                      {row.direction === "out" ? "–" : ""}{formatCurrency(row.amount)}
                    </td>
                    <td>{row.extName ?? "–"}</td>
                    <td className="whitespace-nowrap">
                      {row.intNumber && row.intName ? `${row.intNumber} – ${row.intName}` : "–"}
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        {row.description && <span>{row.description}</span>}
                        {row.referenceBookingNo && (
                          <span className="font-mono text-base-content/60">Ref: {row.referenceBookingNo}</span>
                        )}
                        {row.memberLast && (
                          <span className="text-base-content/70">{row.memberLast}, {row.memberFirst}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <ReceiptBadge
                        transactionId={row.id}
                        receiptNumber={row.receiptNumber}
                        initialCount={receiptCountMap[row.id] ?? 0}
                        isAdmin={isAdmin}
                      />
                    </td>
                    {isAdmin && (
                      <td>
                        <TransactionActions transactionId={row.id} receiptNumber={row.receiptNumber} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
