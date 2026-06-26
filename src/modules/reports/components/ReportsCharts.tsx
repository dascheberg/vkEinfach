"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface MonthlyData {
  month:   string;
  income:  number;
  expense: number;
}

function fmtEur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export default function ReportsCharts({ monthlyData }: { monthlyData: MonthlyData[] }) {
  const hasData = monthlyData.some((m) => m.income > 0 || m.expense > 0);
  if (!hasData) {
    return (
      <p className="text-base text-base-content/60 py-4">Keine Buchungen im gewählten Jahr.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 13 }} />
        <YAxis
          tickFormatter={(v: number) => `${v.toLocaleString("de-DE")} €`}
          tick={{ fontSize: 11 }}
          width={85}
        />
        <Tooltip
          formatter={(value) => fmtEur(Number(value))}
          labelFormatter={(label) => `Monat: ${label}`}
        />
        <Legend wrapperStyle={{ fontSize: 14 }} />
        <Bar dataKey="income"  name="Einnahmen" fill="#36d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expense" name="Ausgaben"  fill="#f87272" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
