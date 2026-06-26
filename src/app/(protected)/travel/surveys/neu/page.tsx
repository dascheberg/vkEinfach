import { requireAuth } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import SurveyForm from "@/modules/travel/components/SurveyForm";

export default async function SurveyNeuPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") redirect("/travel/surveys");

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Neue Umfrage</h1>
      <SurveyForm />
    </div>
  );
}
