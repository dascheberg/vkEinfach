"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface Props {
  memberId: number;
  isActive: boolean;
}

export default function MemberActions({ memberId, isActive }: Props) {
  const router = useRouter();

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
    </div>
  );
}
