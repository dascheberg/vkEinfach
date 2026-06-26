"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface SurveyOption {
  id: number;
  optionText: string;
  sortOrder: number;
  voteCount: number;
}

interface SurveyDetail {
  id: number;
  title: string;
  status: "open" | "closed";
  closesAt: string | null;
  options: SurveyOption[];
  myVoteOptionId: number | null;
  canVote: boolean;
}

interface Props {
  surveyId: number;
  isAdmin: boolean;
  canSeeResults: boolean;
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("de-DE");
}

export default function SurveyVoting({ surveyId, isAdmin, canSeeResults }: Props) {
  const router = useRouter();
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusChanging, setStatusChanging] = useState(false);

  async function load() {
    const res = await fetch(`/api/travel/surveys/${surveyId}`);
    if (res.ok) {
      const data = await res.json();
      setSurvey(data);
      if (data.myVoteOptionId) setSelected(data.myVoteOptionId);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [surveyId]);

  async function handleVote() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/travel/surveys/${surveyId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: selected }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Fehler"); return; }
    setSuccess("Stimme abgegeben!");
    await load();
    router.refresh();
  }

  async function handleStatusToggle() {
    if (!survey) return;
    setStatusChanging(true);
    const newStatus = survey.status === "open" ? "closed" : "open";
    await fetch(`/api/travel/surveys/${surveyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatusChanging(false);
    await load();
    router.refresh();
  }

  if (loading) return <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md" /></div>;
  if (!survey) return <div className="alert alert-error">Umfrage nicht gefunden</div>;

  const hasVoted = !!survey.myVoteOptionId;
  const isOpen = survey.status === "open";
  const showResults = canSeeResults || hasVoted || !isOpen;
  const totalVotes = survey.options.reduce((s, o) => s + Number(o.voteCount), 0);

  const chartData = survey.options.map((opt) => ({
    name: opt.optionText.length > 20 ? opt.optionText.slice(0, 18) + "…" : opt.optionText,
    fullName: opt.optionText,
    Stimmen: Number(opt.voteCount),
    isMyVote: survey.myVoteOptionId === opt.id,
  }));

  return (
    <div className="max-w-2xl">
      {/* Titel + Status */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body py-4">
          <h2 className="text-xl font-bold">{survey.title}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className={`badge text-base ${isOpen ? "badge-success" : "badge-ghost"}`}>
              {isOpen ? "Offen" : "Geschlossen"}
            </span>
            {survey.closesAt && (
              <span className="text-base text-base-content/60">Abstimmungsende: {fmtDate(survey.closesAt)}</span>
            )}
            <span className="text-base text-base-content/60">{totalVotes} Stimme{totalVotes !== 1 ? "n" : ""}</span>
            <div className="ml-auto flex gap-2">
              {isAdmin && !isOpen && (
                <button className="btn btn-sm btn-ghost text-base" disabled={statusChanging} onClick={handleStatusToggle}>
                  Wieder öffnen
                </button>
              )}
              {isAdmin && isOpen && (
                <ConfirmModal
                  title="Umfrage schließen?"
                  message="Die Umfrage wird geschlossen. Mitglieder können dann nicht mehr abstimmen."
                  confirmLabel="Schließen"
                  onConfirm={handleStatusToggle}
                >
                  <button className="btn btn-sm btn-outline text-base" disabled={statusChanging}>
                    Schließen
                  </button>
                </ConfirmModal>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-4 text-base">{error}</div>}
      {success && <div className="alert alert-success mb-4 text-base">{success}</div>}

      {/* Abstimmung */}
      {isOpen && !hasVoted && (
        <div className="card bg-base-100 shadow mb-6">
          <div className="card-body">
            <h3 className="text-base font-semibold mb-3">Bitte abstimmen</h3>
            <div className="flex flex-col gap-2 mb-4">
              {survey.options.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${selected === opt.id ? "border-primary bg-primary/10" : "border-base-300 hover:bg-base-200"}
                    ${!survey.canVote ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="radio"
                    className="radio radio-primary"
                    checked={selected === opt.id}
                    disabled={!survey.canVote}
                    onChange={() => survey.canVote && setSelected(opt.id)}
                  />
                  <span className="text-base">{opt.optionText}</span>
                </label>
              ))}
            </div>
            {survey.canVote ? (
              <button
                className="btn btn-primary text-base"
                disabled={!selected || submitting}
                onClick={handleVote}
              >
                {submitting ? "Abstimmen..." : "Stimme abgeben"}
              </button>
            ) : (
              <div className="alert alert-warning text-base">
                Nur Mitglieder mit hinterlegter E-Mail können abstimmen.
              </div>
            )}
          </div>
        </div>
      )}

      {hasVoted && isOpen && (
        <div className="alert alert-info mb-6 text-base">
          Sie haben bereits abgestimmt. Das Ergebnis wird nach Schließen der Umfrage veröffentlicht.
        </div>
      )}

      {!isOpen && !hasVoted && (
        <div className="alert mb-6 text-base">Diese Umfrage ist geschlossen.</div>
      )}

      {/* Ergebnis-Diagramm */}
      {showResults && (
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h3 className="text-base font-semibold mb-4">
              Ergebnis
              {hasVoted && (
                <span className="ml-2 text-base font-normal text-base-content/60">
                  — Ihre Stimme ist <span className="text-warning font-medium">gelb</span> markiert
                </span>
              )}
            </h3>
            {totalVotes === 0 ? (
              <p className="text-base text-base-content/50">Noch keine Stimmen abgegeben.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={30} />
                  <Tooltip
                    formatter={(value) => [`${value} Stimme${Number(value) !== 1 ? "n" : ""}`, ""]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                  />
                  <Bar dataKey="Stimmen" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.isMyVote ? "#f59e0b" : "#36d399"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 flex flex-col gap-1">
              {survey.options.map((opt) => {
                const pct = totalVotes > 0 ? Math.round((Number(opt.voteCount) / totalVotes) * 100) : 0;
                const isMyVote = survey.myVoteOptionId === opt.id;
                return (
                  <div key={opt.id} className="flex justify-between text-base">
                    <span className={isMyVote ? "font-medium" : ""}>
                      {isMyVote && "▶ "}{opt.optionText}
                    </span>
                    <span className="text-base-content/60">
                      {Number(opt.voteCount)} Stimme{Number(opt.voteCount) !== 1 ? "n" : ""} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
