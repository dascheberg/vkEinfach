"use client";

import { useState, useRef } from "react";
import { parseCsv, applyMapping } from "@/lib/utils/csvParser";

type ImportType = "members" | "users" | "internalAccounts" | "transactions";
type Step = 1 | 2 | 3 | 4 | 5;

const TYPE_OPTIONS: { value: ImportType; label: string; description: string }[] = [
  { value: "members",          label: "Mitglieder",          description: "Name, Adresse, Geburtsdatum, Funktion, …" },
  { value: "users",            label: "Benutzer (Zugänge)",  description: "Name, E-Mail, Rolle, Passwort, …" },
  { value: "internalAccounts", label: "Interne Konten",      description: "Kontonummer, Bezeichnung, Typ" },
  { value: "transactions",     label: "Buchungen",           description: "Datum, Betrag, Richtung, Konten" },
];

type FieldDef = { key: string; label: string; required: boolean };

const IMPORT_FIELDS: Record<ImportType, FieldDef[]> = {
  members: [
    { key: "lastName",           label: "Nachname",               required: true },
    { key: "firstName",          label: "Vorname",                required: true },
    { key: "street",             label: "Straße",                 required: false },
    { key: "zip",                label: "PLZ",                    required: false },
    { key: "city",               label: "Ort",                    required: false },
    { key: "birthDate",          label: "Geburtsdatum",           required: false },
    { key: "phoneLandline",      label: "Tel. Festnetz",          required: false },
    { key: "phoneMobile",        label: "Tel. Mobil",             required: false },
    { key: "email",              label: "E-Mail",                 required: false },
    { key: "function",           label: "Vereinsfunktion",        required: false },
    { key: "joinedAt",           label: "Eintrittsdatum",         required: false },
    { key: "isActive",           label: "Aktiv (ja/nein)",        required: false },
    { key: "feePaidCurrentYear", label: "Beitrag bezahlt",        required: false },
    { key: "notes",              label: "Notizen",                required: false },
  ],
  users: [
    { key: "name",     label: "Name (vollständig)",  required: true },
    { key: "email",    label: "E-Mail",              required: false },
    { key: "username", label: "Benutzername",        required: false },
    { key: "role",     label: "Rolle",               required: false },
    { key: "function", label: "Vereinsfunktion",     required: false },
    { key: "approved", label: "Freigeschaltet",      required: false },
    { key: "password", label: "Passwort",            required: false },
  ],
  internalAccounts: [
    { key: "number",      label: "Kontonummer",              required: true },
    { key: "name",        label: "Bezeichnung",              required: true },
    { key: "accountKind", label: "Typ (income/expense/…)",   required: false },
  ],
  transactions: [
    { key: "bookingDate",          label: "Buchungsdatum",       required: true },
    { key: "amount",               label: "Betrag",              required: true },
    { key: "direction",            label: "Richtung (in/out)",   required: true },
    { key: "externalAccountName",  label: "Ext. Konto (Name)",   required: true },
    { key: "internalAccountNumber",label: "Int. Konto (Nr.)",    required: true },
    { key: "description",          label: "Beschreibung",        required: false },
    { key: "memberLastName",       label: "Mitglied Nachname",   required: false },
  ],
};

interface PreviewRow {
  status: "ok" | "warn" | "error";
  data: Record<string, string>;
  issues: string[];
}

const STATUS_ICON: Record<string, string> = { ok: "✅", warn: "⚠️", error: "❌" };
const STATUS_BG:   Record<string, string> = {
  ok:   "bg-success/10",
  warn: "bg-warning/10",
  error:"bg-error/10",
};

function buildAutoMapping(fields: FieldDef[], headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const f of fields) {
    const match = headers.find(
      (h) => h.toLowerCase().trim() === f.key.toLowerCase() ||
             h.toLowerCase().trim() === f.label.toLowerCase()
    );
    mapping[f.key] = match ?? "";
  }
  return mapping;
}

export default function ImportWizard() {
  const [step,          setStep]          = useState<Step>(1);
  const [importType,    setImportType]    = useState<ImportType>("members");
  const [csvHeaders,    setCsvHeaders]    = useState<string[]>([]);
  const [csvRows,       setCsvRows]       = useState<string[][]>([]);
  const [mapping,       setMapping]       = useState<Record<string, string>>({});
  const [previewData,   setPreviewData]   = useState<PreviewRow[]>([]);
  const [totalRows,     setTotalRows]     = useState(0);
  const [fiscalYearId,     setFiscalYearId]     = useState<string>("");
  const [fiscalYears,      setFiscalYears]      = useState<{ id: number; label: string }[]>([]);
  const [extAccounts,      setExtAccounts]      = useState<{ id: number; name: string; sortOrder: number }[]>([]);
  const [result,           setResult]           = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(1);
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setPreviewData([]);
    setTotalRows(0);
    setResult(null);
    setError(null);
    setFiscalYearId("");
    setExtAccounts([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function loadExtAccounts() {
    if (extAccounts.length > 0) return;
    const res = await fetch("/api/accounts/external", { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      setExtAccounts(
        data.map((a: { id: number; name: string; sortOrder: number }) => ({
          id: a.id,
          name: a.name,
          sortOrder: a.sortOrder,
        }))
      );
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setError("CSV-Datei ist leer oder hat keine erkennbaren Spalten.");
        return;
      }
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      const fields = IMPORT_FIELDS[importType];
      setMapping(buildAutoMapping(fields, parsed.headers));
    };
    reader.readAsText(file, "utf-8");
  }

  async function loadFiscalYears() {
    const res = await fetch("/api/fiscal-years", { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      setFiscalYears(data.map((fy: { id: number; label: string }) => ({ id: fy.id, label: fy.label })));
      const active = data.find((fy: { isActive?: boolean }) => fy.isActive);
      if (active) setFiscalYearId(String(active.id));
    }
  }

  async function handleGoToMapping() {
    if (csvHeaders.length === 0) {
      setError("Bitte zuerst eine CSV-Datei hochladen.");
      return;
    }
    if (importType === "transactions" && fiscalYears.length === 0) {
      await loadFiscalYears();
    }
    setStep(3);
  }

  async function handlePreview() {
    const fields = IMPORT_FIELDS[importType];
    const hasRequired = fields.filter((f) => f.required).every((f) => mapping[f.key]);
    if (!hasRequired) {
      setError("Bitte alle Pflichtfelder zuordnen.");
      return;
    }
    if (importType === "transactions" && !fiscalYearId) {
      setError("Bitte ein Buchungsjahr auswählen.");
      return;
    }
    setError(null);
    setLoading(true);

    const mappedRows = applyMapping(csvHeaders, csvRows, mapping);

    try {
      const res = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: importType, rows: mappedRows }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Vorschau-Fehler"); return; }
      setPreviewData(data.preview);
      setTotalRows(data.totalRows);
      setStep(4);
    } catch {
      setError("Netzwerkfehler beim Laden der Vorschau.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    setLoading(true);
    setError(null);

    const mappedRows = applyMapping(csvHeaders, csvRows, mapping);

    try {
      const body: Record<string, unknown> = { type: importType, rows: mappedRows };
      if (importType === "transactions") body.fiscalYearId = parseInt(fiscalYearId);

      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Import-Fehler"); return; }
      setResult(data);
      setStep(5);
    } catch {
      setError("Netzwerkfehler beim Import.");
    } finally {
      setLoading(false);
    }
  }

  const fields = IMPORT_FIELDS[importType];

  return (
    <div>
      {/* Fortschrittsanzeige */}
      <ul className="steps steps-horizontal w-full mb-8 text-base">
        {["Typ", "Datei", "Zuordnung", "Vorschau", "Import"].map((label, i) => (
          <li key={label} className={`step${step > i ? " step-primary" : ""}${step === i + 1 ? " step-primary font-bold" : ""}`}>
            {label}
          </li>
        ))}
      </ul>

      {error && (
        <div className="alert alert-error mb-4 text-base">{error}</div>
      )}

      {/* ── Schritt 1: Typ wählen ── */}
      {step === 1 && (
        <div>
          <h2 className="text-base font-bold mb-4">Schritt 1 — Was möchten Sie importieren?</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex flex-col gap-1 cursor-pointer border-2 rounded-lg p-4 transition-colors
                  ${importType === opt.value ? "border-primary bg-primary/5" : "border-base-300 hover:border-primary/50"}`}
              >
                <input
                  type="radio"
                  className="hidden"
                  name="importType"
                  value={opt.value}
                  checked={importType === opt.value}
                  onChange={() => { setImportType(opt.value as ImportType); reset(); setImportType(opt.value as ImportType); setStep(1); }}
                />
                <span className="text-base font-semibold">{opt.label}</span>
                <span className="text-base text-base-content/60">{opt.description}</span>
              </label>
            ))}
          </div>
          <button
            className="btn btn-primary text-base"
            onClick={async () => {
              if (importType === "transactions") await loadExtAccounts();
              setStep(2);
            }}
          >
            Weiter →
          </button>
        </div>
      )}

      {/* ── Schritt 2: CSV hochladen ── */}
      {step === 2 && (
        <div>
          <h2 className="text-base font-bold mb-2">Schritt 2 — CSV-Datei hochladen</h2>
          <p className="text-base text-base-content/60 mb-4">
            Trennzeichen wird automatisch erkannt (Semikolon oder Komma). Erste Zeile = Spaltenüberschriften.
            Kommentarzeilen mit # werden übersprungen.
          </p>

          <div className="form-control mb-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="file-input file-input-bordered text-base w-full max-w-md"
              onChange={handleFileChange}
            />
          </div>

          {importType === "transactions" && extAccounts.length > 0 && (
            <div className="alert alert-info mb-4 text-base">
              <div>
                <p className="font-semibold mb-1">ℹ️ Verfügbare externe Konten:</p>
                <ul className="list-none space-y-0.5 ml-2">
                  {extAccounts.map((a) => (
                    <li key={a.id}>
                      <span className="font-mono">{a.sortOrder}</span>
                      {" — "}
                      {a.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-base-content/70">
                  Im CSV kann der Name (<em>Barkasse</em>) oder die Nummer (<em>1</em>) verwendet werden.
                </p>
              </div>
            </div>
          )}

          {csvHeaders.length > 0 && (
            <div className="mb-4">
              <p className="text-base font-semibold mb-2">
                Erkannte Spalten ({csvHeaders.length}) — {csvRows.length} Datenzeilen:
              </p>
              <div className="overflow-x-auto border border-base-300 rounded-lg">
                <table className="table table-xs text-base">
                  <thead>
                    <tr>
                      {csvHeaders.map((h, i) => (
                        <th key={i} className="bg-base-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 3).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn btn-ghost text-base" onClick={() => setStep(1)}>← Zurück</button>
            <button
              className="btn btn-primary text-base"
              disabled={csvHeaders.length === 0}
              onClick={handleGoToMapping}
            >
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* ── Schritt 3: Spaltenzuordnung ── */}
      {step === 3 && (
        <div>
          <h2 className="text-base font-bold mb-2">Schritt 3 — Spalten zuordnen</h2>
          <p className="text-base text-base-content/60 mb-4">
            Ordnen Sie die CSV-Spalten den App-Feldern zu. Pflichtfelder sind markiert.
          </p>

          <div className="flex flex-col gap-3 mb-6">
            {fields.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <div className="w-52 shrink-0">
                  <span className="text-base font-medium">{f.label}</span>
                  {f.required && (
                    <span className="badge badge-error badge-xs ml-1">Pflicht</span>
                  )}
                </div>
                <select
                  className="select select-bordered text-base flex-1 max-w-xs"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                >
                  <option value="">– nicht zuordnen –</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {mapping[f.key] && (
                  <span className="text-base text-base-content/50 text-sm">
                    Beispiel: {csvRows[0]?.[csvHeaders.indexOf(mapping[f.key])] ?? "–"}
                  </span>
                )}
              </div>
            ))}
          </div>

          {importType === "transactions" && (
            <div className="flex items-center gap-3 mb-6 p-4 bg-base-200 rounded-lg">
              <label className="text-base font-medium w-52 shrink-0">
                Buchungsjahr
                <span className="badge badge-error badge-xs ml-1">Pflicht</span>
              </label>
              <select
                className="select select-bordered text-base"
                value={fiscalYearId}
                onChange={(e) => setFiscalYearId(e.target.value)}
              >
                <option value="">– Buchungsjahr wählen –</option>
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>{fy.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn btn-ghost text-base" onClick={() => setStep(2)}>← Zurück</button>
            <button
              className="btn btn-primary text-base"
              disabled={loading}
              onClick={handlePreview}
            >
              {loading ? "Lade…" : "Vorschau anzeigen →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Schritt 4: Vorschau ── */}
      {step === 4 && (
        <div>
          <h2 className="text-base font-bold mb-2">Schritt 4 — Vorschau</h2>
          <p className="text-base text-base-content/60 mb-4">
            Erste {Math.min(previewData.length, 10)} von {totalRows} Zeilen —
            {" "}{previewData.filter((r) => r.status === "ok").length} OK,
            {" "}{previewData.filter((r) => r.status === "warn").length} Warnungen,
            {" "}{previewData.filter((r) => r.status === "error").length} Fehler
          </p>

          <div className="flex flex-col gap-2 mb-6">
            {previewData.map((row, i) => (
              <div key={i} className={`rounded-lg p-3 border ${STATUS_BG[row.status]}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none mt-0.5">{STATUS_ICON[row.status]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1">
                      {Object.entries(row.data)
                        .filter(([, v]) => v)
                        .slice(0, 6)
                        .map(([k, v]) => (
                          <span key={k} className="text-base">
                            <span className="text-base-content/50">{k}:</span> {v}
                          </span>
                        ))}
                    </div>
                    {row.issues.length > 0 && (
                      <ul className="text-base text-warning-content/80 list-disc list-inside">
                        {row.issues.map((issue, j) => (
                          <li key={j}>{issue}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {previewData.some((r) => r.status === "error") && (
            <div className="alert alert-warning mb-4 text-base">
              Zeilen mit Fehlern werden beim Import übersprungen.
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn btn-ghost text-base" onClick={() => setStep(3)}>← Zurück</button>
            <button
              className="btn btn-primary text-base"
              disabled={loading || previewData.every((r) => r.status === "error")}
              onClick={handleExecute}
            >
              {loading ? "Importiere…" : `${totalRows} Zeilen importieren →`}
            </button>
          </div>
        </div>
      )}

      {/* ── Schritt 5: Ergebnis ── */}
      {step === 5 && result && (
        <div>
          <h2 className="text-base font-bold mb-4">Schritt 5 — Import abgeschlossen</h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="stat bg-success/10 rounded-lg p-4">
              <div className="stat-title text-base">Importiert</div>
              <div className="stat-value text-success">{result.imported}</div>
            </div>
            <div className="stat bg-warning/10 rounded-lg p-4">
              <div className="stat-title text-base">Übersprungen</div>
              <div className="stat-value text-warning">{result.skipped}</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-4">
              <div className="stat-title text-base">Gesamt</div>
              <div className="stat-value">{result.imported + result.skipped}</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-4">
              <p className="text-base font-semibold mb-2">Fehler / Übersprungen:</p>
              <div className="bg-base-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-base text-error">{e}</p>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-primary text-base" onClick={reset}>
            Weiteren Import starten
          </button>
        </div>
      )}
    </div>
  );
}
