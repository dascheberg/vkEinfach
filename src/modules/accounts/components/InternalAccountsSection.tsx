"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmModal from "@/components/ui/ConfirmModal";

const KIND_LABEL: Record<string, string> = {
  income:   "Einnahme",
  expense:  "Ausgabe",
  neutral:  "Neutral",
  transfer: "Umbuchung",
  cancel:   "Storno",
};

const KIND_BADGE: Record<string, string> = {
  income:   "badge-success",
  expense:  "badge-error",
  neutral:  "badge-ghost",
  transfer: "badge-info",
  cancel:   "badge-warning",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

interface InternalAccount {
  id: number;
  number: number;
  name: string;
  accountKind: string | null;
  isActive: boolean;
  notes: string | null;
}

interface FormState {
  number: string;
  name: string;
  accountKind: string;
  notes: string;
}

const emptyForm: FormState = {
  number: "",
  name: "",
  accountKind: "income",
  notes: "",
};

interface Props {
  initialAccounts: InternalAccount[];
  accountRange: { min: number; max: number };
  isAdmin: boolean;
  balances: Record<number, number>;
}

export default function InternalAccountsSection({
  initialAccounts,
  accountRange,
  isAdmin,
  balances,
}: Props) {
  const router    = useRouter();
  const modalRef  = useRef<HTMLDialogElement>(null);
  const [editing, setEditing]     = useState<InternalAccount | null>(null);
  const [form, setForm]           = useState<FormState>(emptyForm);
  const [search, setSearch]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [error, setError]         = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = initialAccounts.filter((a) => {
    if (!showInactive && !a.isActive) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return String(a.number).includes(q) || a.name.toLowerCase().includes(q);
  });

  const totalBalance = filtered.reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    modalRef.current?.showModal();
  }

  function openEdit(account: InternalAccount) {
    setEditing(account);
    setForm({
      number:      String(account.number),
      name:        account.name,
      accountKind: account.accountKind ?? "income",
      notes:       account.notes ?? "",
    });
    setError("");
    modalRef.current?.showModal();
  }

  function closeModal() {
    modalRef.current?.close();
    setEditing(null);
  }

  async function handleSave() {
    const num = parseInt(form.number);
    if (!form.name.trim()) {
      setError("Bezeichnung ist erforderlich.");
      return;
    }
    if (isNaN(num) || num < accountRange.min || num > accountRange.max) {
      setError(`Kontonummer muss zwischen ${accountRange.min} und ${accountRange.max} liegen.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        number:      num,
        name:        form.name.trim(),
        accountKind: form.accountKind || null,
        notes:       form.notes.trim() || null,
      };
      const res = editing
        ? await fetch(`/api/accounts/internal/${editing.id}`, {
            method:  "PUT",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
          })
        : await fetch("/api/accounts/internal", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
          });

      if (!res.ok) {
        try {
          const data = await res.json();
          setError(data.error ?? "Fehler beim Speichern.");
        } catch {
          setError(`Fehler beim Speichern (HTTP ${res.status}).`);
        }
        return;
      }
      closeModal();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(account: InternalAccount) {
    await fetch(`/api/accounts/internal/${account.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !account.isActive }),
    });
    router.refresh();
  }

  async function handleImport() {
    setImporting(true);
    setImportMsg("");
    try {
      const res  = await fetch("/api/accounts/internal/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(`${data.inserted} Konten angelegt, ${data.skipped} bereits vorhanden.`);
        router.refresh();
      } else {
        setImportMsg(data.error ?? "Fehler beim Import.");
      }
    } finally {
      setImporting(false);
    }
  }

  const activeCount = initialAccounts.filter((a) => a.isActive).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Interne Konten</h2>
          <p className="text-base text-base-content/60">
            Nummernrahmen: {accountRange.min}–{accountRange.max} · {activeCount} aktiv
            {initialAccounts.length > activeCount && ` · ${initialAccounts.length - activeCount} inaktiv`}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <ConfirmModal
              title="Startkonfiguration laden"
              message="Lädt 36 vordefinierte Konten. Bereits vorhandene Kontonummern werden übersprungen. Fortfahren?"
              confirmLabel="Laden"
              confirmClass="btn-primary"
              onConfirm={handleImport}
            >
              <button type="button" className="btn btn-outline btn-secondary text-base" disabled={importing}>
                {importing ? "Wird geladen…" : "Startkonfiguration laden"}
              </button>
            </ConfirmModal>
            <button type="button" onClick={openCreate} className="btn btn-primary text-base">
              Neues Konto
            </button>
          </div>
        )}
      </div>

      {importMsg && (
        <div className="alert alert-info text-base mb-4">
          <span>{importMsg}</span>
        </div>
      )}

      {/* Suche + Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          className="input input-bordered text-base w-64"
          placeholder="Nr. oder Bezeichnung suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-2 text-base cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Inaktive anzeigen
        </label>
      </div>

      {/* Tabelle */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-base-content/50 text-base">
          {initialAccounts.length === 0
            ? "Noch keine internen Konten. Startkonfiguration laden oder manuell anlegen."
            : "Keine Konten gefunden."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full text-base">
            <thead>
              <tr className="text-base">
                <th className="w-20">Nr.</th>
                <th>Bezeichnung</th>
                <th className="w-32">Art</th>
                <th className="w-36 text-right">Saldo</th>
                <th className="w-48">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => {
                const kindLabel = account.accountKind
                  ? (KIND_LABEL[account.accountKind] ?? account.accountKind)
                  : "–";
                const kindBadge = account.accountKind
                  ? (KIND_BADGE[account.accountKind] ?? "badge-ghost")
                  : "badge-ghost";
                const balance   = balances[account.id] ?? 0;
                return (
                  <tr key={account.id} className={!account.isActive ? "opacity-40" : ""}>
                    <td className="font-mono font-semibold">{account.number}</td>
                    <td>
                      {account.name}
                      {account.notes && (
                        <span className="text-base-content/40 ml-2">({account.notes})</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge text-base ${kindBadge}`}>{kindLabel}</span>
                    </td>
                    <td className={`text-right font-mono ${balance > 0 ? "text-success" : balance < 0 ? "text-error" : "text-base-content/40"}`}>
                      {balance !== 0 ? formatCurrency(balance) : "–"}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/transactions?intId=${account.id}`}
                          className="btn btn-ghost btn-xs text-base"
                        >
                          Umsätze
                        </Link>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(account)}
                              className="btn btn-ghost btn-xs text-base"
                            >
                              Bearbeiten
                            </button>
                            <ConfirmModal
                              title={account.isActive ? "Konto deaktivieren" : "Konto aktivieren"}
                              message={
                                account.isActive
                                  ? `Soll Konto ${account.number} – „${account.name}" deaktiviert werden?`
                                  : `Soll Konto ${account.number} – „${account.name}" wieder aktiviert werden?`
                              }
                              confirmLabel={account.isActive ? "Deaktivieren" : "Aktivieren"}
                              confirmClass={account.isActive ? "btn-warning" : "btn-success"}
                              onConfirm={() => toggleActive(account)}
                            >
                              <button
                                type="button"
                                className={`btn btn-xs text-base ${
                                  account.isActive ? "btn-outline btn-warning" : "btn-outline btn-success"
                                }`}
                              >
                                {account.isActive ? "Deakt." : "Aktiv."}
                              </button>
                            </ConfirmModal>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t-2 border-base-300">
                <td colSpan={3} className="text-base">
                  {filtered.length} Konten
                </td>
                <td className={`text-right font-mono text-base ${totalBalance > 0 ? "text-success" : totalBalance < 0 ? "text-error" : ""}`}>
                  {formatCurrency(totalBalance)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-xl mb-6">
            {editing ? "Konto bearbeiten" : "Neues internes Konto"}
          </h3>
          <div className="flex flex-col gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">
                  Kontonummer * ({accountRange.min}–{accountRange.max})
                </span>
              </label>
              <input
                type="number"
                className="input input-bordered font-mono text-base"
                min={accountRange.min}
                max={accountRange.max}
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Bezeichnung *</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Kontoart</span>
              </label>
              <select
                className="select select-bordered text-base"
                value={form.accountKind}
                onChange={(e) => setForm({ ...form, accountKind: e.target.value })}
              >
                <option value="income">Einnahme</option>
                <option value="expense">Ausgabe</option>
                <option value="neutral">Neutral</option>
                <option value="transfer">Umbuchung</option>
                <option value="cancel">Storno</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Notizen</span>
              </label>
              <textarea
                className="textarea textarea-bordered text-base"
                rows={2}
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
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}
