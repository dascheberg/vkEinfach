import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { members, transactions, fiscalYears } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { calculateAge } from "@/lib/utils/calculations";
import DashboardCharts from "@/modules/reports/components/DashboardCharts";
import Link from "next/link";

const MONTH_NAMES = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

type ActiveMember = { lastName: string; firstName: string; birthDate: string | null; feePaidCurrentYear: boolean };

function buildAgeGroups(activeMembers: ActiveMember[]) {
  const AGE_GROUPS = ["60–64","65–69","70–74","75–79","80–84","85–89","90–94","95–99","100+"];
  const counts: Record<string, number> = Object.fromEntries(AGE_GROUPS.map(k => [k, 0]));
  for (const m of activeMembers) {
    const age = calculateAge(m.birthDate);
    if (age === null || age < 60) continue;
    const key = age >= 100 ? "100+" : `${Math.floor(age / 5) * 5}–${Math.floor(age / 5) * 5 + 4}`;
    if (counts[key] !== undefined) counts[key]++;
  }
  return AGE_GROUPS.map(label => ({ label, count: counts[label] }));
}

function nextBirthdayText(activeMembers: ActiveMember[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let best: { name: string; dateStr: string; age: number; sortKey: number } | null = null;
  for (const m of activeMembers) {
    if (!m.birthDate) continue;
    const birth = new Date(m.birthDate);
    let bd = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (bd < today) bd = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
    const sortKey = bd.getTime();
    if (!best || sortKey < best.sortKey) {
      best = {
        name: `${m.lastName}, ${m.firstName}`,
        dateStr: `${String(birth.getDate()).padStart(2, "0")}.${String(birth.getMonth() + 1).padStart(2, "0")}.`,
        age: bd.getFullYear() - birth.getFullYear(),
        sortKey,
      };
    }
  }
  return best ? `${best.name} — ${best.dateStr} (${best.age} J.)` : null;
}

function upcomingBirthdays(activeMembers: ActiveMember[], days = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  const result: { name: string; date: string; age: number; sortKey: number }[] = [];
  for (const m of activeMembers) {
    if (!m.birthDate) continue;
    const birth = new Date(m.birthDate);
    let bd = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (bd < today) bd = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
    if (bd <= cutoff) {
      result.push({
        name: `${m.lastName}, ${m.firstName}`,
        date: `${String(birth.getDate()).padStart(2, "0")}.${String(birth.getMonth() + 1).padStart(2, "0")}.`,
        age: bd.getFullYear() - birth.getFullYear(),
        sortKey: bd.getTime(),
      });
    }
  }
  return result.sort((a, b) => a.sortKey - b.sortKey).slice(0, 5)
    .map(({ name, date, age }) => ({ name, date, age }));
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";

  const [allActive, activeFYRows] = await Promise.all([
    db.select({
      lastName:           members.lastName,
      firstName:          members.firstName,
      birthDate:          members.birthDate,
      feePaidCurrentYear: members.feePaidCurrentYear,
    }).from(members).where(eq(members.isActive, true)),
    db.select().from(fiscalYears).where(eq(fiscalYears.isActive, true)).limit(1),
  ]);

  const fy        = activeFYRows[0] ?? null;
  const total     = allActive.length;
  const openFees  = allActive.filter(m => !m.feePaidCurrentYear).length;

  const ages = allActive
    .map(m => calculateAge(m.birthDate))
    .filter((a): a is number => a !== null);
  const avgAge = ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : 0;
  const minAge = ages.length > 0 ? Math.min(...ages) : null;
  const maxAge = ages.length > 0 ? Math.max(...ages) : null;

  const ageGroups   = buildAgeGroups(allActive);
  const nextBd      = nextBirthdayText(allActive);
  const upcoming    = upcomingBirthdays(allActive);

  let totalBalance = 0;
  let monthlyData  = Array.from({ length: 12 }, (_, i) => ({ month: MONTH_NAMES[i], income: 0, expense: 0 }));

  if (fy) {
    const [balRow, monthRaw] = await Promise.all([
      db.select({
        net: sql<string>`COALESCE(SUM(CASE WHEN direction='in' THEN amount::numeric ELSE -amount::numeric END),0)`,
      }).from(transactions).where(eq(transactions.fiscalYearId, fy.id)),
      db.select({
        month:    sql<number>`EXTRACT(MONTH FROM ${transactions.bookingDate})::int`,
        totalIn:  sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='in'  THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
        totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='out' THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
      }).from(transactions)
        .where(eq(transactions.fiscalYearId, fy.id))
        .groupBy(sql`EXTRACT(MONTH FROM ${transactions.bookingDate})`)
        .orderBy(sql`EXTRACT(MONTH FROM ${transactions.bookingDate})`),
    ]);
    totalBalance = parseFloat(balRow[0]?.net ?? "0");
    monthlyData  = Array.from({ length: 12 }, (_, i) => {
      const m = monthRaw.find(r => r.month === i + 1);
      return {
        month:   MONTH_NAMES[i],
        income:  parseFloat(m?.totalIn  ?? "0"),
        expense: parseFloat(m?.totalOut ?? "0"),
      };
    });
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Übersicht</h1>

      {/* 4 Kennzahlen-Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-base-100 shadow rounded-box p-5">
          <p className="text-base text-base-content/60">Mitglieder</p>
          <p className="text-xl font-bold mt-1">{total} aktiv</p>
          {avgAge > 0 && <p className="text-base text-base-content/50 mt-1">Ø {avgAge} Jahre</p>}
        </div>

        <div className="bg-base-100 shadow rounded-box p-5">
          <p className="text-base text-base-content/60">Offene Beiträge</p>
          <p className={`text-xl font-bold mt-1 ${openFees > 0 ? "text-warning" : "text-success"}`}>
            {openFees > 0 ? `${openFees} ausstehend` : "Alle bezahlt"}
          </p>
        </div>

        <div className="bg-base-100 shadow rounded-box p-5">
          <p className="text-base text-base-content/60">
            Kassenstand{fy ? ` ${fy.label}` : ""}
          </p>
          <p className={`text-xl font-bold mt-1 ${totalBalance < 0 ? "text-error" : "text-success"}`}>
            {fy ? eur(totalBalance) : "–"}
          </p>
        </div>

        <div className="bg-base-100 shadow rounded-box p-5">
          <p className="text-base text-base-content/60">Nächster Geburtstag</p>
          <p className="text-base font-medium mt-1 leading-snug">
            {nextBd ?? "–"}
          </p>
        </div>
      </div>

      {/* Charts: Altersverteilung + Monatschart + Geburtstagsliste */}
      <DashboardCharts
        ageGroups={ageGroups}
        avgAge={avgAge}
        minAge={minAge}
        maxAge={maxAge}
        memberCount={total}
        monthlyData={monthlyData}
        upcomingBirthdays={upcoming}
        fiscalYearLabel={fy?.label ?? ""}
      />

      {/* Schnellzugriff + PDF-Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
        {role !== "member" && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-xl">Schnellzugriff</h2>
              <div className="flex flex-col gap-2 mt-2">
                <Link href="/members"           className="btn btn-outline text-base">Mitgliederliste</Link>
                <Link href="/transactions"      className="btn btn-outline text-base">Buchungen</Link>
                <Link href="/reports"           className="btn btn-outline text-base">Auswertungen</Link>
                <Link href="/reports/birthdays" className="btn btn-outline text-base">Geburtstage im Zeitraum</Link>
              </div>
            </div>
          </div>
        )}

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-xl">Geburtstage &amp; Jubiläen</h2>
            <p className="text-base text-base-content/60 mb-2">
              Runde Geburtstage (ab 70, alle 5&nbsp;J.) und Mitgliedsjubiläen (ab 10, alle 5&nbsp;J.)
            </p>
            <form method="GET" action="/api/reports/geburtstage/pdf" target="_blank" className="flex gap-2 items-center mt-auto">
              <input
                type="number" name="year" title="Jahr"
                defaultValue={new Date().getFullYear()}
                min={2000} max={2100}
                className="input input-bordered text-base w-28"
              />
              <button type="submit" className="btn btn-outline text-base flex-1">PDF öffnen</button>
            </form>
          </div>
        </div>

        {role !== "member" && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-xl">Beitragsstand</h2>
              <p className="text-base text-base-content/60 mb-2">
                Alle aktiven Mitglieder — getrennt nach bezahlt&nbsp;/&nbsp;offen
              </p>
              <a
                href="/api/reports/beitragsstand/pdf"
                target="_blank" rel="noopener noreferrer"
                className="btn btn-outline text-base mt-auto"
              >
                PDF öffnen
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
