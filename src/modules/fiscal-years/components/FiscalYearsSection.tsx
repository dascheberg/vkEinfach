"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";

function formatDate(d: string | null): string {
  if (!d) return "–";
  const [y, m, dd] = d.split("-");
  return `${dd}.${m}.${y}`;
}

interface FiscalYear {
  id: number;
  label: string;
  dateFrom: string;
  dateTo: string;
  isActive: boolean;
  isClosed: boolean;
  notes: string | null;
  membershipFee: string | null;
}

interface FormState {
  label: string;
  dateFrom: string;
  dateTo: string;
  notes: string;
  membershipFee: string;
}

const emptyForm: FormState = { label: "", dateFrom: "", dateTo: "", notes: "", membershipFee: "" };

interface Props {
  initialYears: FiscalYear[];
  isAdmin: boolean;
}

export default function FiscalYearsSection({ initialYears, isAdmin }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<FormState>(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  // Carry-over dialog state
  const carryOverRef                              = useRef<HTMLDialogElement>(null);
  const [carryOverSource, setCarryOverSource]     = useState<FiscalYear | null>(null);
  const [carryOverTargetId, setCarryOverTargetId] = useState<string>("");
  const [carryOverLoading, setCarryOverLoading]   = useState(false);
  const [carryOverError, setCarryOverError]       = useState("");
  const [carryOverSuccess, setCarryOverSuccess]   = useState("");

  const openYears = initialYears.filter((fy) => !fy.isClosed);

  async function handleCreate() {
    if (!form.label.trim() || !form.dateFrom || !form.dateTo) {
      setError("Bezeichnung, Beginn und Ende sind erforderlich.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/fiscal-years", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          label:         form.label.trim(),
          membershipFee: form.membershipFee || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Fehler beim Anlegen.");
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function setActive(fy: FiscalYear) {
    if (fy.isClosed) return;
    await fetch(`/api/fiscal-years/${fy.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: true }),
    });
    router.refresh();
  }

  async function toggleClose(fy: FiscalYear) {
    await fetch(`/api/fiscal-years/${fy.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isClosed: !fy.isClosed, isActive: fy.isClosed ? false : fy.isActive }),
    });
    router.refresh();
  }

  function openCarryOverDialog(fy: FiscalYear) {
    setCarryOverSource(fy);
    setCarryOverTargetId(openYears[0]?.id ? String(openYears[0].id) : "");
    setCarryOverError("");
    setCarryOverSuccess("");
    carryOverRef.current?.showModal();
  }

  async function handleCarryOver() {
    if (!carryOverSource || !carryOverTargetId) return;
    setCarryOverLoading(true);
    setCarryOverError("");
    setCarryOverSuccess("");
    try {
      const res = await fetch(`/api/fiscal-years/${carryOverSource.id}/carry-over`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ targetFyId: parseInt(carryOverTargetId) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCarryOverError(data.error ?? "Fehler beim Erstellen des Übertrags.");
        return;
      }
      setCarryOverSuccess(
        `${data.created} Übertragsbuchung${data.created !== 1 ? "en" : ""} für „${data.targetLabel}" erstellt.`
      );
      router.refresh();
    } finally {
      setCarryOverLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Buchungsjahre</h1>
        {isAdmin && !showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary text-base">
            Neues Buchungsjahr
          </button>
        )}
      </div>

      {/* Anlege-Formular */}
      {isAdmin && showForm && (
        <div className="card bg-base-100 border border-base-200 shadow-sm mb-6">
          <div className="card-body gap-4">
            <h2 className="text-xl font-semibold">Neues Buchungsjahr anlegen</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label" htmlFor="fy-label">
                  <span className="label-text text-base">Bezeichnung *</span>
                </label>
                <input
                  id="fy-label"
                  type="text"
                  className="input input-bordered text-base"
                  placeholder="z. B. 2027"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label" htmlFor="fy-fee">
                  <span className="label-text text-base">Aktueller Beitrag (€)</span>
                </label>
                <input
                  id="fy-fee"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input input-bordered text-base"
                  placeholder="z. B. 20.00"
                  value={form.membershipFee}
                  onChange={(e) => setForm({ ...form, membershipFee: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label" htmlFor="fy-notes">
                  <span className="label-text text-base">Notizen</span>
                </label>
                <input
                  id="fy-notes"
                  type="text"
                  className="input input-bordered text-base"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label" htmlFor="fy-from">
                  <span className="label-text text-base">Beginn *</span>
                </label>
                <input
                  id="fy-from"
                  type="date"
                  className="input input-bordered text-base"
                  value={form.dateFrom}
                  onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label" htmlFor="fy-to">
                  <span className="label-text text-base">Ende *</span>
                </label>
                <input
                  id="fy-to"
                  type="date"
                  className="input input-bordered text-base"
                  value={form.dateTo}
                  onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
                />
              </div>
            </div>
            {error && <p className="text-error text-base">{error}</p>}
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={handleCreate} className="btn btn-primary text-base" disabled={saving}>
                {saving ? "Wird angelegt…" : "Anlegen"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(""); }} className="btn btn-ghost text-base">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      {initialYears.length === 0 ? (
        <div className="text-center py-16 text-base-content/50 text-base">
          Noch keine Buchungsjahre angelegt.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full text-base">
            <thead>
              <tr className="text-base">
                <th>Bezeichnung</th>
                <th>Beginn</th>
                <th>Ende</th>
                <th>Beitrag</th>
                <th>Status</th>
                {isAdmin && <th>Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {initialYears.map((fy) => (
                <tr key={fy.id}>
                  <td className="font-semibold">{fy.label}</td>
                  <td>{formatDate(fy.dateFrom)}</td>
                  <td>{formatDate(fy.dateTo)}</td>
                  <td className="font-mono">
                    {fy.membershipFee
                      ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(parseFloat(fy.membershipFee))
                      : <span className="text-base-content/40">—</span>}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {fy.isActive && <span className="badge badge-success text-base">Aktiv</span>}
                      {fy.isClosed && <span className="badge badge-error text-base">Abgeschlossen</span>}
                      {!fy.isActive && !fy.isClosed && (
                        <span className="badge badge-neutral text-base">Inaktiv</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {!fy.isActive && !fy.isClosed && (
                          <ConfirmModal
                            title="Als aktives Buchungsjahr setzen"
                            message={`Soll „${fy.label}" als aktives Buchungsjahr gesetzt werden? Das bisherige aktive Jahr wird deaktiviert.`}
                            confirmLabel="Aktivieren"
                            confirmClass="btn-success"
                            onConfirm={() => setActive(fy)}
                          >
                            <button type="button" className="btn btn-outline btn-success btn-xs text-base">
                              Aktivieren
                            </button>
                          </ConfirmModal>
                        )}
                        <ConfirmModal
                          title={fy.isClosed ? "Buchungsjahr wieder öffnen" : "Buchungsjahr abschließen"}
                          message={
                            fy.isClosed
                              ? `Soll „${fy.label}" wieder geöffnet werden? Buchungen werden dann wieder möglich.`
                              : `Soll „${fy.label}" abgeschlossen werden? Danach sind keine Buchungen mehr möglich.`
                          }
                          confirmLabel={fy.isClosed ? "Öffnen" : "Abschließen"}
                          confirmClass={fy.isClosed ? "btn-warning" : "btn-error"}
                          onConfirm={() => toggleClose(fy)}
                        >
                          <button
                            type="button"
                            className={`btn btn-xs text-base ${fy.isClosed ? "btn-outline btn-warning" : "btn-outline btn-error"}`}
                          >
                            {fy.isClosed ? "Öffnen" : "Abschließen"}
                          </button>
                        </ConfirmModal>
                        {fy.isClosed && openYears.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-outline btn-info btn-xs text-base"
                            onClick={() => openCarryOverDialog(fy)}
                          >
                            Übertrag erstellen
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Übertrag-Dialog */}
      <dialog ref={carryOverRef} className="modal">
        <div className="modal-box">
          <h3 className="text-xl font-bold mb-4">Übertrag erstellen</h3>
          {carryOverSource && (
            <p className="text-base mb-4">
              Abschlusssalden aus <strong>{carryOverSource.label}</strong> als Eröffnungsbuchungen übertragen in:
            </p>
          )}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text text-base">Ziel-Buchungsjahr *</span>
            </label>
            <select
              className="select select-bordered text-base"
              value={carryOverTargetId}
              onChange={(e) => setCarryOverTargetId(e.target.value)}
            >
              {openYears.map((fy) => (
                <option key={fy.id} value={String(fy.id)}>{fy.label}</option>
              ))}
            </select>
          </div>
          <p className="text-base text-base-content/60 mb-4">
            Für jedes aktive externe Konto wird eine Buchung auf Konto 100 (Übertrag Vorjahr) in Höhe des Abschlusssaldos erstellt.
          </p>
          {carryOverError && (
            <p className="text-error text-base mb-3">{carryOverError}</p>
          )}
          {carryOverSuccess && (
            <p className="text-success text-base mb-3">{carryOverSuccess}</p>
          )}
          <div className="modal-action">
            {!carryOverSuccess && (
              <button
                type="button"
                className="btn btn-primary text-base"
                disabled={carryOverLoading || !carryOverTargetId}
                onClick={handleCarryOver}
              >
                {carryOverLoading ? "Wird erstellt…" : "Übertrag erstellen"}
              </button>
            )}
            <form method="dialog">
              <button type="submit" className="btn text-base">
                {carryOverSuccess ? "Schließen" : "Abbrechen"}
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  );
}
