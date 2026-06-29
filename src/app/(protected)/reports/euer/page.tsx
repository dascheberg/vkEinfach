import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { transactions, internalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ fyId?: string }>;

function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export default async function EuerPage({ searchParams }: { searchParams: SearchParams }) {
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

  if (!selectedFY) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">EÜR — Einnahmen-Überschuss-Rechnung</h1>
        <p className="text-base text-base-content/60">Kein Buchungsjahr vorhanden.</p>
      </div>
    );
  }

  const rows = await db
    .select({
      id:          internalAccounts.id,
      number:      internalAccounts.number,
      name:        internalAccounts.name,
      accountKind: internalAccounts.accountKind,
      totalIn:  sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='in'  THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
      totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='out' THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
    })
    .from(internalAccounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.internalAccountId, internalAccounts.id),
        eq(transactions.fiscalYearId, selectedFY.id),
      ),
    )
    .where(inArray(internalAccounts.accountKind, ["income", "expense", "neutral"]))
    .groupBy(internalAccounts.id, internalAccounts.number, internalAccounts.name, internalAccounts.accountKind)
    .orderBy(asc(internalAccounts.number));

  // income: direction='in' only; expense: direction='out' only;
  // neutral: direction='in' → Einnahmen, direction='out' → Ausgaben (kann in beiden erscheinen)
  const incomeRows = rows
    .filter(r => (r.accountKind === "income" || r.accountKind === "neutral") && parseFloat(r.totalIn) > 0)
    .map(r => ({ number: r.number, name: r.name, total: parseFloat(r.totalIn) }));

  const expenseRows = rows
    .filter(r => (r.accountKind === "expense" || r.accountKind === "neutral") && parseFloat(r.totalOut) > 0)
    .map(r => ({ number: r.number, name: r.name, total: parseFloat(r.totalOut) }));

  const totalIncome  = incomeRows.reduce((s, r) => s + r.total, 0);
  const totalExpense = expenseRows.reduce((s, r) => s + r.total, 0);
  const surplus      = totalIncome - totalExpense;

  const maxRows = Math.max(incomeRows.length, expenseRows.length);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">EÜR — Einnahmen-Überschuss-Rechnung</h1>
        <Link href="/reports" className="btn btn-ghost text-base">← Auswertungen</Link>
      </div>

      {/* Jahresfilter */}
      <form method="GET" className="flex flex-wrap items-end gap-3 mb-6">
        <label className="form-control">
          <span className="label-text text-base mb-1">Buchungsjahr</span>
          <select name="fyId" defaultValue={String(selectedFY.id)} className="select select-bordered text-base">
            {fiscalYearList.map(fy => (
              <option key={fy.id} value={String(fy.id)}>{fy.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary text-base">Anzeigen</button>
        <a
          href={`/api/reports/euer/pdf?fyId=${selectedFY.id}`}
          target="_blank" rel="noopener noreferrer"
          className="btn btn-outline text-base ml-auto"
        >
          PDF
        </a>
      </form>

      {maxRows === 0 ? (
        <p className="text-base text-base-content/60">Keine Buchungen auf Einnahmen- oder Ausgabenkonten im Jahr {selectedFY.label}.</p>
      ) : (
        <div className="card bg-base-100 shadow">
          <div className="card-body p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-base-200">
              {/* EINNAHMEN */}
              <div className="p-6">
                <h2 className="text-base font-bold mb-3 text-success uppercase tracking-wide">Einnahmen</h2>
                <table className="table text-base w-full">
                  <tbody>
                    {incomeRows.map(r => (
                      <tr key={r.number} className="border-b border-base-200">
                        <td className="font-mono text-base-content/50 w-12 pl-0">{r.number}</td>
                        <td>{r.name}</td>
                        <td className="text-right font-mono">{eur(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-base-300">
                      <td colSpan={2} className="pl-0">Summe Einnahmen</td>
                      <td className="text-right font-mono text-success">{eur(totalIncome)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* AUSGABEN */}
              <div className="p-6">
                <h2 className="text-base font-bold mb-3 text-error uppercase tracking-wide">Ausgaben</h2>
                <table className="table text-base w-full">
                  <tbody>
                    {expenseRows.map(r => (
                      <tr key={r.number} className="border-b border-base-200">
                        <td className="font-mono text-base-content/50 w-12 pl-0">{r.number}</td>
                        <td>{r.name}</td>
                        <td className="text-right font-mono">{eur(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-base-300">
                      <td colSpan={2} className="pl-0">Summe Ausgaben</td>
                      <td className="text-right font-mono text-error">{eur(totalExpense)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Überschuss / Fehlbetrag */}
            <div className="border-t-2 border-base-300 p-6 flex items-center justify-between">
              <span className="text-base font-bold">
                {surplus >= 0 ? "Überschuss" : "Fehlbetrag"} {selectedFY.label}
              </span>
              <span className={`text-xl font-bold font-mono ${surplus >= 0 ? "text-success" : "text-error"}`}>
                {eur(Math.abs(surplus))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
