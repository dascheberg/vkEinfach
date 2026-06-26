import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import MemberForm from "@/modules/members/components/MemberForm";
import Link from "next/link";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") redirect("/members");

  const { id } = await params;
  const [member] = await db.select().from(members).where(eq(members.id, parseInt(id)));
  if (!member) notFound();

  const initial = {
    lastName: member.lastName,
    firstName: member.firstName,
    street: member.street ?? "",
    zip: member.zip ?? "",
    city: member.city ?? "",
    birthDate: member.birthDate ?? "",
    phoneLandline: member.phoneLandline ?? "",
    phoneMobile: member.phoneMobile ?? "",
    email: member.email ?? "",
    function: member.function,
    joinedAt: member.joinedAt ?? "",
    leftAt: member.leftAt ?? "",
    deceased: member.deceased,
    isActive: member.isActive,
    feePaidCurrentYear: member.feePaidCurrentYear,
    feeNotes: member.feeNotes ?? "",
    notes: member.notes ?? "",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Link href={`/members/${member.id}`} className="btn btn-ghost text-base">
          Zurück
        </Link>
        <h1 className="text-xl font-bold">
          Bearbeiten: {member.firstName} {member.lastName}
        </h1>
      </div>
      <MemberForm mode="edit" memberId={member.id} initial={initial} />
    </div>
  );
}
