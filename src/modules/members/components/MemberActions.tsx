"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { isExitReached } from "@/lib/utils/memberStatus";
import { formatDate } from "@/lib/utils/calculations";

interface Props {
  memberId: number;
  isActive: boolean;
  leftAt?: string | null;
}

export default function MemberActions({ memberId, isActive, leftAt }: Props) {
  const router = useRouter();

  // Bei erreichtem Austrittsdatum ist Aktivieren gesperrt — die API lehnt es ab.
  const exitReached = isExitReached(leftAt);

  async function toggleActive() {
    await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-3 flex-wrap">
      <Link href={`/members/${memberId}/bearbeiten`} className="btn btn-primary text-base">
        Bearbeiten
      </Link>
      {!isActive && exitReached ? (
        <span className="badge badge-warning badge-lg text-base">
          Ausgetreten zum {formatDate(leftAt)}
        </span>
      ) : (
        <ConfirmModal
          title={isActive ? "Mitglied deaktivieren" : "Mitglied aktivieren"}
          message={
            isActive
              ? "Soll dieses Mitglied wirklich deaktiviert werden?"
              : "Soll dieses Mitglied wieder aktiviert werden?"
          }
          confirmLabel={isActive ? "Deaktivieren" : "Aktivieren"}
          confirmClass={isActive ? "btn-warning" : "btn-success"}
          onConfirm={toggleActive}
        >
          <button
            className={`btn text-base ${
              isActive ? "btn-outline btn-warning" : "btn-outline btn-success"
            }`}
          >
            {isActive ? "Deaktivieren" : "Aktivieren"}
          </button>
        </ConfirmModal>
      )}
    </div>
  );
}
