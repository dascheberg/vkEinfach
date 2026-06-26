"use client";

import { useEffect, useRef, useState } from "react";

interface SearchResult {
  type: "member" | "guest";
  id: number;
  lastName: string;
  firstName: string;
  detail: string;
}

interface Props {
  registeredIds: Set<string>;
  onAdd: (type: "member" | "guest", id: number) => Promise<void>;
}

export default function ParticipantSearch({ registeredIds, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/travel/search-participants?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  async function handleAdd(r: SearchResult) {
    const key = `${r.type}-${r.id}`;
    setAdding(key);
    await onAdd(r.type, r.id);
    setAdding(null);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="relative">
      <input
        type="text"
        className="input input-bordered text-base w-full max-w-sm"
        placeholder="Name suchen (Mitglied oder Gast)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <span className="loading loading-spinner loading-xs absolute right-3 top-3" />}

      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-w-sm bg-base-100 border border-base-300 rounded-box shadow-lg text-base max-h-64 overflow-y-auto">
          {results.map((r) => {
            const key = `${r.type}-${r.id}`;
            const isRegistered = registeredIds.has(key);
            return (
              <li key={key}>
                <button
                  className={`flex items-center justify-between w-full px-4 py-2 text-left hover:bg-base-200 disabled:opacity-40 disabled:cursor-not-allowed`}
                  disabled={isRegistered || adding === key}
                  onClick={() => handleAdd(r)}
                >
                  <span>
                    {r.lastName}, {r.firstName}
                    <span className="text-base-content/50 ml-2">({r.detail})</span>
                  </span>
                  <span className={`badge badge-sm ml-2 ${r.type === "member" ? "badge-primary" : "badge-secondary"}`}>
                    {r.type === "member" ? "Mitglied" : "Gast"}
                  </span>
                  {isRegistered && <span className="badge badge-sm badge-ghost ml-1">bereits</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
