import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { dayMonthKey, formatDate } from "@/lib/utils/calculations";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ from?: string; to?: string }>;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function BirthdaysRangePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const params = await searchParams;

  const today = new Date();
  const defaultTo = new Date(today);
  defaultTo.setDate(defaultTo.getDate() + 30);

  const from = params.from ?? isoDate(today);
  const to   = params.to   ?? isoDate(defaultTo);

  const fromKey = dayMonthKey(from);
  const toKey   = dayMonthKey(to);
  const toYear  = parseInt(to.slice(0, 4));

  const rows = await db
    .select({
      id:        members.id,
      lastName:  members.lastName,
      firstName: members.firstName,
      birthDate: members.birthDate,
    })
    .from(members)
    .where(and(
      eq(members.isActive, true),
      isNotNull(members.birthDate),
      sql`(EXTRACT(MONTH FROM ${members.birthDate})::int * 100 + EXTRACT(DAY FROM ${members.birthDate})::int) BETWEEN ${fromKey} AND ${toKey}`,
    ))
    .orderBy(
      sql`EXTRACT(MONTH FROM ${members.birthDate})`,
      sql`EXTRACT(DAY FROM ${members.birthDate})`,
      members.lastName,
    );

  const list = rows.map(m => ({
    ...m,
    age: toYear - parseInt(m.birthDate!.slice(0, 4)),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Geburtstage im Zeitraum</h1>
        <Link href="/reports" className="btn btn-ghost text-base">← Auswertungen</Link>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3 mb-3">
        <label className="form-control">
          <span className="label-text text-base mb-1">Von</span>
          <input type="date" name="from" defaultValue={from} className="input input-bordered text-base" />
        </label>
        <label className="form-control">
          <span className="label-text text-base mb-1">Bis</span>
          <input type="date" name="to" defaultValue={to} className="input input-bordered text-base" />
        </label>
        <button type="submit" className="btn btn-primary text-base">Anzeigen</button>
        <div className="flex gap-2 ml-auto flex-wrap">
          <a
            href={`/api/reports/birthdays/csv?from=${from}&to=${to}`}
            className="btn btn-outline text-base"
          >
            CSV
          </a>
          <a
            href={`/api/reports/birthdays/pdf?from=${from}&to=${to}`}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-outline text-base"
          >
            PDF
          </a>
        </div>
      </form>

      <div className="alert text-base mb-6">
        Hinweis: Sofern du über die Jahresgrenze mit deiner Abfrage gehst, mache bitte zwei Abfragen:
        1. Von ... bis 31.12. und 2. Von 01.01. bis ... Danke.
      </div>

      {list.length === 0 ? (
        <p className="text-base text-base-content/60">Keine Geburtstage im gewählten Zeitraum.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra text-base w-full">
              <thead>
                <tr className="text-base">
                  <th>Name</th>
                  <th>Geburtsdatum</th>
                  <th className="text-right">Alter wird</th>
                </tr>
              </thead>
              <tbody>
                {list.map(m => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.lastName}, {m.firstName}</td>
                    <td>{formatDate(m.birthDate)}</td>
                    <td className="text-right font-mono">{m.age}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-6 mt-4 p-4 bg-base-200 rounded-box">
            <span className="text-base font-semibold">{list.length} Geburtstage im Zeitraum</span>
          </div>
        </>
      )}
    </div>
  );
}
