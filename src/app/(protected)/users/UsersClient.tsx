"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface UserRow {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  function: string | null;
  banned: boolean;
  approved: boolean;
  createdAt: string;
}

interface Props { currentUserId: string; }

export const ROLE_LABELS: Record<string, string> = {
  admin:    "Administrator",
  finanzen: "Finanzen",
  vorstand: "Vorstand",
  auditor:  "Kassenprüfer",
  member:   "Mitglied",
};

const ROLES = ["admin", "finanzen", "vorstand", "auditor", "member"];

const FUNCTIONS = [
  { key: "1.V",  label: "1. Vorsitzende(r)" },
  { key: "2.V",  label: "2. Vorsitzende(r)" },
  { key: "KW",   label: "Kassenwart" },
  { key: "SW",   label: "Schriftwart" },
  { key: "KS",   label: "Kassen- und Schriftwart" },
  { key: "B1",   label: "1. Beisitzer" },
  { key: "B2",   label: "2. Beisitzer" },
  { key: "B3",   label: "3. Beisitzer" },
  { key: "KP1",  label: "1. Kassenprüfer" },
  { key: "KP2",  label: "2. Kassenprüfer" },
];

function parseFunctions(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean).filter((s) => s !== "M");
}

function serializeFunctions(selected: string[]): string {
  return selected.length > 0 ? selected.join(",") : "M";
}

function FunctionCheckboxes({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }
  return (
    <div className="grid grid-cols-2 gap-1 mt-1">
      {FUNCTIONS.map((f) => (
        <label key={f.key} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={value.includes(f.key)}
            onChange={() => toggle(f.key)}
          />
          <span className="text-base">{f.key} — {f.label}</span>
        </label>
      ))}
    </div>
  );
}

function isPlaceholderEmail(email: string) {
  return email.endsWith("@intern.local");
}

export default function UsersClient({ currentUserId }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create modal
  const createRef = useRef<HTMLDialogElement>(null);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cUsername, setCUsername] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cRole, setCRole] = useState("member");
  const [cFunctions, setCFunctions] = useState<string[]>([]);
  const [cApproved, setCApproved] = useState(true);
  const [cLoading, setCLoading] = useState(false);

  // Edit modal
  const editRef = useRef<HTMLDialogElement>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [eName, setEName] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [eUsername, setEUsername] = useState("");
  const [eFunctions, setEFunctions] = useState<string[]>([]);
  const [eLoading, setELoading] = useState(false);

  // Reset password modal
  const resetRef = useRef<HTMLDialogElement>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState("");

  // Search / sort / filter
  const [searchQuery, setSearchQuery]   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "approved" | "role" | "createdAt">("name");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc");
  const [filter,    setFilter]    = useState<"all" | "approved" | "locked">("all");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function handleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  const displayedUsers = useMemo(() => {
    let result = [...users];

    if (filter === "approved") result = result.filter((u) => u.approved && !u.banned);
    if (filter === "locked")   result = result.filter((u) => u.banned || !u.approved);

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter((u) => u.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":      cmp = a.name.localeCompare(b.name, "de"); break;
        case "approved":  cmp = Number(b.approved) - Number(a.approved); break;
        case "role":      cmp = (ROLE_LABELS[a.role] ?? "").localeCompare(ROLE_LABELS[b.role] ?? "", "de"); break;
        case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [users, debouncedSearch, filter, sortField, sortDir]);

  function sortIcon(field: typeof sortField) {
    if (sortField !== field) return <span className="opacity-30 ml-1">⇅</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  async function load() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function put(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Fehler"); return false; }
    return true;
  }

  async function handleRoleChange(id: string, role: string) {
    setError(""); setSuccess("");
    if (await put(id, { role })) {
      setSuccess("Rolle geändert");
      await load(); router.refresh();
    }
  }

  async function handleApprove(id: string, approved: boolean) {
    setError(""); setSuccess("");
    if (await put(id, { approved })) {
      setSuccess(approved ? "Benutzer freigeschaltet" : "Freigabe entzogen");
      await load(); router.refresh();
    }
  }

  async function handleBan(id: string, banned: boolean) {
    setError(""); setSuccess("");
    if (await put(id, { banned })) {
      setSuccess(banned ? "Benutzer gesperrt" : "Sperre aufgehoben");
      await load(); router.refresh();
    }
  }

  function openCreate() {
    setCName(""); setCEmail(""); setCUsername(""); setCPassword("");
    setCRole("member"); setCFunctions([]); setCApproved(true); setError("");
    createRef.current?.showModal();
  }

  async function handleCreate() {
    if (!cName || !cPassword || (!cEmail && !cUsername)) {
      setError("Name, Passwort und (E-Mail oder Benutzername) sind erforderlich");
      return;
    }
    setCLoading(true); setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cName,
        email: cEmail || undefined,
        username: cUsername || undefined,
        password: cPassword,
        role: cRole,
        function: serializeFunctions(cFunctions),
        approved: cApproved,
      }),
    });
    const data = await res.json();
    setCLoading(false);
    if (!res.ok) { setError(data.error ?? "Fehler"); return; }
    createRef.current?.close();
    setSuccess("Benutzer angelegt");
    await load(); router.refresh();
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setEName(u.name);
    setEEmail(isPlaceholderEmail(u.email) ? "" : u.email);
    setEUsername(u.username ?? "");
    setEFunctions(parseFunctions(u.function));
    setError("");
    editRef.current?.showModal();
  }

  async function handleEdit() {
    if (!editUser) return;
    setELoading(true); setError("");
    const ok = await put(editUser.id, {
      name: eName,
      email: eEmail || undefined,
      username: eUsername || undefined,
      function: serializeFunctions(eFunctions),
    });
    setELoading(false);
    if (ok) { editRef.current?.close(); setSuccess("Gespeichert"); await load(); router.refresh(); }
  }

  function openReset(u: UserRow) {
    setResetUser(u); setResetResult(""); setError("");
    resetRef.current?.showModal();
  }

  async function handleReset() {
    if (!resetUser) return;
    setResetLoading(true); setError("");
    const res = await fetch(`/api/users/${resetUser.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setResetLoading(false);
    if (!res.ok) { setError(data.error ?? "Fehler"); return; }
    setResetResult(data.tempPassword ?? "OK");
  }

  if (loading) return <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md" /></div>;

  return (
    <>
      {error && <div className="alert alert-error mb-4 text-base"><span>{error}</span><button className="btn btn-ghost btn-xs ml-auto" onClick={() => setError("")}>✕</button></div>}
      {success && <div className="alert alert-success mb-4 text-base"><span>{success}</span><button className="btn btn-ghost btn-xs ml-auto" onClick={() => setSuccess("")}>✕</button></div>}

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <input
          type="search"
          className="input input-bordered text-base w-64"
          placeholder="Name suchen…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="btn btn-primary text-base" onClick={openCreate}>Neuer Benutzer</button>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Filter-Chips */}
        <div className="join mr-2">
          {(["all", "approved", "locked"] as const).map((v) => (
            <button
              key={v}
              className={`btn btn-sm join-item text-base ${filter === v ? "btn-primary" : "btn-ghost border-base-300"}`}
              onClick={() => setFilter(v)}
            >
              {v === "all" ? "Alle" : v === "approved" ? "Freigeschaltet" : "Gesperrt"}
            </button>
          ))}
        </div>

        {/* Sortier-Buttons */}
        <span className="text-base text-base-content/50 hidden sm:inline">Sortierung:</span>
        {([
          { field: "name",      label: "Name" },
          { field: "approved",  label: "Freigabe" },
          { field: "role",      label: "Rolle" },
          { field: "createdAt", label: "Erstellt" },
        ] as const).map(({ field, label }) => (
          <button
            key={field}
            className={`btn btn-sm text-base ${sortField === field ? "btn-primary" : "btn-ghost border-base-300"}`}
            onClick={() => handleSort(field)}
          >
            {label}{sortIcon(field)}
          </button>
        ))}

        {displayedUsers.length !== users.length && (
          <span className="text-base text-base-content/50 ml-auto">
            {displayedUsers.length} von {users.length}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="table table-zebra text-base w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Login</th>
              <th>Funktion</th>
              <th>Rolle</th>
              <th>Freigabe</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayedUsers.map((u) => {
              const isSelf = u.id === currentUserId;
              const funcs = parseFunctions(u.function);
              return (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-base text-base-content/50">{new Date(u.createdAt).toLocaleDateString("de-DE")}</div>
                  </td>
                  <td>
                    {!isPlaceholderEmail(u.email) && <div>{u.email}</div>}
                    {u.username && <div className="text-base text-primary/80 font-mono">@{u.username}</div>}
                    {!isPlaceholderEmail(u.email) && !u.username && <span className="text-base-content/30">–</span>}
                  </td>
                  <td>
                    <span className="text-base text-base-content/70">
                      {funcs.length > 0 ? funcs.join(", ") : <span className="text-base-content/30">M</span>}
                    </span>
                  </td>
                  <td>
                    <select
                      className="select select-bordered select-sm text-base"
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    {u.approved
                      ? <span className="badge badge-success text-base">Freigegeben</span>
                      : <span className="badge badge-warning text-base">Ausstehend</span>}
                  </td>
                  <td>
                    {u.banned
                      ? <span className="badge badge-error text-base">Gesperrt</span>
                      : <span className="badge badge-ghost text-base">Aktiv</span>}
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <button className="btn btn-xs btn-ghost text-base" onClick={() => openEdit(u)}>Bearbeiten</button>
                      {!isSelf && !u.approved && (
                        <button className="btn btn-xs btn-success text-base" onClick={() => handleApprove(u.id, true)}>
                          Freischalten
                        </button>
                      )}
                      {!isSelf && u.approved && (
                        <ConfirmModal
                          title="Freigabe entziehen?"
                          message={`${u.name} kann sich dann nicht mehr einloggen bis zur erneuten Freischaltung.`}
                          confirmLabel="Entziehen"
                          confirmClass="btn-warning"
                          onConfirm={() => handleApprove(u.id, false)}
                        >
                          <button className="btn btn-xs btn-ghost text-base text-warning">Freigabe</button>
                        </ConfirmModal>
                      )}
                      {!isSelf && (
                        <ConfirmModal
                          title={u.banned ? "Sperre aufheben?" : "Benutzer sperren?"}
                          message={u.banned
                            ? `${u.name} kann sich wieder einloggen.`
                            : `${u.name} wird sofort ausgeloggt und gesperrt.`}
                          confirmLabel={u.banned ? "Aufheben" : "Sperren"}
                          confirmClass={u.banned ? "btn-primary" : "btn-error"}
                          onConfirm={() => handleBan(u.id, !u.banned)}
                        >
                          <button className={`btn btn-xs btn-ghost text-base ${u.banned ? "" : "text-error"}`}>
                            {u.banned ? "Entsperren" : "Sperren"}
                          </button>
                        </ConfirmModal>
                      )}
                      <button className="btn btn-xs btn-ghost text-base" onClick={() => openReset(u)}>Passwort</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Create modal ── */}
      <dialog ref={createRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-xl mb-4">Neuer Benutzer</h3>
          {error && <div className="alert alert-error mb-3 text-base">{error}</div>}
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Name *</span></label>
            <input type="text" className="input input-bordered text-base" value={cName} onChange={(e) => setCName(e.target.value)} />
          </div>
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">E-Mail <span className="text-base-content/50">(optional)</span></span></label>
            <input type="email" className="input input-bordered text-base" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="name@beispiel.de" />
          </div>
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Benutzername <span className="text-base-content/50">(optional, Pflicht wenn keine E-Mail)</span></span></label>
            <input type="text" className="input input-bordered text-base" value={cUsername} onChange={(e) => setCUsername(e.target.value)} placeholder="z.B. muster.hans" autoCapitalize="none" />
          </div>
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Passwort *</span></label>
            <input type="password" className="input input-bordered text-base" value={cPassword} onChange={(e) => setCPassword(e.target.value)} />
          </div>
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Rolle</span></label>
            <select className="select select-bordered text-base" value={cRole} onChange={(e) => setCRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="form-control mb-4">
            <label className="label"><span className="label-text text-base">Vereinsfunktion(en)</span></label>
            <FunctionCheckboxes value={cFunctions} onChange={setCFunctions} />
          </div>
          <label className="label cursor-pointer justify-start gap-3 mb-4">
            <input type="checkbox" className="checkbox checkbox-primary" checked={cApproved} onChange={(e) => setCApproved(e.target.checked)} />
            <span className="label-text text-base">Sofort freischalten</span>
          </label>
          <div className="modal-action">
            <form method="dialog"><button className="btn btn-ghost text-base">Abbrechen</button></form>
            <button className="btn btn-primary text-base" disabled={cLoading} onClick={handleCreate}>
              {cLoading ? "Anlegen..." : "Anlegen"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      {/* ── Edit modal ── */}
      <dialog ref={editRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-xl mb-4">Benutzer bearbeiten</h3>
          {error && <div className="alert alert-error mb-3 text-base">{error}</div>}
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Name</span></label>
            <input type="text" className="input input-bordered text-base" value={eName} onChange={(e) => setEName(e.target.value)} />
          </div>
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">E-Mail</span></label>
            <input type="email" className="input input-bordered text-base" value={eEmail} onChange={(e) => setEEmail(e.target.value)} placeholder="optional" />
          </div>
          <div className="form-control mb-3">
            <label className="label"><span className="label-text text-base">Benutzername</span></label>
            <input type="text" className="input input-bordered text-base" value={eUsername} onChange={(e) => setEUsername(e.target.value)} placeholder="optional" autoCapitalize="none" />
          </div>
          <div className="form-control mb-6">
            <label className="label"><span className="label-text text-base">Vereinsfunktion(en)</span></label>
            <FunctionCheckboxes value={eFunctions} onChange={setEFunctions} />
          </div>
          <div className="modal-action">
            <form method="dialog"><button className="btn btn-ghost text-base">Abbrechen</button></form>
            <button className="btn btn-primary text-base" disabled={eLoading} onClick={handleEdit}>
              {eLoading ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      {/* ── Reset password modal ── */}
      <dialog ref={resetRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-xl mb-4">Passwort zurücksetzen</h3>
          <p className="text-base mb-4">{resetUser?.name}</p>
          {resetUser && isPlaceholderEmail(resetUser.email) && (
            <div className="alert alert-warning mb-4 text-base">
              Kein E-Mail-Konto — das Passwort wird hier angezeigt. Bitte sicher übergeben.
            </div>
          )}
          {error && <div className="alert alert-error mb-3 text-base">{error}</div>}
          {resetResult ? (
            <div className="alert alert-success mb-4 text-base">
              <div>
                <p className="font-medium">Temporäres Passwort:</p>
                <p className="font-mono text-xl mt-1 select-all">{resetResult}</p>
                <p className="text-base mt-2 opacity-70">Bitte sicher übergeben und sofort ändern lassen.</p>
              </div>
            </div>
          ) : (
            <p className="text-base text-base-content/60 mb-4">
              Ein temporäres Passwort wird generiert
              {resetUser && !isPlaceholderEmail(resetUser.email) ? " und per E-Mail gesendet" : ""}.
            </p>
          )}
          <div className="modal-action">
            <form method="dialog"><button className="btn btn-ghost text-base">Schließen</button></form>
            {!resetResult && (
              <button className="btn btn-warning text-base" disabled={resetLoading} onClick={handleReset}>
                {resetLoading ? "Generieren..." : "Passwort zurücksetzen"}
              </button>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>
    </>
  );
}
