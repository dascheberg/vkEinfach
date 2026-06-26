import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { transactions, externalAccounts, internalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import ReportsCharts from "@/modules/reports/components/ReportsCharts";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ fyId?: string }>;

const MONTH_NAMES = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

const KIND_LABELS: Record<string, string> = {
  income:   "Einnahme",
  expense:  "Ausgabe",
  neutral:  "Neutral",
  transfer: "Umbuchung",
  cancel:   "Storno",
};

const TYPE_LABELS: Record<string, string> = {
  cash:    "Barkasse",
  bank:    "Bank",
  savings: "Sparkonto",
};

function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const params = await searchParams;

  const fiscalYearList = await db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom));
  const activeFY  = fiscalYearList.find((fy) => fy.isActive);
  const defaultFY = activeFY ?? fiscalYearList[fiscalYearList.length - 1];
  const selectedFY = params.fyId
    ? fiscalYearList.find((fy) => fy.id === parseInt(params.fyId!))
    : defaultFY;

  if (!selectedFY) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">Auswertungen</h1>
        <p className="text-base text-base-content/60">Kein Buchungsjahr vorhanden.</p>
      </div>
    );
  }

  const fyId = selectedFY.id;

  // Monatliche Zusammenfassung
  const monthlyRaw = await db
    .select({
      month:    sql<number>`EXTRACT(MONTH FROM ${transactions.bookingDate})::int`,
      totalIn:  sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='in'  THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
      totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='out' THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
    })
    .from(transactions)
    .where(eq(transactions.fiscalYearId, fyId))
    .groupBy(sql`EXTRACT(MONTH FROM ${transactions.bookingDate})`)
    .orderBy(sql`EXTRACT(MONTH FROM ${transactions.bookingDate})`);

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = monthlyRaw.find((r) => r.month === i + 1);
    return {
      month:   MONTH_NAMES[i],
      income:  parseFloat(m?.totalIn  ?? "0"),
      expense: parseFloat(m?.totalOut ?? "0"),
    };
  });

  // Interne Konten Saldo
  const intSummary = await db
    .select({
      id:          internalAccounts.id,
      number:      internalAccounts.number,
      name:        internalAccounts.name,
      accountKind: internalAccounts.accountKind,
      totalIn:  sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='in'  THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
      totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='out' THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
    })
    .from(internalAccounts)
    .leftJoin(transactions, and(
      eq(transactions.internalAccountId, internalAccounts.id),
      eq(transactions.fiscalYearId, fyId)
    ))
    .groupBy(internalAccounts.id, internalAccounts.number, internalAccounts.name, internalAccounts.accountKind)
    .orderBy(asc(internalAccounts.number));

  // Externe Konten + Saldo aus Buchungen des gewählten Buchungsjahres
  const [extAccounts, extBalanceRows] = await Promise.all([
    db.select().from(externalAccounts)
      .where(eq(externalAccounts.isActive, true))
      .orderBy(asc(externalAccounts.sortOrder)),
    db.select({
      externalAccountId: transactions.externalAccountId,
      net: sql<string>`COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0)`,
    })
    .from(transactions)
    .where(eq(transactions.fiscalYearId, fyId))
    .groupBy(transactions.externalAccountId),
  ]);

  const extBalances: Record<number, number> = {};
  for (const r of extBalanceRows) {
    extBalances[r.externalAccountId] = parseFloat(r.net);
  }

  const totalIn  = intSummary.reduce((s, r) => s + parseFloat(r.totalIn),  0);
  const totalOut = intSummary.reduce((s, r) => s + parseFloat(r.totalOut), 0);
  const saldo    = totalIn - totalOut;
  const extTotal = extAccounts.reduce((s, a) => s + (extBalances[a.id] ?? 0), 0);

  const activeRows = intSummary.filter(
    (r) => parseFloat(r.totalIn) > 0 || parseFloat(r.totalOut) > 0
  );

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Auswertungen</h1>

      {/* Jahresfilter + PDF-Buttons */}
      <form method="GET" className="flex flex-wrap items-end gap-3 mb-6">
        <label className="form-control">
          <span className="label-text text-base mb-1">Buchungsjahr</span>
          <select name="fyId" defaultValue={String(fyId)} className="select select-bordered text-base">
            {fiscalYearList.map((fy) => (
              <option key={fy.id} value={String(fy.id)}>{fy.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary text-base">Anzeigen</button>
        <div className="flex gap-2 ml-auto flex-wrap">
          <a href={`/api/reports/kassenbuch/pdf?fyId=${fyId}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-base">
            Kassenbuch PDF
          </a>
          <a href={`/api/reports/jahresabschluss/pdf?fyId=${fyId}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-base">
            Jahresabschluss PDF
          </a>
          <a href={`/api/reports/vermoegen/pdf?fyId=${fyId}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-base">
            Vermögensaufstellung PDF
          </a>
        </div>
      </form>

      {/* Summary-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-title text-base">Einnahmen gesamt</div>
          <div className="stat-value text-success text-xl">{eur(totalIn)}</div>
        </div>
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-title text-base">Ausgaben gesamt</div>
          <div className="stat-value text-error text-xl">{eur(totalOut)}</div>
        </div>
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-title text-base">Saldo Buchungen</div>
          <div className={`stat-value text-xl ${saldo >= 0 ? "text-success" : "text-error"}`}>
            {eur(saldo)}
          </div>
        </div>
      </div>

      {/* Monatliches Diagramm */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-2">
            Monatliche Entwicklung — {selectedFY.label}
          </h2>
          <ReportsCharts monthlyData={monthlyData} />
        </div>
      </div>

      {/* Interne Konten */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-4">
            Interne Konten — {selectedFY.label}
          </h2>
          {activeRows.length === 0 ? (
            <p className="text-base text-base-content/60">Keine Buchungen vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra text-base w-full">
                <thead>
                  <tr className="text-base">
                    <th>Nr.</th>
                    <th>Name</th>
                    <th>Art</th>
                    <th className="text-right">Einnahmen</th>
                    <th className="text-right">Ausgaben</th>
                    <th className="text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((r) => {
                    const inn  = parseFloat(r.totalIn);
                    const out  = parseFloat(r.totalOut);
                    const net  = inn - out;
                    return (
                      <tr key={r.id}>
                        <td className="font-mono">{r.number}</td>
                        <td>{r.name}</td>
                        <td>{r.accountKind ? (KIND_LABELS[r.accountKind] ?? r.accountKind) : "–"}</td>
                        <td className="text-right font-mono">{inn > 0 ? eur(inn) : "–"}</td>
                        <td className="text-right font-mono">{out > 0 ? eur(out) : "–"}</td>
                        <td className={`text-right font-mono font-semibold ${net >= 0 ? "text-success" : "text-error"}`}>
                          {eur(net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold text-base">
                    <td colSpan={3}>Gesamt</td>
                    <td className="text-right font-mono">{eur(totalIn)}</td>
                    <td className="text-right font-mono">{eur(totalOut)}</td>
                    <td className={`text-right font-mono ${saldo >= 0 ? "text-success" : "text-error"}`}>
                      {eur(saldo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Externe Konten */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="text-base font-bold mb-4">Externe Konten — {selectedFY.label}</h2>
          <div className="overflow-x-auto">
            <table className="table text-base w-full">
              <thead>
                <tr className="text-base">
                  <th>Konto</th>
                  <th>Typ</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {extAccounts.map((a) => {
                  const bal = extBalances[a.id] ?? 0;
                  return (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{a.accountType ? (TYPE_LABELS[a.accountType] ?? a.accountType) : "–"}</td>
                      <td className={`text-right font-mono ${bal >= 0 ? "text-success" : "text-error"}`}>
                        {eur(bal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-bold text-base">
                  <td colSpan={2}>Gesamt</td>
                  <td className={`text-right font-mono ${extTotal >= 0 ? "text-success" : "text-error"}`}>
                    {eur(extTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
