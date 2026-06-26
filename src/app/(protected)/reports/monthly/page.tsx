import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { transactions, externalAccounts, internalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, and, asc, gte, lte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ fyId?: string; month?: string }>;

const MONTH_NAMES = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}
function fmtDate(s: string | null): string {
  if (!s) return "–";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export default async function MonthlyPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const params = await searchParams;

  const fiscalYearList = await db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom));
  const activeFY   = fiscalYearList.find(fy => fy.isActive);
  const defaultFY  = activeFY ?? fiscalYearList[fiscalYearList.length - 1];
  const selectedFY = params.fyId
    ? fiscalYearList.find(fy => fy.id === parseInt(params.fyId!))
    : defaultFY;

  const now          = new Date();
  const selectedMonth = params.month ? parseInt(params.month) : (now.getMonth() + 1);
  const safeMonth    = Math.min(Math.max(selectedMonth, 1), 12);

  const fyYear = selectedFY
    ? parseInt(selectedFY.label) || now.getFullYear()
    : now.getFullYear();

  const monthFrom = `${fyYear}-${String(safeMonth).padStart(2, "0")}-01`;
  const lastDay   = new Date(fyYear, safeMonth, 0).getDate();
  const monthTo   = `${fyYear}-${String(safeMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [monthEntries, allExtAccounts, extBalanceRows] = selectedFY
    ? await Promise.all([
        // Transactions in the selected month
        db.select({
          id:            transactions.id,
          bookingDate:   transactions.bookingDate,
          receiptNumber: transactions.receiptNumber,
          description:   transactions.description,
          direction:     transactions.direction,
          amount:        transactions.amount,
          intNumber:     internalAccounts.number,
        })
        .from(transactions)
        .leftJoin(internalAccounts, eq(transactions.internalAccountId, internalAccounts.id))
        .where(and(
          eq(transactions.fiscalYearId, selectedFY.id),
          gte(transactions.bookingDate, monthFrom),
          lte(transactions.bookingDate, monthTo),
        ))
        .orderBy(asc(transactions.bookingDate), asc(transactions.receiptNumber)),

        // All active external accounts
        db.select({ id: externalAccounts.id, name: externalAccounts.name })
          .from(externalAccounts)
          .where(eq(externalAccounts.isActive, true))
          .orderBy(asc(externalAccounts.sortOrder)),

        // Balance per external account from year start through end of month
        db.select({
          externalAccountId: transactions.externalAccountId,
          net: sql<string>`COALESCE(SUM(CASE WHEN direction='in' THEN amount::numeric ELSE -amount::numeric END),0)`,
        })
        .from(transactions)
        .where(and(
          eq(transactions.fiscalYearId, selectedFY.id),
          lte(transactions.bookingDate, monthTo),
        ))
        .groupBy(transactions.externalAccountId),
      ])
    : [[], [], []];

  const extBalances: Record<number, number> = {};
  for (const r of extBalanceRows) {
    extBalances[r.externalAccountId] = parseFloat(r.net);
  }

  const totalIncome  = monthEntries.filter(e => e.direction === "in" ).reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalExpense = monthEntries.filter(e => e.direction === "out").reduce((s, e) => s + parseFloat(e.amount), 0);
  const surplus      = totalIncome - totalExpense;
  const totalBalance = allExtAccounts.reduce((s, a) => s + (extBalances[a.id] ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Monatsbericht</h1>
        <Link href="/reports" className="btn btn-ghost text-base">← Auswertungen</Link>
      </div>

      {/* Filter */}
      <form method="GET" className="flex flex-wrap items-end gap-3 mb-6">
        <label className="form-control">
          <span className="label-text text-base mb-1">Buchungsjahr</span>
          <select name="fyId" defaultValue={String(selectedFY?.id ?? "")} className="select select-bordered text-base">
            {fiscalYearList.map(fy => (
              <option key={fy.id} value={String(fy.id)}>{fy.label}</option>
            ))}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text text-base mb-1">Monat</span>
          <select name="month" defaultValue={String(safeMonth)} className="select select-bordered text-base">
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={String(i + 1)}>{name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary text-base">Anzeigen</button>
        {selectedFY && (
          <a
            href={`/api/reports/monthly/pdf?fyId=${selectedFY.id}&month=${safeMonth}`}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-outline text-base ml-auto"
          >
            PDF
          </a>
        )}
      </form>

      {!selectedFY ? (
        <p className="text-base text-base-content/60">Kein Buchungsjahr vorhanden.</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4">
            {MONTH_NAMES[safeMonth - 1]} {fyYear} — {selectedFY.label}
          </h2>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="stat bg-base-100 shadow rounded-box">
              <div className="stat-title text-base">Einnahmen</div>
              <div className="stat-value text-success text-xl">{eur(totalIncome)}</div>
            </div>
            <div className="stat bg-base-100 shadow rounded-box">
              <div className="stat-title text-base">Ausgaben</div>
              <div className="stat-value text-error text-xl">{eur(totalExpense)}</div>
            </div>
            <div className="stat bg-base-100 shadow rounded-box">
              <div className="stat-title text-base">{surplus >= 0 ? "Überschuss" : "Fehlbetrag"}</div>
              <div className={`stat-value text-xl ${surplus >= 0 ? "text-success" : "text-error"}`}>
                {eur(Math.abs(surplus))}
              </div>
            </div>
          </div>

          {/* Kontostand per Monatsende */}
          {allExtAccounts.length > 0 && (
            <div className="card bg-base-100 shadow mb-6">
              <div className="card-body">
                <h3 className="text-base font-bold mb-3">
                  Kontostand je Kasse am {fmtDate(monthTo)}
                </h3>
                <table className="table text-base w-full">
                  <tbody>
                    {allExtAccounts.map(a => (
                      <tr key={a.id} className="border-b border-base-200">
                        <td>{a.name}</td>
                        <td className={`text-right font-mono ${(extBalances[a.id] ?? 0) < 0 ? "text-error" : ""}`}>
                          {eur(extBalances[a.id] ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-base-300">
                      <td>Summe</td>
                      <td className={`text-right font-mono ${totalBalance < 0 ? "text-error" : "text-success"}`}>
                        {eur(totalBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Buchungsliste */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="text-base font-bold mb-3">
                Buchungen {MONTH_NAMES[safeMonth - 1]} ({monthEntries.length})
              </h3>
              {monthEntries.length === 0 ? (
                <p className="text-base text-base-content/60">Keine Buchungen in diesem Monat.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra text-base w-full">
                    <thead>
                      <tr className="text-base">
                        <th>Datum</th>
                        <th>Beleg-Nr.</th>
                        <th>Beschreibung</th>
                        <th>Konto</th>
                        <th className="text-right">Einnahme</th>
                        <th className="text-right">Ausgabe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthEntries.map(e => (
                        <tr key={e.id}>
                          <td className="whitespace-nowrap">{fmtDate(e.bookingDate)}</td>
                          <td className="font-mono whitespace-nowrap">{e.receiptNumber ?? "–"}</td>
                          <td>{e.description ?? "–"}</td>
                          <td className="font-mono">{e.intNumber ?? "–"}</td>
                          <td className="text-right font-mono">
                            {e.direction === "in" ? eur(parseFloat(e.amount)) : "–"}
                          </td>
                          <td className="text-right font-mono">
                            {e.direction === "out" ? eur(parseFloat(e.amount)) : "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t-2 border-base-300 text-base">
                        <td colSpan={4}>Summe</td>
                        <td className="text-right font-mono text-success">{eur(totalIncome)}</td>
                        <td className="text-right font-mono text-error">{eur(totalExpense)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
