"use client";

import { useRef } from "react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClass?: string;
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Bestätigen",
  confirmClass = "btn-error",
  onConfirm,
  children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  function open() {
    ref.current?.showModal();
  }

  async function handleConfirm() {
    ref.current?.close();
    await onConfirm();
  }

  return (
    <>
      <span onClick={open}>{children}</span>
      <dialog ref={ref} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-xl mb-4">{title}</h3>
          <p className="text-base">{message}</p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-base">Abbrechen</button>
            </form>
            <button onClick={handleConfirm} className={`btn ${confirmClass} text-base`}>
              {confirmLabel}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
