"use client";

import { useSettings } from "@/context/SettingsContext";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { settings, reload } = useSettings();
  const [appName, setAppName] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubSubtitle, setClubSubtitle] = useState("");
  const [receiptDefaultPath, setReceiptDefaultPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingPath, setSavingPath] = useState(false);
  const [savedPath, setSavedPath] = useState(false);

  useEffect(() => {
    setAppName(settings.appName);
    setClubName(settings.clubName);
    setClubSubtitle(settings.clubSubtitle);
    setReceiptDefaultPath(settings.receiptDefaultPath);
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

      <div className="card bg-base-100 shadow">
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
    </div>
  );
}
