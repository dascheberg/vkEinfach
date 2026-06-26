"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const KIND_LABEL: Record<string, string> = {
  income:   "Einnahme",
  expense:  "Ausgabe",
  neutral:  "Neutral",
  transfer: "Umbuchung",
  cancel:   "Storno",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function filterByDirection(accounts: InternalAccount[], direction: "in" | "out"): InternalAccount[] {
  return accounts.filter((a) => {
    if (!a.isActive) return false;
    const k = a.accountKind;
    if (!k || ["neutral", "transfer", "cancel"].includes(k)) return true;
    return direction === "in" ? k === "income" : k === "expense";
  });
}

interface ExternalAccount {
  id: number;
  name: string;
}

interface InternalAccount {
  id: number;
  number: number;
  name: string;
  accountKind: string | null;
  isActive: boolean;
}

interface Member {
  id: number;
  lastName: string;
  firstName: string;
}

interface Props {
  externalAccounts: ExternalAccount[];
  internalAccounts: InternalAccount[];
  members: Member[];
  externalBalances: Record<number, number>;
  activeFiscalYear: { id: number; label: string; isClosed: boolean };
}

interface FormState {
  bookingDate:        string;
  externalAccountId:  string;
  direction:          "in" | "out";
  amount:             string;
  internalAccountId:  string;
  memberId:           string;
  referenceBookingNo: string;
  description:        string;
}

function defaultForm(today: string, extAccounts: ExternalAccount[]): FormState {
  return {
    bookingDate:        today,
    externalAccountId:  extAccounts[0] ? String(extAccounts[0].id) : "",
    direction:          "in",
    amount:             "",
    internalAccountId:  "",
    memberId:           "",
    referenceBookingNo: "",
    description:        "",
  };
}

export default function TransactionForm({
  externalAccounts,
  internalAccounts,
  members,
  externalBalances,
  activeFiscalYear,
}: Props) {
  const router = useRouter();
  const today  = new Date().toISOString().split("T")[0];

  const [form, setForm]               = useState<FormState>(() => defaultForm(today, externalAccounts));
  const [saving, setSaving]           = useState(false);
  const [error,  setError]            = useState("");
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);

  const filteredInternal = filterByDirection(internalAccounts, form.direction);

  function setDirection(dir: "in" | "out") {
    const newFiltered = filterByDirection(internalAccounts, dir);
    const stillValid  = newFiltered.some((a) => String(a.id) === form.internalAccountId);
    setForm((f) => ({
      ...f,
      direction:         dir,
      internalAccountId: stillValid ? f.internalAccountId : "",
    }));
  }

  const selectedExt = externalAccounts.find((a) => String(a.id) === form.externalAccountId);
  const enteredAmt  = parseFloat(form.amount) || 0;
  const currentBal  = selectedExt ? (externalBalances[selectedExt.id] ?? 0) : 0;
  const previewBal  = form.direction === "in" ? currentBal + enteredAmt : currentBal - enteredAmt;
  const showPreview = !!selectedExt && enteredAmt > 0;

  async function handleSubmit() {
    if (!form.bookingDate || !form.externalAccountId || !form.amount || !form.internalAccountId) {
      setError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    if (parseFloat(form.amount) <= 0) {
      setError("Betrag muss größer als 0 sein.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/transactions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          bookingDate:        form.bookingDate,
          externalAccountId:  parseInt(form.externalAccountId),
          direction:          form.direction,
          amount:             form.amount,
          internalAccountId:  parseInt(form.internalAccountId),
          fiscalYearId:       activeFiscalYear.id,
          memberId:           form.memberId           ? parseInt(form.memberId) : null,
          referenceBookingNo: form.referenceBookingNo || null,
          description:        form.description        || null,
        }),
      });
      if (!res.ok) {
        try {
          const data = await res.json();
          setError(data.error ?? "Fehler beim Speichern.");
        } catch {
          setError(`Serverfehler (${res.status}). Bitte Seite neu laden.`);
        }
        return;
      }
      const saved = await res.json();
      setForm((f) => ({
        ...defaultForm(f.bookingDate, externalAccounts),
        externalAccountId: f.externalAccountId,
        direction:         f.direction,
      }));
      setLastReceipt(saved.receiptNumber ?? null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex flex-col gap-5">

        {/* Buchungsjahr-Info */}
        <div className="flex items-center gap-2 text-base text-base-content/60">
          <span>Buchungsjahr:</span>
          <span className="badge badge-neutral font-semibold">{activeFiscalYear.label}</span>
          {activeFiscalYear.isClosed && (
            <span className="badge badge-error">Abgeschlossen – keine Buchungen möglich</span>
          )}
        </div>

        {/* Buchungsdatum */}
        <div className="form-control">
          <label className="label" htmlFor="bookingDate"><span className="label-text text-base">Buchungsdatum *</span></label>
          <input
            id="bookingDate"
            type="date"
            className="input input-bordered text-base"
            value={form.bookingDate}
            onChange={(e) => setForm({ ...form, bookingDate: e.target.value })}
          />
        </div>

        {/* Externes Konto */}
        <div className="form-control">
          <label className="label" htmlFor="externalAccountId"><span className="label-text text-base">Externes Konto *</span></label>
          <select
            id="externalAccountId"
            className="select select-bordered text-base"
            value={form.externalAccountId}
            onChange={(e) => setForm({ ...form, externalAccountId: e.target.value })}
          >
            <option value="">— bitte wählen —</option>
            {externalAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({formatCurrency(externalBalances[a.id] ?? 0)})
              </option>
            ))}
          </select>
        </div>

        {/* Richtung */}
        <div className="form-control">
          <label className="label"><span className="label-text text-base">Art der Buchung *</span></label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-base">
              <input
                type="radio"
                name="direction"
                className="radio radio-success"
                checked={form.direction === "in"}
                onChange={() => setDirection("in")}
              />
              <span className="text-success font-semibold">Einnahme</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-base">
              <input
                type="radio"
                name="direction"
                className="radio radio-error"
                checked={form.direction === "out"}
                onChange={() => setDirection("out")}
              />
              <span className="text-error font-semibold">Ausgabe</span>
            </label>
          </div>
        </div>

        {/* Betrag */}
        <div className="form-control">
          <label className="label"><span className="label-text text-base">Betrag (€) *</span></label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="input input-bordered text-base font-mono"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          {showPreview && (
            <div className={`mt-2 text-base ${previewBal < 0 ? "text-error" : "text-base-content/60"}`}>
              {selectedExt!.name}: {formatCurrency(currentBal)} →{" "}
              <strong>{formatCurrency(previewBal)}</strong>
              {previewBal < 0 && " ⚠ negativer Saldo"}
            </div>
          )}
        </div>

        {/* Internes Konto */}
        <div className="form-control">
          <label className="label" htmlFor="internalAccountId">
            <span className="label-text text-base">
              Internes Konto *
              <span className="ml-2 text-base-content/50">
                ({form.direction === "in" ? "Einnahmen" : "Ausgaben"} + Sonder-Konten)
              </span>
            </span>
          </label>
          <select
            id="internalAccountId"
            className="select select-bordered text-base"
            value={form.internalAccountId}
            onChange={(e) => setForm({ ...form, internalAccountId: e.target.value })}
          >
            <option value="">— bitte wählen —</option>
            {filteredInternal.map((a) => (
              <option key={a.id} value={a.id}>
                {a.number} – {a.name}
                {a.accountKind ? ` (${KIND_LABEL[a.accountKind] ?? a.accountKind})` : ""}
              </option>
            ))}
          </select>
          {filteredInternal.length === 0 && (
            <p className="text-base text-warning mt-1">
              Keine passenden internen Konten. Bitte zuerst Konten anlegen.
            </p>
          )}
        </div>

        {/* Mitglied */}
        <div className="form-control">
          <label className="label" htmlFor="memberId"><span className="label-text text-base">Mitglied (optional)</span></label>
          <select
            id="memberId"
            className="select select-bordered text-base"
            value={form.memberId}
            onChange={(e) => setForm({ ...form, memberId: e.target.value })}
          >
            <option value="">— kein Mitglied —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.lastName}, {m.firstName}
              </option>
            ))}
          </select>
        </div>

        {/* Referenz-Buchungs-Nr. */}
        <div className="form-control">
          <label className="label" htmlFor="referenceBookingNo">
            <span className="label-text text-base">Referenz-Buchungs-Nr. (optional)</span>
            <span className="label-text-alt text-base text-base-content/50">
              z. B. bei Umbuchungen, Rückvergütungen
            </span>
          </label>
          <input
            id="referenceBookingNo"
            type="text"
            className="input input-bordered font-mono text-base"
            placeholder="z. B. 2026-0012"
            value={form.referenceBookingNo}
            onChange={(e) => setForm({ ...form, referenceBookingNo: e.target.value.toUpperCase() })}
          />
        </div>

        {/* Beschreibung */}
        <div className="form-control">
          <label className="label" htmlFor="description"><span className="label-text text-base">Beschreibung</span></label>
          <textarea
            id="description"
            className="textarea textarea-bordered text-base"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        {lastReceipt && (
          <p className="text-base text-success font-medium">
            ✓ Buchung gespeichert – BN: <span className="font-mono">{lastReceipt}</span>
          </p>
        )}

        {error && <div className="alert alert-error text-base"><span>{error}</span></div>}

        <div className="flex flex-wrap gap-3 mt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary text-base"
            disabled={saving || activeFiscalYear.isClosed}
          >
            {saving ? "Wird gebucht…" : "Buchung speichern"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/transactions")}
            className="btn btn-ghost text-base"
            disabled={saving}
          >
            Zur Buchungsliste
          </button>
        </div>
      </div>
    </div>
  );
}
