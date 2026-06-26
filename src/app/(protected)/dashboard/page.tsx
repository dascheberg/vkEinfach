import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  calculateAge,
  isRoundBirthday,
  calculateMemberYears,
  isMemberAnniversary,
} from "@/lib/utils/calculations";
import Link from "next/link";

export default async function DashboardPage() {
  await requireAuth();

  const allActive = await db.select().from(members).where(eq(members.isActive, true));

  const total = allActive.length;
  const feePaid = allActive.filter((m) => m.feePaidCurrentYear).length;
  const feeOpen = total - feePaid;
  const roundBirthdays = allActive.filter((m) =>
    isRoundBirthday(calculateAge(m.birthDate))
  ).length;
  const anniversaries = allActive.filter((m) =>
    isMemberAnniversary(calculateMemberYears(m.joinedAt))
  ).length;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Übersicht</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Aktive Mitglieder" value={total} />
        <StatCard label="Beitrag bezahlt" value={feePaid} cls="text-success" />
        <StatCard
          label="Beitrag ausstehend"
          value={feeOpen}
          cls={feeOpen > 0 ? "text-warning" : ""}
        />
        <StatCard label="Jubiläen / Runde Geb." value={roundBirthdays + anniversaries} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-xl">Schnellzugriff</h2>
            <div className="flex flex-col gap-2 mt-2">
              <Link href="/members" className="btn btn-outline text-base">
                Mitgliederliste anzeigen
              </Link>
              <Link href="/members/neu" className="btn btn-outline text-base">
                Neues Mitglied anlegen
              </Link>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-xl">Geburtstage &amp; Jubiläen</h2>
            <p className="text-base text-base-content/60 mb-2">
              Runde Geburtstage (ab 70, alle 5&nbsp;J.) und Mitgliedsjubiläen (ab 10, alle 5&nbsp;J.)
            </p>
            <form method="GET" action="/api/reports/geburtstage/pdf" target="_blank" className="flex gap-2 items-center mt-auto">
              <input
                type="number"
                name="year"
                title="Jahr"
                defaultValue={new Date().getFullYear()}
                min={2000}
                max={2100}
                className="input input-bordered text-base w-28"
              />
              <button type="submit" className="btn btn-outline text-base flex-1">PDF öffnen</button>
            </form>
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-xl">Beitragsstand</h2>
            <p className="text-base text-base-content/60 mb-2">
              Alle aktiven Mitglieder — getrennt nach bezahlt&nbsp;/&nbsp;offen
            </p>
            <a
              href="/api/reports/beitragsstand/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline text-base mt-auto"
            >
              PDF öffnen
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  cls = "",
}: {
  label: string;
  value: number;
  cls?: string;
}) {
  return (
    <div className="bg-base-100 shadow rounded-box p-5">
      <p className="text-base text-base-content/60">{label}</p>
      <p className={`text-xl font-bold mt-1 ${cls}`}>{value}</p>
    </div>
  );
}
