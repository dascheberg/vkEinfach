"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { ROLE_LABELS } from "@/components/ui/Navigation";

const FUNCTION_LABELS: Record<string, string> = {
  M:    "Mitglied",
  "1.V": "1. Vorsitzende(r)",
  "2.V": "2. Vorsitzende(r)",
  KW:   "Kassenwart",
  SW:   "Schriftwart",
  KS:   "Kassen- und Schriftwart",
  B1:   "1. Beisitzer",
  B2:   "2. Beisitzer",
  B3:   "3. Beisitzer",
  KP1:  "1. Kassenprüfer",
  KP2:  "2. Kassenprüfer",
};

interface ProfileData {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  function: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data: ProfileData) => {
        setProfile(data);
        setName(data.name);
        setEmail(data.email?.endsWith("@intern.local") ? "" : (data.email ?? ""));
        setUsername(data.username ?? "");
      });
  }, []);

  async function handleSaveProfile() {
    setSaving(true); setSaveError(""); setSaved(false);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: email || undefined, username: username || undefined }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setSaveError(data.error ?? "Fehler"); return; }
    setProfile(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleChangePassword() {
    if (newPassword !== newPassword2) { setPwError("Passwörter stimmen nicht überein"); return; }
    if (newPassword.length < 8) { setPwError("Mindestens 8 Zeichen"); return; }
    setPwSaving(true); setPwError(""); setPwSaved(false);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setPwSaving(false);
    if (!res.ok) { setPwError(data.error ?? "Fehler"); return; }
    setPwSaved(true);
    setCurrentPassword(""); setNewPassword(""); setNewPassword2("");
    setTimeout(() => setPwSaved(false), 3000);
  }

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  if (!profile) return <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md" /></div>;

  const funcs = (profile.function ?? "M").split(",").map((s) => s.trim()).filter(Boolean);
  const funcLabels = funcs.map((f) => FUNCTION_LABELS[f] ?? f).join(", ");

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Mein Profil</h1>

      {/* Read-only info */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-4">Rolle &amp; Funktion</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-base text-base-content/60">Rolle</p>
              <p className="text-base font-medium">{ROLE_LABELS[profile.role] ?? profile.role}</p>
            </div>
            <div>
              <p className="text-base text-base-content/60">Vereinsfunktion</p>
              <p className="text-base font-medium">{funcLabels}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Editable info */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-4">Kontodaten</h2>
          {saveError && <div className="alert alert-error mb-3 text-base">{saveError}</div>}

          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Name</span></label>
            <input type="text" className="input input-bordered text-base" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">E-Mail <span className="text-base-content/50">(optional)</span></span></label>
            <input type="email" className="input input-bordered text-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.de" />
          </div>
          <div className="form-control mb-4">
            <label className="label"><span className="label-text text-base">Benutzername <span className="text-base-content/50">(optional)</span></span></label>
            <input type="text" className="input input-bordered text-base" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="z.B. muster.hans" autoCapitalize="none" />
          </div>

          <button className="btn btn-primary text-base" disabled={saving} onClick={handleSaveProfile}>
            {saving ? "Speichern..." : saved ? "✓ Gespeichert" : "Speichern"}
          </button>
        </div>
      </div>

      {/* Password change */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="text-base font-bold mb-4">Passwort ändern</h2>
          {pwError && <div className="alert alert-error mb-3 text-base">{pwError}</div>}
          {pwSaved && <div className="alert alert-success mb-3 text-base">Passwort erfolgreich geändert.</div>}

          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Aktuelles Passwort</span></label>
            <input type="password" className="input input-bordered text-base" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Neues Passwort</span></label>
            <input type="password" className="input input-bordered text-base" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="form-control mb-4">
            <label className="label"><span className="label-text text-base">Neues Passwort wiederholen</span></label>
            <input type="password" className="input input-bordered text-base" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} />
          </div>

          <button className="btn btn-warning text-base" disabled={pwSaving || !currentPassword || !newPassword} onClick={handleChangePassword}>
            {pwSaving ? "Ändern..." : "Passwort ändern"}
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="text-base font-bold mb-4">Abmelden</h2>
          <button className="btn btn-ghost btn-sm text-base w-fit" onClick={handleLogout}>Abmelden</button>
        </div>
      </div>
    </div>
  );
}
