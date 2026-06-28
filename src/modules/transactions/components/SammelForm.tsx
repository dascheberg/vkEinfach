"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}.${m}.${y}`;
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
}

interface Member {
  id: number;
  lastName: string;
  firstName: string;
  feePaidCurrentYear: boolean;
  function: string;
}

interface Guest {
  id: number;
  lastName: string;
  firstName: string;
}

interface Travel {
  id: number;
  name: string;
  dateFrom: string | null;
  dateTo: string | null;
}

interface ParticipantEntry {
  key: string;
  label: string;
  type: "Mitglied" | "Gast";
  memberId?: number;
  guestId?: number;
  disabled: boolean;
  disabledReason?: string;
}

interface Props {
  externalAccounts: ExternalAccount[];
  internalAccounts: InternalAccount[];
  members: Member[];
  guests: Guest[];
  travels: Travel[];
  activeFiscalYear: { id: number; label: string; isClosed: boolean };
}

function isReiseKonto(number: number, name: string): boolean {
  return (number >= 160 && number <= 199) || /reise|eigenanteil/i.test(name);
}

function showsGuests(number: number, name: string): boolean {
  return isReiseKonto(number, name) || (number >= 200 && number <= 249);
}

function isBeitragKonto(number: number): boolean {
  return number === 103;
}

export default function SammelForm({
  externalAccounts,
  internalAccounts,
  members,
  guests,
  travels,
  activeFiscalYear,
}: Props) {
  const router = useRouter();
  const today  = new Date().toISOString().split("T")[0];

  const [bookingDate,       setBookingDate]       = useState(today);
  const [externalAccountId, setExternalAccountId] = useState(externalAccounts[0] ? String(externalAccounts[0].id) : "");
  const [internalAccountId, setInternalAccountId] = useState("");
  const [travelId,          setTravelId]          = useState("");
  const [amountPerPerson,   setAmountPerPerson]   = useState("");
  const [description,       setDescription]       = useState("");
  const [totalAmountInput,  setTotalAmountInput]  = useState("");
  const [search,            setSearch]            = useState("");
  const [selected,          setSelected]          = useState<Set<string>>(new Set());
  const [saving,            setSaving]            = useState(false);
  const [error,             setError]             = useState("");
  const [result,            setResult]            = useState<{
    created: number;
    totalAmount: number;
    firstBN: string;
    lastBN: string;
    feesPaid: number;
    travelPaid: number;
    travelRegistered: number;
  } | null>(null);

  const selectedIntAccount = internalAccounts.find((a) => String(a.id) === internalAccountId);
  const intNumber          = selectedIntAccount?.number ?? 0;
  const intName            = selectedIntAccount?.name ?? "";
  const reise              = isReiseKonto(intNumber, intName);

  const participantList = useMemo((): ParticipantEntry[] => {
    if (!internalAccountId) return [];
    const list: ParticipantEntry[] = [];
    const beitrag   = isBeitragKonto(intNumber);
    const mitGuests = showsGuests(intNumber, intName);

    for (const m of members) {
      const disabled = beitrag && m.feePaidCurrentYear;
      list.push({
        key:      `m-${m.id}`,
        label:    `${m.lastName}, ${m.firstName}`,
        type:     "Mitglied",
        memberId: m.id,
        disabled,
        disabledReason: disabled ? "bereits bezahlt" : undefined,
      });
    }

    if (mitGuests) {
      for (const g of guests) {
        list.push({
          key:     `g-${g.id}`,
          label:   `${g.lastName}, ${g.firstName}`,
          type:    "Gast",
          guestId: g.id,
          disabled: false,
        });
      }
    }

    return list;
  }, [internalAccountId, intNumber, intName, members, guests]);

  const filteredList = useMemo(() => {
    if (!search.trim()) return participantList;
    const q = search.toLowerCase();
    return participantList.filter((p) => p.label.toLowerCase().includes(q));
  }, [participantList, search]);

  function toggleAll(select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of filteredList) {
        if (!p.disabled) {
          if (select) next.add(p.key);
          else next.delete(p.key);
        }
      }
      return next;
    });
  }

  function toggleOne(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const selectedCount   = [...selected].filter((k) => participantList.find((p) => p.key === k)).length;
  const amountNum       = parseFloat(amountPerPerson) || 0;
  const calculatedTotal = amountNum * selectedCount;
  const totalInputNum   = parseFloat(totalAmountInput.replace(",", ".")) || null;
  const totalMatch      = totalInputNum === null || Math.abs(totalInputNum - calculatedTotal) <= 0.01;
  const canSave         = !activeFiscalYear.isClosed
    && selectedCount > 0
    && amountNum > 0
    && !!bookingDate
    && !!externalAccountId
    && !!internalAccountId
    && (!reise || !!travelId)
    && totalMatch;

  async function handleSubmit() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    setResult(null);

    const participants = [...selected]
      .map((key) => {
        const p = participantList.find((x) => x.key === key);
        if (!p) return null;
        return p.memberId ? { memberId: p.memberId } : { guestId: p.guestId };
      })
      .filter(Boolean);

    try {
      const res = await fetch("/api/transactions/sammel", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date:              bookingDate,
          externalAccountId: parseInt(externalAccountId),
          internalAccountId: parseInt(internalAccountId),
          amountPerPerson:   amountNum,
          description:       description || null,
          totalAmount:       totalInputNum,
          travelId:          travelId ? parseInt(travelId) : undefined,
          participants,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Serverfehler (${res.status}).`);
        return;
      }

      const data = await res.json();
      setResult({
        created:          data.created,
        totalAmount:      data.totalAmount,
        firstBN:          data.receiptNumbers[0] ?? "",
        lastBN:           data.receiptNumbers[data.receiptNumbers.length - 1] ?? "",
        feesPaid:         data.statusUpdates?.feesPaid ?? 0,
        travelPaid:       data.statusUpdates?.travelPaid ?? 0,
        travelRegistered: data.statusUpdates?.travelRegistered ?? 0,
      });
      setSelected(new Set());
      setSearch("");
      setInternalAccountId("");
      setTravelId("");
      setAmountPerPerson("");
      setDescription("");
      setTotalAmountInput("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col gap-5">

        <div className="flex items-center gap-2 text-base text-base-content/60">
          <span>Buchungsjahr:</span>
          <span className="badge badge-neutral font-semibold">{activeFiscalYear.label}</span>
          {activeFiscalYear.isClosed && (
            <span className="badge badge-error">Abgeschlossen – keine Buchungen möglich</span>
          )}
        </div>

        {result && (
          <div className="alert alert-success text-base">
            <div className="flex flex-col gap-1">
              <span className="font-semibold">
                ✓ {result.created} Buchungen erstellt — Gesamt: {formatCurrency(result.totalAmount)}
              </span>
              <span className="font-mono text-base">
                BN {result.firstBN}{result.firstBN !== result.lastBN ? ` bis ${result.lastBN}` : ""}
              </span>
              {result.feesPaid > 0 && (
                <span>Beitrag als bezahlt markiert: {result.feesPaid} Mitglieder</span>
              )}
              {result.travelPaid > 0 && (
                <span>
                  Reisezahlung markiert: {result.travelPaid} Personen
                  {result.travelRegistered > 0 && ` (davon ${result.travelRegistered} neu angemeldet)`}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label" htmlFor="bookingDate">
              <span className="label-text text-base">Datum *</span>
            </label>
            <input
              id="bookingDate"
              type="date"
              className="input input-bordered text-base"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
            />
          </div>

          <div className="form-control">
            <label className="label" htmlFor="externalAccountId">
              <span className="label-text text-base">Ext. Konto *</span>
            </label>
            <select
              id="externalAccountId"
              className="select select-bordered text-base"
              value={externalAccountId}
              onChange={(e) => setExternalAccountId(e.target.value)}
            >
              <option value="">— bitte wählen —</option>
              {externalAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label" htmlFor="internalAccountId">
              <span className="label-text text-base">Int. Konto *</span>
            </label>
            <select
              id="internalAccountId"
              className="select select-bordered text-base"
              value={internalAccountId}
              onChange={(e) => {
                setInternalAccountId(e.target.value);
                setTravelId("");
                setSelected(new Set());
              }}
            >
              <option value="">— bitte wählen —</option>
              {internalAccounts
                .filter((a) => a.accountKind === "income" || a.accountKind === "neutral" || a.accountKind === "transfer")
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.number} – {a.name}</option>
                ))}
            </select>
          </div>

          {/* Reise-Dropdown — erscheint dynamisch bei Reise-Konto */}
          {reise && (
            <div className="form-control">
              <label className="label" htmlFor="travelId">
                <span className="label-text text-base">Reise *</span>
              </label>
              {travels.length === 0 ? (
                <div className="alert alert-warning text-base py-2">
                  Keine aktiven Reisen im Buchungsjahr {activeFiscalYear.label} gefunden.
                </div>
              ) : (
                <select
                  id="travelId"
                  className="select select-bordered text-base"
                  value={travelId}
                  onChange={(e) => setTravelId(e.target.value)}
                >
                  <option value="">— Reise wählen —</option>
                  {travels.map((t) => {
                    const datum = t.dateFrom
                      ? t.dateTo && t.dateTo !== t.dateFrom
                        ? `${formatDate(t.dateFrom)}–${formatDate(t.dateTo)}`
                        : formatDate(t.dateFrom)
                      : "";
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name}{datum ? ` (${datum})` : ""}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          <div className="form-control">
            <label className="label" htmlFor="amountPerPerson">
              <span className="label-text text-base">Betrag/Person (€) *</span>
            </label>
            <input
              id="amountPerPerson"
              type="number"
              step="0.01"
              min="0.01"
              className="input input-bordered text-base font-mono"
              placeholder="0,00"
              value={amountPerPerson}
              onChange={(e) => setAmountPerPerson(e.target.value)}
            />
          </div>

          <div className="form-control sm:col-span-2">
            <label className="label" htmlFor="description">
              <span className="label-text text-base">Beschreibung</span>
            </label>
            <input
              id="description"
              type="text"
              className="input input-bordered text-base"
              placeholder="z. B. Mitgliedsbeitrag 2026"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-control">
            <label className="label" htmlFor="totalAmountInput">
              <span className="label-text text-base">Gesamtbetrag (optional, zur Kontrolle)</span>
            </label>
            <input
              id="totalAmountInput"
              type="text"
              className={`input input-bordered text-base font-mono ${totalAmountInput && !totalMatch ? "input-error" : ""}`}
              placeholder="z. B. 1200,00"
              value={totalAmountInput}
              onChange={(e) => setTotalAmountInput(e.target.value)}
            />
          </div>
        </div>

        {/* Personen auswählen */}
        <div className="border border-base-300 rounded-box">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-base-300">
            <span className="text-base font-semibold">Personen auswählen</span>
            <div className="flex gap-2">
              <button type="button" className="btn btn-xs btn-ghost text-base"
                onClick={() => toggleAll(true)} disabled={!internalAccountId}>
                Alle
              </button>
              <button type="button" className="btn btn-xs btn-ghost text-base"
                onClick={() => toggleAll(false)}>
                Keine
              </button>
            </div>
          </div>

          {!internalAccountId ? (
            <div className="p-4 text-base text-base-content/50">
              Bitte zuerst ein internes Konto auswählen.
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-base-300">
                <input
                  type="text"
                  className="input input-bordered input-sm w-full text-base"
                  placeholder="🔍 Suche nach Name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filteredList.length === 0 ? (
                  <div className="p-4 text-base text-base-content/50">Keine Einträge gefunden.</div>
                ) : (
                  <ul className="divide-y divide-base-200">
                    {filteredList.map((p) => (
                      <li
                        key={p.key}
                        className={`flex items-center gap-3 px-4 py-2 ${p.disabled ? "opacity-40" : "hover:bg-base-100 cursor-pointer"}`}
                        onClick={() => !p.disabled && toggleOne(p.key)}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selected.has(p.key)}
                          disabled={p.disabled}
                          onChange={() => {}}
                          readOnly
                        />
                        <span className="flex-1 text-base">{p.label}</span>
                        <span className="text-base text-base-content/50">{p.type}</span>
                        {p.disabledReason && (
                          <span className="text-base text-warning">{p.disabledReason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* Zusammenfassung */}
        <div className={`flex flex-wrap items-center gap-4 p-4 rounded-box border ${totalMatch ? "border-success bg-success/5" : "border-error bg-error/5"}`}>
          <div className="text-base">
            <span className="font-semibold">{selectedCount}</span> Personen ×{" "}
            <span className="font-mono">{formatCurrency(amountNum)}</span> ={" "}
            <span className="font-semibold font-mono">{formatCurrency(calculatedTotal)}</span>
          </div>
          {totalAmountInput ? (
            <div className={`text-base font-semibold ${totalMatch ? "text-success" : "text-error"}`}>
              {totalMatch
                ? "✅ Kontrollbetrag stimmt"
                : `❌ Abweichung: ${formatCurrency(Math.abs((totalInputNum ?? 0) - calculatedTotal))}`}
            </div>
          ) : (
            selectedCount > 0 && amountNum > 0 && <span className="text-success text-base">✅</span>
          )}
        </div>

        {reise && !travelId && (
          <div className="alert alert-warning text-base py-2">
            <span>Bitte eine Reise auswählen bevor Buchungen erstellt werden.</span>
          </div>
        )}

        {error && <div className="alert alert-error text-base"><span>{error}</span></div>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary text-base"
            onClick={handleSubmit}
            disabled={!canSave || saving}
          >
            {saving ? "Wird gebucht…" : `${selectedCount} Buchungen erstellen`}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-base"
            onClick={() => router.push("/transactions")}
            disabled={saving}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
