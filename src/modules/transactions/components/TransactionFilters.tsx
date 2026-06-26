"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FiscalYear {
  id: number;
  label: string;
  isActive: boolean;
  isClosed: boolean;
}

interface ExternalAccount {
  id: number;
  name: string;
}

interface InternalAccount {
  id: number;
  number: number;
  name: string;
}

interface Props {
  fiscalYears: FiscalYear[];
  externalAccounts: ExternalAccount[];
  internalAccounts: InternalAccount[];
  defaultFyId: string;
  defaultExtId: string;
  defaultIntId: string;
  defaultDir: string;
  defaultBn: string;
  defaultAmount: string;
}

export default function TransactionFilters({
  fiscalYears,
  externalAccounts,
  internalAccounts,
  defaultFyId,
  defaultExtId,
  defaultIntId,
  defaultDir,
  defaultBn,
  defaultAmount,
}: Props) {
  const router = useRouter();
  const [fyId,   setFyId]   = useState(defaultFyId);
  const [extId,  setExtId]  = useState(defaultExtId);
  const [intId,  setIntId]  = useState(defaultIntId);
  const [dir,    setDir]    = useState(defaultDir);
  const [bn,     setBn]     = useState(defaultBn);
  const [amount, setAmount] = useState(defaultAmount);

  function navigate(newFyId: string, newExtId: string, newIntId: string, newDir: string, newBn: string, newAmount: string) {
    const p = new URLSearchParams();
    if (newFyId)   p.set("fyId",   newFyId);
    if (newExtId)  p.set("extId",  newExtId);
    if (newIntId)  p.set("intId",  newIntId);
    if (newDir)    p.set("dir",    newDir);
    if (newBn)     p.set("bn",     newBn);
    if (newAmount) p.set("amount", newAmount);
    router.push(`/transactions?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <select
        aria-label="Buchungsjahr"
        className="select select-bordered text-base"
        value={fyId}
        onChange={(e) => { setFyId(e.target.value); navigate(e.target.value, extId, intId, dir, bn, amount); }}
      >
        <option value="">Alle Jahre</option>
        {fiscalYears.map((fy) => (
          <option key={fy.id} value={String(fy.id)}>
            {fy.label}{fy.isActive ? " ✓" : ""}{fy.isClosed ? " (abg.)" : ""}
          </option>
        ))}
      </select>

      <select
        aria-label="Externes Konto"
        className="select select-bordered text-base"
        value={extId}
        onChange={(e) => { setExtId(e.target.value); navigate(fyId, e.target.value, intId, dir, bn, amount); }}
      >
        <option value="">Alle ext. Konten</option>
        {externalAccounts.map((a) => (
          <option key={a.id} value={String(a.id)}>{a.name}</option>
        ))}
      </select>

      <select
        aria-label="Internes Konto"
        className="select select-bordered text-base"
        value={intId}
        onChange={(e) => { setIntId(e.target.value); navigate(fyId, extId, e.target.value, dir, bn, amount); }}
      >
        <option value="">Alle int. Konten</option>
        {internalAccounts.map((a) => (
          <option key={a.id} value={String(a.id)}>{a.number} – {a.name}</option>
        ))}
      </select>

      <select
        aria-label="Richtung"
        className="select select-bordered text-base"
        value={dir}
        onChange={(e) => { setDir(e.target.value); navigate(fyId, extId, intId, e.target.value, bn, amount); }}
      >
        <option value="">Ein- und Ausgaben</option>
        <option value="in">Nur Einnahmen</option>
        <option value="out">Nur Ausgaben</option>
      </select>

      <input
        type="text"
        aria-label="Buchungs-Nr. suchen"
        className="input input-bordered text-base font-mono w-40"
        placeholder="BN suchen…"
        value={bn}
        onChange={(e) => setBn(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") navigate(fyId, extId, intId, dir, bn, amount); }}
        onBlur={() => { if (bn !== defaultBn) navigate(fyId, extId, intId, dir, bn, amount); }}
      />

      <input
        type="text"
        aria-label="Betrag suchen"
        className="input input-bordered text-base font-mono w-36"
        placeholder="Betrag…"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") navigate(fyId, extId, intId, dir, bn, amount); }}
        onBlur={() => { if (amount !== defaultAmount) navigate(fyId, extId, intId, dir, bn, amount); }}
      />
    </div>
  );
}
