"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";

// ── Spalten-Erkennung ──────────────────────────────────────────────────────────

function norm(s: string) {
  return String(s)
    .toLowerCase().trim()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

const MEMBER_COLS: Record<string, string> = {
  nachname: "lastName", familienname: "lastName", lastname: "lastName",
  vorname: "firstName", firstname: "firstName",
  strasse: "street", strase: "street", street: "street", adresse: "street",
  plz: "zip", postleitzahl: "zip", zip: "zip",
  ort: "city", stadt: "city", city: "city",
  geburtsdatum: "birthDate", geburtstag: "birthDate", birthdate: "birthDate", geboren: "birthDate",
  telefon: "phoneLandline", tel: "phoneLandline", festnetz: "phoneLandline", phone: "phoneLandline",
  mobil: "phoneMobile", handy: "phoneMobile", mobile: "phoneMobile", mobilnummer: "phoneMobile",
  email: "email", mail: "email", emailadresse: "email",
  funktion: "function", function: "function", rolle: "function",
  eingetreten: "joinedAt", beitrittsdatum: "joinedAt", joined: "joinedAt",
  ausgetreten: "leftAt", austrittsdatum: "leftAt", left: "leftAt",
  aktiv: "isActive", active: "isActive",
  beitragbezahlt: "feePaidCurrentYear", bezahlt: "feePaidCurrentYear", feepaid: "feePaidCurrentYear",
  bemerkungen: "notes", notizen: "notes", notes: "notes",
};

const GUEST_COLS: Record<string, string> = {
  nachname: "lastName", familienname: "lastName", lastname: "lastName",
  vorname: "firstName", firstname: "firstName",
  kontakt: "contactInfo", kontaktinfo: "contactInfo", contact: "contactInfo",
  bemerkungen: "notes", notizen: "notes", notes: "notes",
};

function toBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return ["ja", "yes", "true", "1", "x", "wahr"].includes(s);
}

function toDate(v: unknown): string | null {
  if (!v) return null;
  // Excel serial number
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return null;
  }
  const s = String(v).trim();
  if (!s) return null;
  // DD.MM.YYYY
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

// ── Typen ──────────────────────────────────────────────────────────────────────

type ImportType = "members" | "guests";

interface ParsedRow {
  [key: string]: unknown;
}

interface Props {
  type: ImportType;
  onSuccess?: () => void;
}

const MEMBER_PREVIEW_COLS = ["lastName", "firstName", "birthDate", "city", "email", "joinedAt"];
const GUEST_PREVIEW_COLS  = ["lastName", "firstName", "contactInfo", "notes"];

const COL_LABELS: Record<string, string> = {
  lastName: "Nachname", firstName: "Vorname", birthDate: "Geb.-Datum",
  city: "Ort", email: "E-Mail", joinedAt: "Eingetreten",
  contactInfo: "Kontakt", notes: "Bemerkungen",
};

const FORMAT_HINT_MEMBERS = `Spaltenköpfe (Groß/Kleinschreibung egal):
Nachname*, Vorname*, Straße, PLZ, Ort, Geburtsdatum,
Telefon, Mobil, E-Mail, Funktion (M/1.V/2.V/KW/SW/KS/B1/B2/B3/KP1/KP2),
Eingetreten, Ausgetreten, Aktiv (ja/nein), Beitrag bezahlt (ja/nein), Bemerkungen
* Pflichtfelder · Datum: TT.MM.JJJJ oder JJJJ-MM-TT`;

const FORMAT_HINT_GUESTS = `Spaltenköpfe (Groß/Kleinschreibung egal):
Nachname*, Vorname*, Kontakt, Bemerkungen
* Pflichtfelder`;

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export default function ImportModal({ type, onSuccess }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<"idle" | "preview" | "result">("idle");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const colMap = type === "members" ? MEMBER_COLS : GUEST_COLS;
  const previewCols = type === "members" ? MEMBER_PREVIEW_COLS : GUEST_PREVIEW_COLS;

  function open() {
    setStep("idle"); setFileName(""); setRows([]); setTotalRows(0); setParseError(""); setResult(null);
    dialogRef.current?.showModal();
  }

  function parseFile(file: File) {
    setParseError(""); setRows([]); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (raw.length === 0) { setParseError("Die Datei enthält keine Daten."); return; }

        // Map raw column names to our field names
        const firstRow = raw[0];
        const headerMap: Record<string, string> = {};
        for (const key of Object.keys(firstRow)) {
          const mapped = colMap[norm(key)];
          if (mapped) headerMap[key] = mapped;
        }

        if (!Object.values(headerMap).includes("lastName") || !Object.values(headerMap).includes("firstName")) {
          setParseError(`Spalten "Nachname" und "Vorname" nicht gefunden. Gefundene Spalten: ${Object.keys(firstRow).join(", ")}`);
          return;
        }

        const parsed: ParsedRow[] = raw.map((r) => {
          const row: ParsedRow = {};
          for (const [origKey, fieldKey] of Object.entries(headerMap)) {
            const val = r[origKey];
            if (fieldKey === "birthDate" || fieldKey === "joinedAt" || fieldKey === "leftAt") {
              row[fieldKey] = toDate(val);
            } else if (fieldKey === "isActive" || fieldKey === "feePaidCurrentYear") {
              row[fieldKey] = val === "" ? (fieldKey === "isActive") : toBoolean(val);
            } else {
              row[fieldKey] = val === "" ? undefined : String(val).trim();
            }
          }
          // Defaults
          if (type === "members") {
            if (row.isActive === undefined) row.isActive = true;
            if (row.feePaidCurrentYear === undefined) row.feePaidCurrentYear = false;
          }
          return row;
        });

        setTotalRows(parsed.length);
        setRows(parsed);
        setStep("preview");
      } catch (err) {
        setParseError(`Fehler beim Lesen der Datei: ${err}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    setImporting(true);
    const url = type === "members" ? "/api/members/import" : "/api/guests/import";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setImporting(false);
    setResult(data);
    setStep("result");
    if (res.ok && data.imported > 0) onSuccess?.();
  }

  const validRows = rows.filter((r) => r.lastName && r.firstName);
  const invalidRows = totalRows - validRows.length;

  return (
    <>
      <button className="btn btn-ghost text-base" onClick={open}>
        Importieren
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-3xl">
          <h3 className="font-bold text-xl mb-4">
            {type === "members" ? "Mitglieder importieren" : "Gäste importieren"}
          </h3>

          {/* ── idle: Datei wählen ── */}
          {step === "idle" && (
            <div>
              <div className="collapse collapse-arrow border border-base-300 mb-4">
                <input type="checkbox" />
                <div className="collapse-title text-base font-medium">Erwartetes Format anzeigen</div>
                <div className="collapse-content">
                  <pre className="text-base text-base-content/70 whitespace-pre-wrap">
                    {type === "members" ? FORMAT_HINT_MEMBERS : FORMAT_HINT_GUESTS}
                  </pre>
                </div>
              </div>
              {parseError && <div className="alert alert-error mb-4 text-base">{parseError}</div>}
              <div className="form-control">
                <label className="label"><span className="label-text text-base">Excel (.xlsx) oder CSV (.csv) Datei wählen</span></label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="file-input file-input-bordered text-base w-full"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
                />
              </div>
            </div>
          )}

          {/* ── preview: Vorschau ── */}
          {step === "preview" && (
            <div>
              <div className="flex gap-4 mb-4 text-base">
                <span className="font-medium">{fileName}</span>
                <span className="badge badge-success">{validRows.length} gültig</span>
                {invalidRows > 0 && <span className="badge badge-warning">{invalidRows} ohne Nachname/Vorname</span>}
              </div>

              <div className="overflow-auto max-h-64 border border-base-300 rounded-lg mb-4">
                <table className="table table-xs text-base w-full">
                  <thead className="sticky top-0 bg-base-100">
                    <tr>
                      <th>#</th>
                      {previewCols.map((c) => <th key={c}>{COL_LABELS[c] ?? c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className={(!row.lastName || !row.firstName) ? "bg-error/10" : ""}>
                        <td className="text-base-content/40">{i + 1}</td>
                        {previewCols.map((c) => (
                          <td key={c}>{row[c] != null ? String(row[c]) : <span className="text-base-content/25">–</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <p className="text-base text-base-content/50 p-2">… und {rows.length - 50} weitere Zeilen</p>
                )}
              </div>

              {invalidRows > 0 && (
                <div className="alert alert-warning mb-4 text-base">
                  {invalidRows} Zeile{invalidRows !== 1 ? "n" : ""} ohne Nachname/Vorname werden übersprungen.
                </div>
              )}
            </div>
          )}

          {/* ── result: Ergebnis ── */}
          {step === "result" && result && (
            <div>
              <div className="flex gap-4 mb-4">
                <div className="stat bg-success/10 rounded-box p-4 flex-1 text-center">
                  <div className="stat-value text-xl text-success">{result.imported}</div>
                  <div className="stat-title text-base">Importiert</div>
                </div>
                <div className="stat bg-base-200 rounded-box p-4 flex-1 text-center">
                  <div className="stat-value text-xl">{result.skipped}</div>
                  <div className="stat-title text-base">Übersprungen</div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="collapse collapse-arrow border border-warning mb-4">
                  <input type="checkbox" />
                  <div className="collapse-title text-base font-medium text-warning">
                    {result.errors.length} Fehler anzeigen
                  </div>
                  <div className="collapse-content">
                    <ul className="list-disc list-inside text-base text-base-content/70 space-y-1">
                      {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="modal-action">
            {step !== "result" && (
              <form method="dialog">
                <button className="btn btn-ghost text-base">Abbrechen</button>
              </form>
            )}
            {step === "idle" && (
              <button className="btn btn-ghost text-base" disabled>
                Weiter
              </button>
            )}
            {step === "preview" && (
              <>
                <button className="btn btn-ghost text-base" onClick={() => { setStep("idle"); setRows([]); }}>
                  Andere Datei
                </button>
                <button
                  className="btn btn-primary text-base"
                  disabled={importing || validRows.length === 0}
                  onClick={handleImport}
                >
                  {importing ? "Importieren..." : `${validRows.length} Datensätze importieren`}
                </button>
              </>
            )}
            {step === "result" && (
              <form method="dialog">
                <button className="btn btn-primary text-base">Schließen</button>
              </form>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>
    </>
  );
}
