import { requireAuth } from "@/lib/auth/session";
import Link from "next/link";
import SurveyList from "@/modules/travel/components/SurveyList";

export default async function SurveysPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  const isAdmin = role === "admin";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/travel" className="btn btn-ghost btn-sm text-base">← Reisen</Link>
          <h1 className="text-xl font-bold">Umfragen</h1>
        </div>
        {isAdmin && (
          <Link href="/travel/surveys/neu" className="btn btn-primary text-base">
            Neue Umfrage
          </Link>
        )}
      </div>
      <SurveyList isAdmin={isAdmin} />
    </div>
  );
}
