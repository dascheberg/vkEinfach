import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { travels, fiscalYears } from "@/lib/db/schema";
import { redirect, notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
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

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Reise bearbeiten</h1>
      <TravelForm
        mode="edit"
        travelId={travel.id}
        fiscalYears={allFy}
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
          status: travel.status,
          notes: travel.notes ?? "",
        }}
      />
    </div>
  );
}
