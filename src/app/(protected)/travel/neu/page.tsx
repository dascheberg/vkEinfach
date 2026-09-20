import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fiscalYears, internalAccounts } from "@/lib/db/schema";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import TravelForm from "@/modules/travel/components/TravelForm";

export default async function TravelNeuPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") redirect("/travel");

  const allFy = await db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom));

  const accounts = await db
    .select({ id: internalAccounts.id, number: internalAccounts.number, name: internalAccounts.name })
    .from(internalAccounts)
    .where(and(eq(internalAccounts.isActive, true), inArray(internalAccounts.accountKind, ["income", "neutral", "expense"])))
    .orderBy(asc(internalAccounts.number));

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Neue Reise</h1>
      <TravelForm mode="create" fiscalYears={allFy} internalAccounts={accounts} />
    </div>
  );
}
