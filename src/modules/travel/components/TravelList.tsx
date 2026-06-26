"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface FiscalYear { id: number; label: string; isActive: boolean; }

interface TravelRow {
  id: number;
  name: string;
  dateFrom: string | null;
  dateTo: string | null;
  status: string;
  minParticipants: number | null;
  maxParticipants: number | null;
  ownContribution: string | null;
  participantCount: number;
  unpaidCount: number;
}

interface Props {
  fiscalYears: FiscalYear[];
  selectedFyId: number | null;
  isAdmin: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  planning: "Planung",
  confirmed: "Bestätigt",
  completed: "Abgeschlossen",
  cancelled: "Abgesagt",
};

const STATUS_BADGE: Record<string, string> = {
  planning: "badge-ghost",
  confirmed: "badge-success",
  completed: "badge-info",
  cancelled: "badge-error",
};

function fmtDate(d: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtEur(v: string | null) {
  if (!v) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(parseFloat(v));
}

export default function TravelList({ fiscalYears, selectedFyId, isAdmin }: Props) {
  const router = useRouter();
  const [travels, setTravels] = useState<TravelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fyId, setFyId] = useState<number | null>(selectedFyId);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, [fyId]);

  async function load() {
    setLoading(true);
    const url = fyId ? `/api/travel?fiscalYearId=${fyId}` : "/api/travel";
    const res = await fetch(url);
    if (res.ok) setTravels(await res.json());
    setLoading(false);
  }

  function handleFyChange(val: string) {
    const id = val ? parseInt(val) : null;
    setFyId(id);
    const url = id ? `/travel?fyId=${id}` : "/travel";
    router.replace(url, { scroll: false });
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/travel/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Fehler beim Löschen");
    } else {
      await load();
    }
  }

  return (
    <>
      {error && (
        <div className="alert alert-error mb-4 text-base">
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setError("")}>✕</button>
        </div>
      )}

      <div className="flex gap-3 items-center mb-6">
        <label className="label-text text-base">Buchungsjahr:</label>
        <select
          className="select select-bordered text-base"
          value={fyId ?? ""}
          onChange={(e) => handleFyChange(e.target.value)}
        >
          <option value="">Alle</option>
          {fiscalYears.map((fy) => (
            <option key={fy.id} value={fy.id}>
              {fy.label}{fy.isActive ? " (aktiv)" : ""}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : travels.length === 0 ? (
        <p className="text-base text-base-content/50 py-8 text-center">Keine Reisen vorhanden</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra text-base w-full">
            <thead>
              <tr>
                <th>Veranstaltung</th>
                <th>Zeitraum</th>
                <th>Min / Max</th>
                <th>Angemeldet</th>
                <th>Nicht bezahlt</th>
                <th>Preis</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {travels.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="font-medium">{t.name}</div>
                    <span className={`badge badge-sm text-base mt-1 ${STATUS_BADGE[t.status] ?? "badge-ghost"}`}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {t.dateFrom ? `${fmtDate(t.dateFrom)}` : "–"}
                    {t.dateTo && t.dateTo !== t.dateFrom ? ` – ${fmtDate(t.dateTo)}` : ""}
                  </td>
                  <td>{t.minParticipants ?? 0} / {t.maxParticipants ?? "–"}</td>
                  <td>{Number(t.participantCount)}</td>
                  <td>
                    {Number(t.unpaidCount) > 0
                      ? <span className="text-warning font-medium">{Number(t.unpaidCount)}</span>
                      : <span className="text-success">0</span>}
                  </td>
                  <td>{fmtEur(t.ownContribution)}</td>
                  <td>
                    <div className="flex gap-2 flex-wrap">
                      <Link href={`/travel/${t.id}`} className="btn btn-sm btn-ghost text-base">
                        Detail
                      </Link>
                      {isAdmin && (
                        <>
                          <Link href={`/travel/${t.id}/bearbeiten`} className="btn btn-sm btn-ghost text-base">
                            Bearbeiten
                          </Link>
                          <ConfirmModal
                            title="Reise löschen"
                            message={`„${t.name}" löschen? Nur möglich wenn keine Teilnehmer vorhanden.`}
                            confirmLabel="Löschen"
                            confirmClass="btn-error"
                            onConfirm={() => handleDelete(t.id)}
                          >
                            <button className="btn btn-sm btn-ghost text-base text-error">Löschen</button>
                          </ConfirmModal>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
