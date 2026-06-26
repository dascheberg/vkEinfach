"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmModal from "@/components/ui/ConfirmModal";

const TYPE_LABEL: Record<string, string> = {
  cash: "Barkasse",
  bank: "Bankkonto",
  savings: "Sparkonto",
};

const TYPE_BADGE: Record<string, string> = {
  cash: "badge-warning",
  bank: "badge-info",
  savings: "badge-success",
};

function formatBalance(value: string | null): string {
  const num = parseFloat(value ?? "0");
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

interface ExternalAccount {
  id: number;
  name: string;
  accountType: string | null;
  iban: string | null;
  currentBalance: string;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
}

interface FormState {
  name: string;
  accountType: string;
  iban: string;
  sortOrder: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  accountType: "cash",
  iban: "",
  sortOrder: "0",
  notes: "",
};

interface Props {
  initialAccounts: ExternalAccount[];
  isAdmin: boolean;
  balances: Record<number, number>;
}

export default function ExternalAccountsSection({ initialAccounts, isAdmin, balances }: Props) {
  const router = useRouter();
  const modalRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<ExternalAccount | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeCount = initialAccounts.filter((a) => a.isActive).length;
  const canCreate = isAdmin && activeCount < 5;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    modalRef.current?.showModal();
  }

  function openEdit(account: ExternalAccount) {
    setEditing(account);
    setForm({
      name: account.name,
      accountType: account.accountType ?? "cash",
      iban: account.iban ?? "",
      sortOrder: String(account.sortOrder),
      notes: account.notes ?? "",
    });
    setError("");
    modalRef.current?.showModal();
  }

  function closeModal() {
    modalRef.current?.close();
    setEditing(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        accountType: form.accountType || null,
        iban: form.iban.trim() || null,
        sortOrder: parseInt(form.sortOrder) || 0,
        notes: form.notes.trim() || null,
      };

      const res = editing
        ? await fetch(`/api/accounts/external/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/accounts/external", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      closeModal();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(account: ExternalAccount) {
    await fetch(`/api/accounts/external/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !account.isActive }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Externe Konten</h2>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <span className="text-base text-base-content/60">{activeCount} / 5 aktiv</span>
            {canCreate && (
              <button onClick={openCreate} className="btn btn-primary text-base">
                Neues Konto
              </button>
            )}
          </div>
        )}
      </div>

      {initialAccounts.length === 0 ? (
        <div className="text-center py-16 text-base-content/50 text-base">
          Noch keine externen Konten angelegt.
          {isAdmin && (
            <div className="mt-4">
              <button onClick={openCreate} className="btn btn-primary text-base">
                Erstes Konto anlegen
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialAccounts.map((account) => {
            const typeLabel = account.accountType ? (TYPE_LABEL[account.accountType] ?? account.accountType) : null;
            const typeBadge = account.accountType ? (TYPE_BADGE[account.accountType] ?? "badge-neutral") : "badge-neutral";
            return (
              <div
                key={account.id}
                className={`card bg-base-100 shadow-sm border border-base-200 ${!account.isActive ? "opacity-50" : ""}`}
              >
                <div className="card-body p-5 gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold leading-tight">{account.name}</h3>
                    {typeLabel && (
                      <span className={`badge text-base shrink-0 ${typeBadge}`}>{typeLabel}</span>
                    )}
                  </div>

                  <p className={`text-xl font-mono font-semibold mt-1 ${(balances[account.id] ?? 0) < 0 ? "text-error" : ""}`}>
                    {formatBalance(String(balances[account.id] ?? 0))}
                  </p>

                  {account.iban && (
                    <p className="text-base text-base-content/50 font-mono">{account.iban}</p>
                  )}

                  {!account.isActive && (
                    <span className="badge badge-neutral text-base w-fit">Inaktiv</span>
                  )}

                  {account.notes && (
                    <p className="text-base text-base-content/60 mt-1">{account.notes}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-base-200">
                    <Link
                      href={`/transactions?extId=${account.id}`}
                      className="btn btn-ghost btn-sm text-base"
                    >
                      Umsätze
                    </Link>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(account)}
                          className="btn btn-ghost btn-sm text-base"
                        >
                          Bearbeiten
                        </button>
                        <ConfirmModal
                          title={account.isActive ? "Konto deaktivieren" : "Konto aktivieren"}
                          message={
                            account.isActive
                              ? `Soll „${account.name}" deaktiviert werden?`
                              : `Soll „${account.name}" wieder aktiviert werden?`
                          }
                          confirmLabel={account.isActive ? "Deaktivieren" : "Aktivieren"}
                          confirmClass={account.isActive ? "btn-warning" : "btn-success"}
                          onConfirm={() => toggleActive(account)}
                        >
                          <button
                            type="button"
                            className={`btn btn-sm text-base ${
                              account.isActive ? "btn-outline btn-warning" : "btn-outline btn-success"
                            }`}
                          >
                            {account.isActive ? "Deaktivieren" : "Aktivieren"}
                          </button>
                        </ConfirmModal>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Konto anlegen / bearbeiten */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-xl mb-6">
            {editing ? "Konto bearbeiten" : "Neues externes Konto"}
          </h3>

          <div className="flex flex-col gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Name *</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                placeholder="z. B. Barkasse, Sparkasse Konto..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Kontotyp</span>
              </label>
              <select
                className="select select-bordered text-base"
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
              >
                <option value="cash">Barkasse</option>
                <option value="bank">Bankkonto</option>
                <option value="savings">Sparkonto</option>
              </select>
            </div>

            {(form.accountType === "bank" || form.accountType === "savings") && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base">IBAN</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered font-mono text-base"
                  placeholder="DE00 0000 0000 0000 0000 00"
                  value={form.iban}
                  maxLength={34}
                  onChange={(e) => setForm({ ...form, iban: e.target.value })}
                />
              </div>
            )}

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Reihenfolge</span>
              </label>
              <input
                type="number"
                className="input input-bordered text-base"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Notizen</span>
              </label>
              <textarea
                className="textarea textarea-bordered text-base"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {error && <p className="text-error text-base">{error}</p>}
          </div>

          <div className="modal-action">
            <button type="button" className="btn btn-ghost text-base" onClick={closeModal} disabled={saving}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-primary text-base"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={closeModal}>close</button>
        </form>
      </dialog>
    </div>
  );
}
