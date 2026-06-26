"use client";

import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface Props {
  transactionId: number;
  receiptNumber: string | null;
}

export default function TransactionActions({ transactionId, receiptNumber }: Props) {
  const router = useRouter();

  async function doStorno() {
    await fetch(`/api/transactions/${transactionId}/storno`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    router.refresh();
  }

  // Stornobuchungen selbst nicht nochmals stornierbar
  if (receiptNumber?.includes("-ST-")) return null;

  return (
    <ConfirmModal
      title="Buchung stornieren"
      message={`Beleg ${receiptNumber ?? transactionId} wird durch eine Gegenbuchung storniert. Fortfahren?`}
      confirmLabel="Stornieren"
      confirmClass="btn-error"
      onConfirm={doStorno}
    >
      <button className="btn btn-xs btn-outline btn-error text-base">Storno</button>
    </ConfirmModal>
  );
}
