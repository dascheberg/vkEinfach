import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, and, or, ilike, asc } from "drizzle-orm";
import { formatDate, calculateAge, calculateMemberYears } from "@/lib/utils/calculations";
import Link from "next/link";
import MemberSearch from "@/modules/members/components/MemberSearch";
import ImportModal from "@/components/ui/ImportModal";
import { redirect } from "next/navigation";

type SearchParams = Promise<{ search?: string; active?: string; feePaid?: string }>;

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const params = await searchParams;
  const search = params.search ?? "";
  const showInactive = params.active === "false";
  const feePaid = params.feePaid ?? "all";

  const conditions = [];
  if (!showInactive) conditions.push(eq(members.isActive, true));
  if (feePaid === "true") conditions.push(eq(members.feePaidCurrentYear, true));
  if (feePaid === "false") conditions.push(eq(members.feePaidCurrentYear, false));

  const nameFilter = search
    ? or(ilike(members.lastName, `%${search}%`), ilike(members.firstName, `%${search}%`))
    : null;

  const where =
    nameFilter && conditions.length > 0
      ? and(...conditions, nameFilter)
      : nameFilter
      ? nameFilter
      : conditions.length > 0
      ? and(...conditions)
      : undefined;

  const list = await db
    .select()
    .from(members)
    .where(where)
    .orderBy(asc(members.lastName), asc(members.firstName));

  const isAdmin = role === "admin";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Mitglieder</h1>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <Link href="/members/neu" className="btn btn-primary text-base">
              Neues Mitglied
            </Link>
          )}
          {isAdmin && <ImportModal type="members" />}
          <a href="/api/members/export?type=all" className="btn btn-ghost text-base">
            CSV Export
          </a>
          <a href="/api/members/export?type=jubilaeum" className="btn btn-ghost text-base">
            Jubiläumsliste
          </a>
          <a href="/api/members/export?type=geburtstag" className="btn btn-ghost text-base">
            Geburtstagsliste
          </a>
        </div>
      </div>

      <MemberSearch
        initialSearch={search}
        initialActive={!showInactive}
        initialFeePaid={feePaid}
      />

      <p className="text-base text-base-content/60 mb-3">{list.length} Mitglieder</p>

      {/* Druckbare Listen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="border border-base-200 rounded-box p-4 bg-base-100">
          <h3 className="text-base font-semibold mb-1">Geburtstage &amp; Jubiläen</h3>
          <p className="text-base text-base-content/60 mb-3">
            Runde Geburtstage (ab 70, alle 5&nbsp;J.) und Mitgliedsjubiläen (ab 10, alle 5&nbsp;J.)
          </p>
          <form method="GET" action="/api/reports/geburtstage/pdf" target="_blank" className="flex gap-2 items-center">
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

        <div className="border border-base-200 rounded-box p-4 bg-base-100">
          <h3 className="text-base font-semibold mb-1">Geburtstage im Zeitraum</h3>
          <p className="text-base text-base-content/60 mb-3">
            Geburtstage in einem frei wählbaren Zeitraum — mit CSV-&nbsp;/&nbsp;PDF-Export
          </p>
          <Link href="/reports/birthdays" className="btn btn-outline text-base w-full">
            Auswertung öffnen
          </Link>
        </div>

        <div className="border border-base-200 rounded-box p-4 bg-base-100">
          <h3 className="text-base font-semibold mb-1">Beitragsstand</h3>
          <p className="text-base text-base-content/60 mb-3">
            Alle aktiven Mitglieder — getrennt nach bezahlt&nbsp;/&nbsp;offen
          </p>
          <a
            href="/api/reports/beitragsstand/pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline text-base w-full"
          >
            PDF öffnen
          </a>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full text-base">
          <thead>
            <tr className="text-base">
              <th>Name</th>
              <th>Geburtstag</th>
              <th>Alter</th>
              <th>Mitglied seit</th>
              <th>Jahre</th>
              <th>Funktion</th>
              <th>Beitrag</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-base-content/50">
                  Keine Mitglieder gefunden
                </td>
              </tr>
            ) : (
              list.map((m) => {
                const age = calculateAge(m.birthDate);
                const years = calculateMemberYears(m.joinedAt);
                return (
                  <tr key={m.id} className={!m.isActive ? "opacity-50" : ""}>
                    <td>
                      <Link
                        href={`/members/${m.id}`}
                        className="font-medium hover:underline"
                      >
                        {m.lastName}, {m.firstName}
                      </Link>
                    </td>
                    <td>{formatDate(m.birthDate)}</td>
                    <td>{age ?? "–"}</td>
                    <td>{formatDate(m.joinedAt)}</td>
                    <td>{years ?? "–"}</td>
                    <td>{m.function}</td>
                    <td>
                      <span
                        className={`badge text-base ${
                          m.feePaidCurrentYear ? "badge-success" : "badge-warning"
                        }`}
                      >
                        {m.feePaidCurrentYear ? "Bezahlt" : "Ausstehend"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/members/${m.id}`}
                        className="btn btn-ghost btn-xs text-base bg-amber-300"
                      >
                        Details / bearbeiten
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
