import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { travels } from "@/lib/db/schema";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import TravelParticipants from "@/modules/travel/components/TravelParticipants";

const STATUS_LABELS: Record<string, string> = {
  planning: "Planung",
  confirmed: "Bestätigt",
  completed: "Abgeschlossen",
  cancelled: "Abgesagt",
};
const STATUS_BADGE: Record<string, string> = {
  planning: "badge-ghost",
  confirmed: "badge-success",
  completed: "badge-info",
  cancelled: "badge-error",
};

function fmtDate(d: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtEur(v: string | null) {
  if (!v) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(parseFloat(v));
}

export default async function TravelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const { id } = await params;
  const [travel] = await db.select().from(travels).where(eq(travels.id, parseInt(id)));
  if (!travel) notFound();

  const isAdmin = role === "admin";
  const dateRange = travel.dateFrom
    ? travel.dateTo && travel.dateTo !== travel.dateFrom
      ? `${fmtDate(travel.dateFrom)} – ${fmtDate(travel.dateTo)}`
      : fmtDate(travel.dateFrom)
    : "–";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold">{travel.name}</h1>
          <span className={`badge text-base mt-1 ${STATUS_BADGE[travel.status] ?? "badge-ghost"}`}>
            {STATUS_LABELS[travel.status] ?? travel.status}
          </span>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link href={`/travel/${travel.id}/bearbeiten`} className="btn btn-ghost text-base">
              Bearbeiten
            </Link>
          )}
          <Link href="/travel" className="btn btn-ghost text-base">Zurück</Link>
        </div>
      </div>

      {/* Info-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title text-base">Zeitraum</div>
          <div className="stat-value text-xl">{dateRange}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title text-base">Preis / Person</div>
          <div className="stat-value text-xl">{fmtEur(travel.ownContribution)}</div>
        </div>
        {travel.totalCost && (
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title text-base">Gesamtkosten</div>
            <div className="stat-value text-xl">{fmtEur(travel.totalCost)}</div>
          </div>
        )}
      </div>

      {travel.description && (
        <div className="card bg-base-100 shadow mb-6 border-l-4 border-primary">
          <div className="card-body py-4">
            <p className="text-xl font-medium">{travel.description}</p>
          </div>
        </div>
      )}

      {/* Teilnehmerliste */}
      <TravelParticipants
        travelId={travel.id}
        maxParticipants={travel.maxParticipants}
        ownContribution={travel.ownContribution}
        isAdmin={isAdmin}
      />
    </div>
  );
}
