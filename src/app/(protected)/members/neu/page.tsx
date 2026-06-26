import { requireAuth } from "@/lib/auth/session";
import MemberForm from "@/modules/members/components/MemberForm";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function NewMemberPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") redirect("/members");

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/members" className="btn btn-ghost text-base">
          Zurück
        </Link>
        <h1 className="text-xl font-bold">Neues Mitglied</h1>
      </div>
      <MemberForm mode="create" />
    </div>
  );
}
