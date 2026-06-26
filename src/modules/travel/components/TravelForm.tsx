"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FiscalYear { id: number; label: string; isActive: boolean; }

interface TravelData {
  name: string;
  dateFrom: string;
  dateTo: string;
  destination: string;
  totalCost: string;
  ownContribution: string;
  minParticipants: string;
  maxParticipants: string;
  description: string;
  fiscalYearId: string;
  status: string;
  notes: string;
}

interface Props {
  mode: "create" | "edit";
  travelId?: number;
  initial?: Partial<TravelData>;
  fiscalYears: FiscalYear[];
}

const STATUS_OPTIONS = [
  { value: "planning",   label: "Planung" },
  { value: "confirmed",  label: "Bestätigt" },
  { value: "completed",  label: "Abgeschlossen" },
  { value: "cancelled",  label: "Abgesagt" },
];

export default function TravelForm({ mode, travelId, initial, fiscalYears }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeFy = fiscalYears.find((f) => f.isActive) ?? fiscalYears[0];

  const [form, setForm] = useState<TravelData>({
    name: initial?.name ?? "",
    dateFrom: initial?.dateFrom ?? "",
    dateTo: initial?.dateTo ?? "",
    destination: initial?.destination ?? "",
    totalCost: initial?.totalCost ?? "",
    ownContribution: initial?.ownContribution ?? "",
    minParticipants: initial?.minParticipants ?? "0",
    maxParticipants: initial?.maxParticipants ?? "",
    description: initial?.description ?? "",
    fiscalYearId: initial?.fiscalYearId ?? String(activeFy?.id ?? ""),
    status: initial?.status ?? "planning",
    notes: initial?.notes ?? "",
  });

  function set(key: keyof TravelData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name ist erforderlich"); return; }
    setLoading(true);
    setError("");

    const url = mode === "create" ? "/api/travel" : `/api/travel/${travelId}`;
    const method = mode === "create" ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        minParticipants: form.minParticipants || 0,
        maxParticipants: form.maxParticipants || null,
        totalCost: form.totalCost || null,
        ownContribution: form.ownContribution || null,
        fiscalYearId: form.fiscalYearId || null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Fehler beim Speichern"); return; }
    router.push(mode === "create" ? `/travel/${data.id}` : `/travel/${travelId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      {error && <div className="alert alert-error mb-4 text-base">{error}</div>}

      <div className="card bg-base-100 shadow mb-4">
        <div className="card-body">
          <h2 className="text-base font-bold mb-2">Allgemein</h2>

          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Name der Veranstaltung *</span></label>
            <input type="text" className="input input-bordered text-base" value={form.name}
              onChange={(e) => set("name", e.target.value)} required />
          </div>

          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Kurzbeschreibung</span></label>
            <textarea className="textarea textarea-bordered text-base" rows={2} value={form.description}
              onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="flex gap-3 mb-3">
            <div className="form-control flex-1">
              <label className="label"><span className="label-text text-base">Von</span></label>
              <input type="date" className="input input-bordered text-base" value={form.dateFrom}
                onChange={(e) => set("dateFrom", e.target.value)} />
            </div>
            <div className="form-control flex-1">
              <label className="label"><span className="label-text text-base">Bis</span></label>
              <input type="date" className="input input-bordered text-base" value={form.dateTo}
                onChange={(e) => set("dateTo", e.target.value)} />
            </div>
          </div>

          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Status</span></label>
            <select className="select select-bordered text-base" value={form.status}
              onChange={(e) => set("status", e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow mb-4">
        <div className="card-body">
          <h2 className="text-base font-bold mb-2">Teilnehmer &amp; Kosten</h2>

          <div className="flex gap-3 mb-3">
            <div className="form-control flex-1">
              <label className="label"><span className="label-text text-base">Min. Teilnehmer</span></label>
              <input type="number" min="0" className="input input-bordered text-base" value={form.minParticipants}
                onChange={(e) => set("minParticipants", e.target.value)} />
            </div>
            <div className="form-control flex-1">
              <label className="label"><span className="label-text text-base">Max. Teilnehmer</span></label>
              <input type="number" min="0" className="input input-bordered text-base" value={form.maxParticipants}
                onChange={(e) => set("maxParticipants", e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3 mb-3">
            <div className="form-control flex-1">
              <label className="label"><span className="label-text text-base">Preis / Teilnehmer (€)</span></label>
              <input type="number" step="0.01" min="0" className="input input-bordered text-base"
                value={form.ownContribution} onChange={(e) => set("ownContribution", e.target.value)} />
            </div>
            <div className="form-control flex-1">
              <label className="label"><span className="label-text text-base">Gesamtkosten (€)</span></label>
              <input type="number" step="0.01" min="0" className="input input-bordered text-base"
                value={form.totalCost} onChange={(e) => set("totalCost", e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-2">Buchungsjahr &amp; Bemerkungen</h2>

          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Buchungsjahr</span></label>
            <select className="select select-bordered text-base" value={form.fiscalYearId}
              onChange={(e) => set("fiscalYearId", e.target.value)}>
              <option value="">– keines –</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.label}{fy.isActive ? " (aktiv)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-control mb-0">
            <label className="label"><span className="label-text text-base">Bemerkungen</span></label>
            <textarea className="textarea textarea-bordered text-base" rows={2} value={form.notes}
              onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost text-base" onClick={() => router.back()}>
          Abbrechen
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary text-base">
          {loading ? "Speichern..." : mode === "create" ? "Reise anlegen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
