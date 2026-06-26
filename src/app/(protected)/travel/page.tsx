import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fiscalYears } from "@/lib/db/schema";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import Link from "next/link";
import TravelList from "@/modules/travel/components/TravelList";

type SearchParams = Promise<{ fyId?: string }>;

export default async function TravelPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const params = await searchParams;
  const isAdmin = role === "admin";

  const allFy = await db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom));
  const activeFy = allFy.find((f) => f.isActive) ?? allFy[allFy.length - 1];
  const selectedFyId = params.fyId ? parseInt(params.fyId) : activeFy?.id;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Reisen</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <Link href="/travel/surveys" className="btn btn-ghost text-base">
            Umfragen
          </Link>
          {isAdmin && (
            <Link href="/travel/neu" className="btn btn-primary text-base">
              Neue Reise
            </Link>
          )}
        </div>
      </div>

      <TravelList
        fiscalYears={allFy}
        selectedFyId={selectedFyId ?? null}
        isAdmin={isAdmin}
      />
    </div>
  );
}
