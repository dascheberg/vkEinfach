import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { members, settings as settingsTable } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { calculateMemberYears } from "@/lib/utils/calculations";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "–";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default async function OpenItemsPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const [openMembers, settingRows] = await Promise.all([
    db.select({
      id:                 members.id,
      lastName:           members.lastName,
      firstName:          members.firstName,
      joinedAt:           members.joinedAt,
      function:           members.function,
      feePaidCurrentYear: members.feePaidCurrentYear,
    })
    .from(members)
    .where(and(eq(members.isActive, true), eq(members.feePaidCurrentYear, false)))
    .orderBy(asc(members.lastName), asc(members.firstName)),

    db.select({ key: settingsTable.key, value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "member_fee")),
  ]);

  const memberFee   = settingRows[0]?.value ? parseFloat(settingRows[0].value) : null;
  const totalAmount = memberFee !== null ? openMembers.length * memberFee : null;
  const year        = new Date().getFullYear();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Offene Posten — Beiträge {year}</h1>
        <Link href="/reports" className="btn btn-ghost text-base">← Auswertungen</Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <p className="text-base text-base-content/60">Stand: {todayFormatted()}</p>
        <a
          href="/api/reports/open-items/pdf"
          target="_blank" rel="noopener noreferrer"
          className="btn btn-outline text-base"
        >
          PDF
        </a>
      </div>

      {openMembers.length === 0 ? (
        <div className="alert alert-success text-base">
          Alle aktiven Mitglieder haben den Beitrag {year} bezahlt.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra text-base w-full">
              <thead>
                <tr className="text-base">
                  <th>Name</th>
                  <th>Eingetreten</th>
                  <th>Mitgliedsjahre</th>
                  <th>Funktion</th>
                </tr>
              </thead>
              <tbody>
                {openMembers.map(m => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.lastName}, {m.firstName}</td>
                    <td>{formatDate(m.joinedAt)}</td>
                    <td>{calculateMemberYears(m.joinedAt) ?? "–"} Jahre</td>
                    <td>{m.function}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-6 mt-4 p-4 bg-base-200 rounded-box">
            <span className="text-base font-semibold">
              {openMembers.length} Mitglieder mit offenem Beitrag
            </span>
            {totalAmount !== null && (
              <span className="text-base text-base-content/70">
                Gesamtbetrag: {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(totalAmount)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
