"use client";

import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface Props {
  receiptId: number;
  fileName: string;
}

export default function ReceiptDeleteButton({ receiptId, fileName }: Props) {
  const router = useRouter();

  async function doDelete() {
    await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <ConfirmModal
      title="Beleg löschen"
      message={`Beleg „${fileName}" wird gelöscht. Fortfahren?`}
      confirmLabel="Löschen"
      confirmClass="btn-error"
      onConfirm={doDelete}
    >
      <button className="btn btn-xs btn-error btn-outline text-base">Löschen</button>
    </ConfirmModal>
  );
}
