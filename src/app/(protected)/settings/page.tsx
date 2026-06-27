"use client";

import { useSettings } from "@/context/SettingsContext";
import { authClient } from "@/lib/auth/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { settings, reload } = useSettings();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  useEffect(() => {
    // Session noch nicht geladen → warten
    if (session === undefined) return;
    if (role && role !== "admin") router.replace("/profile");
  }, [session, role, router]);
  const [appName, setAppName] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubSubtitle, setClubSubtitle] = useState("");
  const [receiptDefaultPath, setReceiptDefaultPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingPath, setSavingPath] = useState(false);
  const [savedPath, setSavedPath] = useState(false);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpPasswordChanged, setSmtpPasswordChanged] = useState(false);
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savedSmtp, setSavedSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setAppName(settings.appName);
    setClubName(settings.clubName);
    setClubSubtitle(settings.clubSubtitle);
    setReceiptDefaultPath(settings.receiptDefaultPath);
    setSmtpHost(settings.smtpHost);
    setSmtpPort(settings.smtpPort || "587");
    setSmtpUser(settings.smtpUser);
    setSmtpFrom(settings.smtpFrom);
    setSmtpFromName(settings.smtpFromName);
    setSmtpPassword("");
    setSmtpPasswordChanged(false);
  }, [settings]);

  async function saveSetting(key: string, value: string) {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }

  async function handleSaveNames() {
    setSaving(true);
    await saveSetting("app_name", appName);
    await saveSetting("club_name", clubName);
    await saveSetting("club_subtitle", clubSubtitle);
    await reload();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveReceiptPath() {
    setSavingPath(true);
    await saveSetting("receipt_default_path", receiptDefaultPath);
    await reload();
    setSavingPath(false);
    setSavedPath(true);
    setTimeout(() => setSavedPath(false), 2000);
  }

  async function toggleModule(key: string, current: boolean) {
    await saveSetting(key, (!current).toString());
    await reload();
  }

  async function handleSaveSmtp() {
    setSavingSmtp(true);
    setSmtpTestResult(null);
    await saveSetting("smtp_host", smtpHost);
    await saveSetting("smtp_port", smtpPort);
    await saveSetting("smtp_user", smtpUser);
    await saveSetting("smtp_from", smtpFrom);
    await saveSetting("smtp_from_name", smtpFromName);
    if (smtpPasswordChanged && smtpPassword) {
      const res = await fetch("/api/settings/smtp-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: smtpPassword }),
      });
      if (!res.ok) {
        setSavingSmtp(false);
        setSmtpTestResult({ ok: false, message: "Fehler beim Speichern des Passworts." });
        return;
      }
    }
    await reload();
    setSavingSmtp(false);
    setSavedSmtp(true);
    setSmtpPassword("");
    setSmtpPasswordChanged(false);
    setTimeout(() => setSavedSmtp(false), 2000);
  }

  async function handleTestSmtp() {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    const res = await fetch("/api/settings/test-smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setTestingSmtp(false);
    if (res.ok) {
      setSmtpTestResult({ ok: true, message: "Test-E-Mail erfolgreich gesendet." });
    } else {
      setSmtpTestResult({ ok: false, message: data.error ?? "Verbindung fehlgeschlagen." });
    }
  }

  const modules = [
    { key: "module_members",      label: "Mitgliederverwaltung", value: settings.features.members },
    { key: "module_guests",       label: "Gäste",                value: settings.features.guests },
    { key: "module_accounts",     label: "Konten",               value: settings.features.accounts },
    { key: "module_transactions", label: "Buchungen",            value: settings.features.transactions },
    { key: "module_travel",       label: "Reiseverwaltung",      value: settings.features.travel },
    { key: "module_reports",      label: "Auswertungen",         value: settings.features.reports },
    { key: "module_receipts",     label: "Scan-Belege",          value: settings.features.receipts },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Einstellungen</h1>

      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-4">Anwendung & Verein</h2>

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

          <button
            className="btn btn-primary text-base"
            onClick={handleSaveNames}
            disabled={saving}
          >
            {saving ? "Speichern..." : saved ? "✓ Gespeichert" : "Speichern"}
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="card bg-base-100 shadow mb-6">
          <div className="card-body">
            <h2 className="text-base font-bold mb-4">Module</h2>
            <div className="flex flex-col gap-3">
              {modules.map((mod) => (
                <div key={mod.key} className="flex items-center justify-between">
                  <span className="text-base">{mod.label}</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={mod.value}
                    onChange={() => toggleModule(mod.key, mod.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-4">Scan-Belege</h2>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text text-base">Standardverzeichnis (lokal)</span>
            </label>
            <input
              type="text"
              className="input input-bordered text-base font-mono"
              placeholder="z.B. C:\Belege\"
              value={receiptDefaultPath}
              onChange={(e) => setReceiptDefaultPath(e.target.value)}
            />
            <label className="label">
              <span className="label-text-alt text-base text-base-content/60">
                Wird in der Belegerfassung als Standardpfad vorausgefüllt (nur bei Speicherort&nbsp;„Lokal").
              </span>
            </label>
          </div>
          <button
            className="btn btn-primary text-base"
            onClick={handleSaveReceiptPath}
            disabled={savingPath}
          >
            {savingPath ? "Speichern..." : savedPath ? "✓ Gespeichert" : "Speichern"}
          </button>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="text-base font-bold mb-1">E-Mail Konfiguration</h2>
          <p className="text-base text-base-content/60 mb-4">
            SMTP-Zugangsdaten für den E-Mail-Versand (Passwort-Reset, Benachrichtigungen).
          </p>

          {smtpTestResult && (
            <div className={`alert mb-4 text-base ${smtpTestResult.ok ? "alert-success" : "alert-error"}`}>
              {smtpTestResult.message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">SMTP-Server</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                placeholder="smtp.strato.de"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Port</span>
              </label>
              <div className="flex gap-2 items-center mt-1">
                {["587", "465", "25"].map((p) => (
                  <label key={p} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      className="radio radio-primary radio-sm"
                      checked={smtpPort === p}
                      onChange={() => setSmtpPort(p)}
                    />
                    <span className="text-base">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="form-control mb-3">
            <label className="label">
              <span className="label-text text-base">Benutzername (E-Mail-Adresse)</span>
            </label>
            <input
              type="text"
              className="input input-bordered text-base"
              placeholder="kasse@meinverein.de"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
            />
          </div>

          <div className="form-control mb-3">
            <label className="label">
              <span className="label-text text-base">Passwort</span>
            </label>
            <input
              type="password"
              className="input input-bordered text-base"
              placeholder={settings.smtpConfigured ? "••••••••  (bereits gesetzt — leer lassen zum Beibehalten)" : "Passwort eingeben"}
              value={smtpPassword}
              onChange={(e) => { setSmtpPassword(e.target.value); setSmtpPasswordChanged(true); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Absender-Adresse</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                placeholder="kasse@meinverein.de"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Absender-Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                placeholder="Kassenwart Musterverein"
                value={smtpFromName}
                onChange={(e) => setSmtpFromName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="btn btn-primary text-base"
              onClick={handleSaveSmtp}
              disabled={savingSmtp}
            >
              {savingSmtp ? "Speichern..." : savedSmtp ? "✓ Gespeichert" : "Speichern"}
            </button>
            <button
              className="btn btn-outline text-base"
              onClick={handleTestSmtp}
              disabled={testingSmtp || !settings.smtpConfigured}
              title={!settings.smtpConfigured ? "Bitte zuerst SMTP-Daten speichern" : ""}
            >
              {testingSmtp ? "Sende..." : "Verbindung testen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
