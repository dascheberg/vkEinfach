"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface AgeGroup    { label: string; count: number; }
interface MonthlyPoint { month: string; income: number; expense: number; }
interface Birthday    { name: string; date: string; age: number; }

interface Props {
  ageGroups:          AgeGroup[];
  avgAge:             number;
  minAge:             number | null;
  maxAge:             number | null;
  memberCount:        number;
  monthlyData:        MonthlyPoint[];
  upcomingBirthdays:  Birthday[];
  fiscalYearLabel:    string;
}

function fmtEur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export default function DashboardCharts({
  ageGroups,
  avgAge,
  minAge,
  maxAge,
  memberCount,
  monthlyData,
  upcomingBirthdays,
  fiscalYearLabel,
}: Props) {
  const hasAgeData     = ageGroups.some(g => g.count > 0);
  const hasMonthlyData = monthlyData.some(m => m.income > 0 || m.expense > 0);

  const statsLine = [
    `Mitglieder: ${memberCount}`,
    avgAge  > 0    ? `Durchschnittsalter: ${avgAge} Jahre` : null,
    minAge !== null ? `Jüngstes: ${minAge} Jahre`          : null,
    maxAge !== null ? `Ältestes: ${maxAge} Jahre`          : null,
  ].filter(Boolean).join(" — ");

  return (
    <div>
      {/* Altersverteilung */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-2">Altersverteilung</h2>
          {hasAgeData ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ageGroups} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [value, "Mitglieder"]}
                    labelFormatter={(label) => `Altersgruppe ${label}`}
                  />
                  <Bar dataKey="count" name="Mitglieder" fill="#36d399" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-base text-base-content/60 mt-1 text-center">{statsLine}</p>
            </>
          ) : (
            <p className="text-base text-base-content/60 py-4">Keine Geburtsdaten erfasst.</p>
          )}
        </div>
      </div>

      {/* Unterer Bereich: Monatschart + Geburtstage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="text-base font-bold mb-2">
              Einnahmen &amp; Ausgaben{fiscalYearLabel ? ` — ${fiscalYearLabel}` : ""}
            </h2>
            {hasMonthlyData ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v: number) => `${v.toLocaleString("de-DE")} €`}
                    tick={{ fontSize: 10 }}
                    width={82}
                  />
                  <Tooltip
                    formatter={(value) => fmtEur(Number(value))}
                    labelFormatter={(l) => `Monat: ${l}`}
                  />
                  <Bar dataKey="income"  name="Einnahmen" fill="#36d399" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Ausgaben"  fill="#f87272" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-base text-base-content/60 py-4">Keine Buchungen im aktiven Jahr.</p>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="text-base font-bold mb-3">Nächste Geburtstage (30 Tage)</h2>
            {upcomingBirthdays.length === 0 ? (
              <p className="text-base text-base-content/60 py-4">
                Keine Geburtstage in den nächsten 30 Tagen.
              </p>
            ) : (
              <ul className="divide-y divide-base-200">
                {upcomingBirthdays.map((b, i) => (
                  <li key={i} className="py-2">
                    <p className="text-base font-medium">{b.name}</p>
                    <p className="text-base text-base-content/60">
                      {b.date} — wird {b.age} Jahre alt
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
