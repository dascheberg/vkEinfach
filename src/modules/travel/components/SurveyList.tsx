"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SurveyRow {
  id: number;
  title: string;
  status: string;
  closesAt: string | null;
  voteCount: number;
}

interface Props { isAdmin: boolean; }

function fmtDate(d: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE");
}

export default function SurveyList({ isAdmin }: Props) {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/travel/surveys")
      .then((r) => r.json())
      .then(setSurveys)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md" /></div>;
  if (surveys.length === 0) return <p className="text-base text-base-content/50 py-8 text-center">Keine Umfragen vorhanden</p>;

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra text-base w-full">
        <thead>
          <tr>
            <th>Titel</th>
            <th>Status</th>
            <th>Abstimmungsende</th>
            <th>Stimmen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {surveys.map((s) => (
            <tr key={s.id}>
              <td className="font-medium">{s.title}</td>
              <td>
                <span className={`badge text-base ${s.status === "open" ? "badge-success" : "badge-ghost"}`}>
                  {s.status === "open" ? "Offen" : "Geschlossen"}
                </span>
              </td>
              <td>{fmtDate(s.closesAt)}</td>
              <td>{Number(s.voteCount)}</td>
              <td>
                <Link href={`/travel/surveys/${s.id}`} className="btn btn-sm btn-ghost text-base">
                  {isAdmin ? "Detail" : (s.status === "open" ? "Abstimmen" : "Ergebnis")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
