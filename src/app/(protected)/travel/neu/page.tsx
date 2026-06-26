import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fiscalYears } from "@/lib/db/schema";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import TravelForm from "@/modules/travel/components/TravelForm";

export default async function TravelNeuPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") redirect("/travel");

  const allFy = await db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom));

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Neue Reise</h1>
      <TravelForm mode="create" fiscalYears={allFy} />
    </div>
  );
}
