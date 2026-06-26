import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { transactions, internalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ intId?: string; fyId?: string }>;

function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}
function fmtDate(s: string | null): string {
  if (!s) return "–";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export default async function AccountLedgerPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const params = await searchParams;

  const [fiscalYearList, allIntAccounts] = await Promise.all([
    db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom)),
    db.select({ id: internalAccounts.id, number: internalAccounts.number, name: internalAccounts.name })
      .from(internalAccounts)
      .where(eq(internalAccounts.isActive, true))
      .orderBy(asc(internalAccounts.number)),
  ]);

  const activeFY   = fiscalYearList.find(fy => fy.isActive);
  const defaultFY  = activeFY ?? fiscalYearList[fiscalYearList.length - 1];
  const selectedFY = params.fyId
    ? fiscalYearList.find(fy => fy.id === parseInt(params.fyId!))
    : defaultFY;

  const selectedIntId = params.intId ? parseInt(params.intId) : (allIntAccounts[0]?.id ?? null);
  const selectedInt   = allIntAccounts.find(a => a.id === selectedIntId) ?? allIntAccounts[0] ?? null;

  const entries = selectedFY && selectedInt
    ? await db
        .select({
          id:            transactions.id,
          bookingDate:   transactions.bookingDate,
          receiptNumber: transactions.receiptNumber,
          description:   transactions.description,
          direction:     transactions.direction,
          amount:        transactions.amount,
        })
        .from(transactions)
        .where(and(
          eq(transactions.fiscalYearId, selectedFY.id),
          eq(transactions.internalAccountId, selectedInt.id),
        ))
        .orderBy(asc(transactions.bookingDate), asc(transactions.receiptNumber))
    : [];

  let runningBalance = 0;
  const rows = entries.map(e => {
    const amount   = parseFloat(e.amount);
    const income   = e.direction === "in"  ? amount : null;
    const expense  = e.direction === "out" ? amount : null;
    runningBalance += e.direction === "in" ? amount : -amount;
    return {
      ...e,
      income,
      expense,
      runningBalance,
      isStorno: e.receiptNumber?.includes("-ST-") ?? false,
    };
  });

  const totalIncome  = rows.reduce((s, r) => s + (r.income  ?? 0), 0);
  const totalExpense = rows.reduce((s, r) => s + (r.expense ?? 0), 0);
  const finalBalance = totalIncome - totalExpense;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Kontenblatt</h1>
        <Link href="/reports" className="btn btn-ghost text-base">← Auswertungen</Link>
      </div>

      {/* Filter */}
      <form method="GET" className="flex flex-wrap items-end gap-3 mb-6">
        <label className="form-control">
          <span className="label-text text-base mb-1">Internes Konto</span>
          <select name="intId" defaultValue={String(selectedInt?.id ?? "")} className="select select-bordered text-base">
            {allIntAccounts.map(a => (
              <option key={a.id} value={String(a.id)}>{a.number} – {a.name}</option>
            ))}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text text-base mb-1">Buchungsjahr</span>
          <select name="fyId" defaultValue={String(selectedFY?.id ?? "")} className="select select-bordered text-base">
            {fiscalYearList.map(fy => (
              <option key={fy.id} value={String(fy.id)}>{fy.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary text-base">Anzeigen</button>
        {selectedFY && selectedInt && (
          <a
            href={`/api/reports/account-ledger/pdf?intId=${selectedInt.id}&fyId=${selectedFY.id}`}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-outline text-base ml-auto"
          >
            PDF
          </a>
        )}
      </form>

      {!selectedInt || !selectedFY ? (
        <p className="text-base text-base-content/60">Kein Konto oder Buchungsjahr vorhanden.</p>
      ) : (
        <>
          <p className="text-base font-semibold mb-3">
            {selectedInt.number} — {selectedInt.name} &nbsp;|&nbsp; {selectedFY.label}
          </p>

          {rows.length === 0 ? (
            <p className="text-base text-base-content/60">
              Keine Buchungen für dieses Konto im Jahr {selectedFY.label}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra text-base w-full">
                <thead>
                  <tr className="text-base">
                    <th>Datum</th>
                    <th>Beleg-Nr.</th>
                    <th>Beschreibung</th>
                    <th className="text-right">Einnahme</th>
                    <th className="text-right">Ausgabe</th>
                    <th className="text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className={r.isStorno ? "opacity-60" : ""}>
                      <td className="whitespace-nowrap">{fmtDate(r.bookingDate)}</td>
                      <td className="font-mono whitespace-nowrap">{r.receiptNumber ?? "–"}</td>
                      <td>
                        {r.description ?? "–"}
                        {r.isStorno && <span className="ml-2 badge badge-warning text-base">storniert</span>}
                      </td>
                      <td className="text-right font-mono">
                        {r.income !== null ? eur(r.income) : "–"}
                      </td>
                      <td className="text-right font-mono">
                        {r.expense !== null ? eur(r.expense) : "–"}
                      </td>
                      <td className={`text-right font-mono font-semibold ${r.runningBalance < 0 ? "text-error" : ""}`}>
                        {eur(r.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2 border-base-300 text-base">
                    <td colSpan={3}>Summe</td>
                    <td className="text-right font-mono text-success">{eur(totalIncome)}</td>
                    <td className="text-right font-mono text-error">{eur(totalExpense)}</td>
                    <td className={`text-right font-mono ${finalBalance < 0 ? "text-error" : "text-success"}`}>
                      {eur(finalBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
