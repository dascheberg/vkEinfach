import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { travels, fiscalYears, internalAccounts } from "@/lib/db/schema";
import { redirect, notFound } from "next/navigation";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import TravelForm from "@/modules/travel/components/TravelForm";

export default async function TravelBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") redirect("/travel");

  const { id } = await params;
  const [travel] = await db.select().from(travels).where(eq(travels.id, parseInt(id)));
  if (!travel) notFound();

  const allFy = await db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom));

  // aktive Konten + das aktuell hinterlegte (falls inzwischen deaktiviert)
  const accounts = await db
    .select({ id: internalAccounts.id, number: internalAccounts.number, name: internalAccounts.name })
    .from(internalAccounts)
    .where(or(
      and(eq(internalAccounts.isActive, true), inArray(internalAccounts.accountKind, ["income", "neutral", "expense"])),
      eq(internalAccounts.id, travel.internalAccountId ?? -1),
    ))
    .orderBy(asc(internalAccounts.number));

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Reise bearbeiten</h1>
      <TravelForm
        mode="edit"
        travelId={travel.id}
        fiscalYears={allFy}
        internalAccounts={accounts}
        initial={{
          name: travel.name,
          dateFrom: travel.dateFrom ?? "",
          dateTo: travel.dateTo ?? "",
          destination: travel.destination ?? "",
          totalCost: travel.totalCost ?? "",
          ownContribution: travel.ownContribution ?? "",
          minParticipants: String(travel.minParticipants ?? 0),
          maxParticipants: travel.maxParticipants ? String(travel.maxParticipants) : "",
          description: travel.description ?? "",
          fiscalYearId: travel.fiscalYearId ? String(travel.fiscalYearId) : "",
          internalAccountId: travel.internalAccountId ? String(travel.internalAccountId) : "",
          status: travel.status,
          notes: travel.notes ?? "",
        }}
      />
    </div>
  );
}
