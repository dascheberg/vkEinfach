"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ParticipantSearch from "./ParticipantSearch";

interface Participant {
  id: number;
  travelId: number;
  memberId: number | null;
  guestId: number | null;
  isRegistered: boolean;
  isPaid: boolean;
  paidAmount: string;
  type: string;
  lastName: string | null;
  firstName: string | null;
}

interface Props {
  travelId: number;
  maxParticipants: number | null;
  ownContribution: string | null;
  isAdmin: boolean;
}

function fmtEur(v: string | null) {
  if (!v) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(parseFloat(v));
}

export default function TravelParticipants({ travelId, maxParticipants, ownContribution, isAdmin }: Props) {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/travel/${travelId}/participants`);
    if (res.ok) setParticipants(await res.json());
    setLoading(false);
  }

  async function handleToggle(pid: number, field: "isRegistered" | "isPaid", value: boolean) {
    await fetch(`/api/travel/${travelId}/participants/${pid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    await load();
    router.refresh();
  }

  async function handleRemove(pid: number) {
    const res = await fetch(`/api/travel/${travelId}/participants/${pid}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler");
    } else {
      await load();
      router.refresh();
    }
  }

  async function handleAdd(type: "member" | "guest", personId: number) {
    const body = type === "member" ? { memberId: personId } : { guestId: personId };
    const res = await fetch(`/api/travel/${travelId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Hinzufügen");
    } else {
      await load();
      router.refresh();
    }
  }

  const registered = participants.filter((p) => p.isRegistered);
  const paid = participants.filter((p) => p.isPaid);
  const totalIncome = paid.length * (ownContribution ? parseFloat(ownContribution) : 0);
  const registeredIds = new Set(
    participants.map((p) => (p.memberId ? `member-${p.memberId}` : `guest-${p.guestId}`))
  );

  return (
    <div>
      {error && (
        <div className="alert alert-error mb-4 text-base">
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setError("")}>✕</button>
        </div>
      )}

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="stat bg-base-100 rounded-box shadow py-3">
          <div className="stat-title text-base">Angemeldet</div>
          <div className="stat-value text-xl">
            {registered.length}{maxParticipants ? ` / ${maxParticipants}` : ""}
          </div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow py-3">
          <div className="stat-title text-base">Bezahlt</div>
          <div className="stat-value text-xl text-success">{paid.length}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow py-3">
          <div className="stat-title text-base">Offen</div>
          <div className="stat-value text-xl text-warning">{registered.length - paid.length}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow py-3">
          <div className="stat-title text-base">Einnahmen</div>
          <div className="stat-value text-xl">
            {fmtEur(totalIncome.toFixed(2))}
          </div>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      {maxParticipants && maxParticipants > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-base text-base-content/60 mb-1">
            <span>Angemeldet: {registered.length}</span>
            <span>Max: {maxParticipants}</span>
          </div>
          <progress
            className="progress progress-primary w-full"
            value={registered.length}
            max={maxParticipants}
          />
        </div>
      )}

      {/* Teilnehmer hinzufügen */}
      {isAdmin && (
        <div className="card bg-base-100 shadow mb-6">
          <div className="card-body py-4">
            <h3 className="text-base font-bold mb-3">Teilnehmer hinzufügen</h3>
            <ParticipantSearch registeredIds={registeredIds} onAdd={handleAdd} />
          </div>
        </div>
      )}

      {/* Teilnehmertabelle */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold">Teilnehmer ({participants.length})</h3>
        {participants.length > 0 && (
          <a
            href={`/api/travel/${travelId}/participants/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm text-base"
          >
            Teilnehmerliste (PDF)
          </a>
        )}
      </div>
      {loading ? (
        <div className="flex justify-center py-4">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : participants.length === 0 ? (
        <p className="text-base text-base-content/50 py-4 text-center">Noch keine Teilnehmer</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra text-base w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Typ</th>
                <th>Angemeldet</th>
                <th>Bezahlt</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.lastName}, {p.firstName}</td>
                  <td>
                    <span className={`badge text-base ${p.type === "member" ? "badge-primary" : "badge-secondary"}`}>
                      {p.type === "member" ? "Mitglied" : "Gast"}
                    </span>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={p.isRegistered}
                      disabled={!isAdmin}
                      onChange={(e) => handleToggle(p.id, "isRegistered", e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-success"
                      checked={p.isPaid}
                      disabled={!isAdmin}
                      onChange={(e) => handleToggle(p.id, "isPaid", e.target.checked)}
                    />
                  </td>
                  {isAdmin && (
                    <td>
                      <ConfirmModal
                        title="Teilnehmer entfernen"
                        message={`„${p.firstName} ${p.lastName}" von der Reise entfernen?`}
                        confirmLabel="Entfernen"
                        confirmClass="btn-error"
                        onConfirm={() => handleRemove(p.id)}
                      >
                        <button className="btn btn-sm btn-ghost text-base text-error">Entfernen</button>
                      </ConfirmModal>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
