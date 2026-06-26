"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialSearch: string;
  initialActive: boolean;
  initialFeePaid: string;
}

export default function MemberSearch({ initialSearch, initialActive, initialFeePaid }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [active, setActive] = useState(initialActive);
  const [feePaid, setFeePaid] = useState(initialFeePaid);

  function buildUrl() {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (!active) q.set("active", "false");
    if (feePaid !== "all") q.set("feePaid", feePaid);
    const qs = q.toString();
    return `/members${qs ? `?${qs}` : ""}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl());
  }

  function handleReset() {
    setSearch("");
    setActive(true);
    setFeePaid("all");
    router.push("/members");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap gap-4 items-end mb-6 bg-base-100 p-4 rounded-box shadow"
    >
      <div className="form-control">
        <label className="label pb-1">
          <span className="label-text text-base">Name</span>
        </label>
        <input
          type="text"
          placeholder="Suchen..."
          className="input input-bordered text-base w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="form-control">
        <label className="label pb-1">
          <span className="label-text text-base">Status</span>
        </label>
        <select
          className="select select-bordered text-base"
          value={active ? "active" : "all"}
          onChange={(e) => setActive(e.target.value === "active")}
        >
          <option value="active">Nur Aktive</option>
          <option value="all">Alle</option>
        </select>
      </div>

      <div className="form-control">
        <label className="label pb-1">
          <span className="label-text text-base">Beitrag</span>
        </label>
        <select
          className="select select-bordered text-base"
          value={feePaid}
          onChange={(e) => setFeePaid(e.target.value)}
        >
          <option value="all">Alle</option>
          <option value="true">Bezahlt</option>
          <option value="false">Ausstehend</option>
        </select>
      </div>

      <button type="submit" className="btn btn-primary text-base">
        Suchen
      </button>
      <button type="button" onClick={handleReset} className="btn btn-ghost text-base">
        Zurücksetzen
      </button>
    </form>
  );
}
