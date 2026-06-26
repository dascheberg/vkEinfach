"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SurveyForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [options, setOptions] = useState(["", ""]);

  function addOption() { if (options.length < 8) setOptions([...options, ""]); }
  function removeOption(idx: number) { if (options.length > 2) setOptions(options.filter((_, i) => i !== idx)); }
  function setOption(idx: number, val: string) { setOptions(options.map((o, i) => (i === idx ? val : o))); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = options.filter((o) => o.trim());
    if (!title.trim()) { setError("Titel erforderlich"); return; }
    if (filled.length < 2) { setError("Mindestens 2 Optionen erforderlich"); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/travel/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), closesAt: closesAt || null, options: filled }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Fehler"); return; }
    router.push(`/travel/surveys/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg">
      {error && <div className="alert alert-error mb-4 text-base">{error}</div>}

      <div className="card bg-base-100 shadow mb-4">
        <div className="card-body">
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Titel *</span></label>
            <input type="text" className="input input-bordered text-base" value={title}
              onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="form-control mb-0">
            <label className="label"><span className="label-text text-base">Abstimmungsende</span></label>
            <input type="date" className="input input-bordered text-base" value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-3">Optionen</h2>
          <div className="flex flex-col gap-2 mb-3">
            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  className="input input-bordered text-base flex-1"
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => setOption(idx, e.target.value)}
                />
                {options.length > 2 && (
                  <button type="button" className="btn btn-ghost btn-square btn-sm"
                    onClick={() => removeOption(idx)}>✕</button>
                )}
              </div>
            ))}
          </div>
          {options.length < 8 && (
            <button type="button" className="btn btn-ghost btn-sm text-base" onClick={addOption}>
              + Option hinzufügen
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost text-base" onClick={() => router.back()}>Abbrechen</button>
        <button type="submit" disabled={loading} className="btn btn-primary text-base">
          {loading ? "Erstellen..." : "Umfrage erstellen"}
        </button>
      </div>
    </form>
  );
}
