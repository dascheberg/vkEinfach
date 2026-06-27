import { requireAuth } from "@/lib/auth/session";
import Link from "next/link";
import SurveyVoting from "@/modules/travel/components/SurveyVoting";

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  const { id } = await params;
  const surveyId = parseInt(id);

  const isAdmin = role === "admin";
  const canSeeResults = role === "admin" || role === "finanzen" || role === "vorstand" || role === "auditor";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/travel/surveys" className="btn btn-ghost btn-sm text-base">← Umfragen</Link>
        <h1 className="text-xl font-bold">Umfrage</h1>
      </div>
      <SurveyVoting surveyId={surveyId} isAdmin={isAdmin} canSeeResults={canSeeResults} />
    </div>
  );
}
