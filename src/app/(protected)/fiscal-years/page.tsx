import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fiscalYears } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import FiscalYearsSection from "@/modules/fiscal-years/components/FiscalYearsSection";

export default async function FiscalYearsPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const years = await db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom));
  const isAdmin = role === "admin";

  return (
    <div>
      <FiscalYearsSection initialYears={years} isAdmin={isAdmin} />
    </div>
  );
}
