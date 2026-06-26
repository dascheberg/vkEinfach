"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseAccountsCsv, accountsSeniorenclub, accountsAllgemein, type InternalAccountTemplate } from "@/lib/data/internalAccountsDefault";

interface Props {
  initialStep: number;
}

const STEPS = [
  "Admin-Account",
  "Buchungsjahr",
  "Externe Konten",
  "Interne Konten",
  "Fertig",
];

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: "Barkasse",
  bank: "Bankkonto",
  savings: "Sparkonto",
};

export default function SetupWizard({ initialStep }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const year = new Date().getFullYear();
  const [appName, setAppName] = useState("vkEinfach");
  const [clubName, setClubName] = useState("");
  const [clubSubtitle, setClubSubtitle] = useState("Vereinskasse");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");

  // Step 2 state
  const [fyLabel, setFyLabel] = useState(`${year}`);
  const [fyFrom, setFyFrom] = useState(`${year}-01-01`);
  const [fyTo, setFyTo] = useState(`${year}-12-31`);

  // Step 3 state
  const [accounts, setAccounts] = useState([{ name: "Barkasse", accountType: "cash" }]);

  // Step 4 state
  const [internalMode, setInternalMode] = useState<"seniorenclub" | "allgemein" | "csv" | "empty">("seniorenclub");
  const [csvPreview, setCsvPreview] = useState<InternalAccountTemplate[] | null>(null);
  const [csvError, setCsvError] = useState("");
  const [csvFileName, setCsvFileName] = useState("");

  // Step 5 summary state
  const [summary, setSummary] = useState({
    adminEmail: "",
    fyLabel: "",
    accountCount: 0,
    internalCount: 0,
    internalMode: "",
  });

  function clearError() {
    setError("");
  }

  // ── Step 1: Admin & App ────────────────────────────────────────────────────

  async function submitStep1() {
    clearError();
    if (!adminName || !adminEmail || !adminPassword) {
      setError("Alle Felder sind erforderlich");
      return;
    }
    if (adminPassword !== adminPasswordConfirm) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    if (adminPassword.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/setup/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appName, clubName, clubSubtitle, adminName, adminEmail, adminPassword }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Anlegen des Admin-Accounts");
      return;
    }
    setStep(2);
  }

  // ── Step 2: Buchungsjahr ───────────────────────────────────────────────────

  async function submitStep2() {
    clearError();
    if (!fyLabel || !fyFrom || !fyTo) {
      setError("Alle Felder sind erforderlich");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/setup/fiscal-year", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: fyLabel, dateFrom: fyFrom, dateTo: fyTo }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Anlegen des Buchungsjahres");
      return;
    }
    setStep(3);
  }

  // ── Step 3: Externe Konten ─────────────────────────────────────────────────

  function addAccount() {
    if (accounts.length < 5) {
      setAccounts([...accounts, { name: "", accountType: "bank" }]);
    }
  }

  function removeAccount(idx: number) {
    setAccounts(accounts.filter((_, i) => i !== idx));
  }

  function updateAccount(idx: number, field: "name" | "accountType", value: string) {
    setAccounts(accounts.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  }

  async function submitStep3() {
    clearError();
    const valid = accounts.filter((a) => a.name.trim());
    if (valid.length === 0) {
      setError("Mindestens ein Konto ist erforderlich");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/setup/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts: valid }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Anlegen der Konten");
      return;
    }
    setStep(4);
  }

  // ── Step 4: Interne Konten ─────────────────────────────────────────────────

  function handleCsvFile(file: File) {
    setCsvError(""); setCsvPreview(null); setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseAccountsCsv(text);
      if (parsed.length === 0) { setCsvError("Keine gültigen Konten in der Datei gefunden."); return; }
      setCsvPreview(parsed);
    };
    reader.readAsText(file, "utf-8");
  }

  async function submitStep4() {
    clearError();
    if (internalMode === "csv" && (!csvPreview || csvPreview.length === 0)) {
      setError("Bitte zuerst eine CSV-Datei laden und die Vorschau prüfen.");
      return;
    }
    setLoading(true);
    const body: Record<string, unknown> = { mode: internalMode };
    if (internalMode === "csv") body.accounts = csvPreview;
    const res = await fetch("/api/setup/internal-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Anlegen der internen Konten");
      return;
    }
    const data = await res.json();
    setSummary({
      adminEmail,
      fyLabel,
      accountCount: accounts.filter((a) => a.name.trim()).length,
      internalCount: data.count ?? 0,
      internalMode,
    });
    await fetch("/api/setup/complete", { method: "POST", headers: { "Content-Type": "application/json" } });
    setStep(5);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-lg">
      <div className="card-body">
        {/* Header */}
        <h1 className="text-xl font-bold text-center mb-2">Ersteinrichtung</h1>

        {/* Progress steps */}
        <ul className="steps steps-horizontal w-full mb-6 text-base">
          {STEPS.map((label, idx) => (
            <li
              key={label}
              className={`step ${idx + 1 <= step ? "step-primary" : ""}`}
            >
              {label}
            </li>
          ))}
        </ul>

        {error && (
          <div className="alert alert-error mb-4 text-base">
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-bold mb-4">Anwendung &amp; Admin-Account</h2>

            <div className="divider text-base">App &amp; Verein</div>

            <div className="form-control mb-3">
              <label className="label">
                <span className="label-text text-base">App-Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
              />
            </div>

            <div className="form-control mb-3">
              <label className="label">
                <span className="label-text text-base">Vereinsname</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                placeholder="z.B. Seniorenclub Schmalfeld e.V."
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-base">Untertitel</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                value={clubSubtitle}
                onChange={(e) => setClubSubtitle(e.target.value)}
              />
            </div>

            <div className="divider text-base">Kassenwart-Account</div>

            <div className="form-control mb-3">
              <label className="label">
                <span className="label-text text-base">Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
            </div>

            <div className="form-control mb-3">
              <label className="label">
                <span className="label-text text-base">E-Mail</span>
              </label>
              <input
                type="email"
                className="input input-bordered text-base"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>

            <div className="form-control mb-3">
              <label className="label">
                <span className="label-text text-base">Passwort</span>
              </label>
              <input
                type="password"
                className="input input-bordered text-base"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text text-base">Passwort wiederholen</span>
              </label>
              <input
                type="password"
                className="input input-bordered text-base"
                value={adminPasswordConfirm}
                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary text-base w-full"
              onClick={submitStep1}
              disabled={loading}
            >
              {loading ? "Bitte warten..." : "Weiter"}
            </button>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div>
            <h2 className="text-base font-bold mb-4">Erstes Buchungsjahr</h2>

            <div className="form-control mb-3">
              <label className="label">
                <span className="label-text text-base">Bezeichnung</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                placeholder="z.B. 2026"
                value={fyLabel}
                onChange={(e) => setFyLabel(e.target.value)}
              />
            </div>

            <div className="form-control mb-3">
              <label className="label">
                <span className="label-text text-base">Von</span>
              </label>
              <input
                type="date"
                className="input input-bordered text-base"
                value={fyFrom}
                onChange={(e) => setFyFrom(e.target.value)}
              />
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text text-base">Bis</span>
              </label>
              <input
                type="date"
                className="input input-bordered text-base"
                value={fyTo}
                onChange={(e) => setFyTo(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              {initialStep < 2 && (
                <button
                  className="btn btn-ghost text-base flex-1"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  Zurück
                </button>
              )}
              <button
                className="btn btn-primary text-base flex-1"
                onClick={submitStep2}
                disabled={loading}
              >
                {loading ? "Bitte warten..." : "Weiter"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-bold mb-4">Externe Konten</h2>
            <p className="text-base text-base-content/70 mb-4">
              Mindestens eine Barkasse ist erforderlich. Maximal 5 Konten.
            </p>

            <div className="flex flex-col gap-3 mb-4">
              {accounts.map((acc, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    className="input input-bordered text-base flex-1"
                    placeholder="Kontoname"
                    value={acc.name}
                    onChange={(e) => updateAccount(idx, "name", e.target.value)}
                  />
                  <select
                    className="select select-bordered text-base w-36"
                    value={acc.accountType}
                    onChange={(e) => updateAccount(idx, "accountType", e.target.value)}
                  >
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  {accounts.length > 1 && (
                    <button
                      className="btn btn-ghost btn-square btn-sm"
                      onClick={() => removeAccount(idx)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {accounts.length < 5 && (
              <button
                className="btn btn-ghost btn-sm text-base mb-6"
                onClick={addAccount}
              >
                + Konto hinzufügen
              </button>
            )}

            <div className="flex gap-2">
              <button
                className="btn btn-ghost text-base flex-1"
                onClick={() => { clearError(); setStep(2); }}
                disabled={loading}
              >
                Zurück
              </button>
              <button
                className="btn btn-primary text-base flex-1"
                onClick={submitStep3}
                disabled={loading}
              >
                {loading ? "Bitte warten..." : "Weiter"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4 ── */}
        {step === 4 && (
          <div>
            <h2 className="text-base font-bold mb-4">Interne Konten</h2>
            <p className="text-base text-base-content/70 mb-4">
              Wählen Sie eine Startkonfiguration oder importieren Sie Ihre eigenen Konten als CSV.
            </p>

            <div className="flex flex-col gap-3 mb-4">
              {/* Option A: Seniorenclub */}
              <label className={`flex items-start gap-3 cursor-pointer p-3 border rounded-lg transition-colors
                ${internalMode === "seniorenclub" ? "border-primary bg-primary/10" : "border-base-300 hover:bg-base-200"}`}>
                <input type="radio" className="radio radio-primary mt-1" checked={internalMode === "seniorenclub"} onChange={() => { setInternalMode("seniorenclub"); setCsvPreview(null); }} />
                <div>
                  <p className="text-base font-medium">Seniorenclub</p>
                  <p className="text-base text-base-content/60">
                    {accountsSeniorenclub.length} Konten — Ausflüge, Reisen, Kaffeenachmittage, Vereinsleben
                  </p>
                </div>
              </label>

              {/* Option B: Allgemein */}
              <label className={`flex items-start gap-3 cursor-pointer p-3 border rounded-lg transition-colors
                ${internalMode === "allgemein" ? "border-primary bg-primary/10" : "border-base-300 hover:bg-base-200"}`}>
                <input type="radio" className="radio radio-primary mt-1" checked={internalMode === "allgemein"} onChange={() => { setInternalMode("allgemein"); setCsvPreview(null); }} />
                <div>
                  <p className="text-base font-medium">Allgemein klein</p>
                  <p className="text-base text-base-content/60">
                    {accountsAllgemein.length} Konten — generisch für beliebige Vereine (Sport, Kultur, Förderverein …)
                  </p>
                </div>
              </label>

              {/* Option C: CSV */}
              <label className={`flex items-start gap-3 cursor-pointer p-3 border rounded-lg transition-colors
                ${internalMode === "csv" ? "border-primary bg-primary/10" : "border-base-300 hover:bg-base-200"}`}>
                <input type="radio" className="radio radio-primary mt-1" checked={internalMode === "csv"} onChange={() => setInternalMode("csv")} />
                <div className="flex-1">
                  <p className="text-base font-medium">CSV-Import</p>
                  <p className="text-base text-base-content/60 mb-2">Eigener Kontenrahmen — Format: nummer;bezeichnung;typ</p>
                  {internalMode === "csv" && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="file-input file-input-bordered file-input-sm text-base w-full"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }}
                      />
                      {csvFileName && !csvError && !csvPreview && (
                        <p className="text-base text-base-content/60 mt-1">{csvFileName} — wird gelesen…</p>
                      )}
                      {csvError && <p className="text-base text-error mt-1">{csvError}</p>}
                    </div>
                  )}
                </div>
              </label>

              {/* Option D: Leer */}
              <label className={`flex items-start gap-3 cursor-pointer p-3 border rounded-lg transition-colors
                ${internalMode === "empty" ? "border-primary bg-primary/10" : "border-base-300 hover:bg-base-200"}`}>
                <input type="radio" className="radio radio-primary mt-1" checked={internalMode === "empty"} onChange={() => { setInternalMode("empty"); setCsvPreview(null); }} />
                <div>
                  <p className="text-base font-medium">Leer starten</p>
                  <p className="text-base text-base-content/60">Konten später manuell anlegen</p>
                </div>
              </label>
            </div>

            {/* Vorschau */}
            {(internalMode === "seniorenclub" || internalMode === "allgemein" || (internalMode === "csv" && csvPreview)) && (
              <div className="mb-4">
                <p className="text-base font-medium mb-2">
                  Vorschau —{" "}
                  {internalMode === "seniorenclub" ? `${accountsSeniorenclub.length} Konten` :
                   internalMode === "allgemein" ? `${accountsAllgemein.length} Konten` :
                   `${csvPreview?.length} Konten aus ${csvFileName}`}
                </p>
                <div className="overflow-y-auto max-h-48 border border-base-300 rounded-lg">
                  <table className="table table-xs text-base w-full">
                    <thead className="sticky top-0 bg-base-100">
                      <tr><th>Nr.</th><th>Bezeichnung</th><th>Typ</th></tr>
                    </thead>
                    <tbody>
                      {(internalMode === "seniorenclub" ? accountsSeniorenclub :
                        internalMode === "allgemein" ? accountsAllgemein :
                        csvPreview ?? []).map((acc) => (
                        <tr key={acc.number}>
                          <td>{acc.number}</td>
                          <td>{acc.name}</td>
                          <td className="text-base-content/60">{acc.accountKind}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-ghost text-base flex-1" onClick={() => { clearError(); setStep(3); }} disabled={loading}>Zurück</button>
              <button className="btn btn-primary text-base flex-1" onClick={submitStep4} disabled={loading}>
                {loading ? "Bitte warten..." : "Einrichtung abschließen"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5 ── */}
        {step === 5 && (
          <div className="text-center">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-base font-bold mb-2">Einrichtung abgeschlossen!</h2>
            <p className="text-base text-base-content/70 mb-6">
              Die Anwendung ist bereit.
            </p>

            <div className="text-left bg-base-200 rounded-lg p-4 mb-6 space-y-2 text-base">
              <p><span className="font-medium">Admin-Account:</span> {summary.adminEmail}</p>
              <p><span className="font-medium">Buchungsjahr:</span> {summary.fyLabel}</p>
              <p>
                <span className="font-medium">Externe Konten:</span>{" "}
                {summary.accountCount} angelegt
              </p>
              <p>
                <span className="font-medium">Interne Konten:</span>{" "}
                {summary.internalCount > 0 ? `${summary.internalCount} importiert (${summary.internalMode})` : "Leer — manuell anlegen"}
              </p>
            </div>

            <button
              className="btn btn-primary text-base w-full"
              onClick={() => router.push("/login")}
            >
              Zur Anmeldung
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
