"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ImportModal from "@/components/ui/ImportModal";

interface Guest {
  id: number;
  lastName: string;
  firstName: string;
  contactInfo: string | null;
  notes: string | null;
  createdAt: string;
}

interface Props {
  isAdmin: boolean;
}

const emptyForm = { lastName: "", firstName: "", contactInfo: "", notes: "" };

export default function GuestsClient({ isAdmin }: Props) {
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const formModalRef = useRef<HTMLDialogElement>(null);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => { loadGuests(); }, []);

  async function loadGuests(q = search) {
    setLoading(true);
    const res = await fetch(`/api/guests${q ? `?search=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) setGuests(await res.json());
    setLoading(false);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  function openCreate() {
    setEditingGuest(null);
    setForm(emptyForm);
    setFormError("");
    formModalRef.current?.showModal();
  }

  function openEdit(g: Guest) {
    setEditingGuest(g);
    setForm({
      lastName: g.lastName,
      firstName: g.firstName,
      contactInfo: g.contactInfo ?? "",
      notes: g.notes ?? "",
    });
    setFormError("");
    formModalRef.current?.showModal();
  }

  async function handleSave() {
    setSaving(true);
    setFormError("");
    const url = editingGuest ? `/api/guests/${editingGuest.id}` : "/api/guests";
    const method = editingGuest ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error ?? "Fehler beim Speichern");
      setSaving(false);
      return;
    }
    formModalRef.current?.close();
    setSaving(false);
    showSuccess(editingGuest ? "Gast aktualisiert" : "Gast angelegt");
    await loadGuests();
    router.refresh();
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/guests/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Fehler beim Löschen");
    } else {
      showSuccess("Gast gelöscht");
      await loadGuests();
      router.refresh();
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadGuests(search);
  }

  return (
    <>
      {error && (
        <div className="alert alert-error mb-4 text-base">
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setError("")}>✕</button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success mb-4 text-base">
          <span>{successMsg}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 mb-6 bg-base-100 p-4 rounded-box shadow">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 items-end flex-1">
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
          <button type="submit" className="btn btn-primary text-base">Suchen</button>
          <button type="button" className="btn btn-ghost text-base"
            onClick={() => { setSearch(""); loadGuests(""); }}>
            Zurücksetzen
          </button>
        </form>
        {isAdmin && (
          <div className="flex gap-2">
            <ImportModal type="guests" onSuccess={() => loadGuests()} />
            <button className="btn btn-primary text-base" onClick={openCreate}>
              Neuer Gast
            </button>
          </div>
        )}
      </div>

      <p className="text-base text-base-content/60 mb-3">{guests.length} Gäste</p>

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra text-base w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kontakt</th>
                <th>Bemerkungen</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-base-content/50">
                    Keine Gäste gefunden
                  </td>
                </tr>
              ) : (
                guests.map((g) => (
                  <tr key={g.id}>
                    <td className="font-medium">{g.lastName}, {g.firstName}</td>
                    <td className="whitespace-pre-wrap">{g.contactInfo ?? "–"}</td>
                    <td className="text-base-content/70">{g.notes ?? "–"}</td>
                    {isAdmin && (
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-ghost text-base"
                            onClick={() => openEdit(g)}
                          >
                            Bearbeiten
                          </button>
                          <ConfirmModal
                            title="Gast löschen"
                            message={`„${g.firstName} ${g.lastName}" löschen? Dies ist nur möglich wenn keine Reise-Teilnahme vorhanden ist.`}
                            confirmLabel="Löschen"
                            confirmClass="btn-error"
                            onConfirm={() => handleDelete(g.id)}
                          >
                            <button className="btn btn-sm btn-ghost text-base text-error">Löschen</button>
                          </ConfirmModal>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Gast anlegen / bearbeiten */}
      <dialog ref={formModalRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-xl mb-4">
            {editingGuest ? "Gast bearbeiten" : "Neuer Gast"}
          </h3>

          {formError && (
            <div className="alert alert-error mb-4 text-base">{formError}</div>
          )}

          <div className="flex gap-3 mb-3">
            <div className="form-control flex-1">
              <label className="label"><span className="label-text text-base">Nachname</span></label>
              <input
                type="text"
                className="input input-bordered text-base"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div className="form-control flex-1">
              <label className="label"><span className="label-text text-base">Vorname</span></label>
              <input
                type="text"
                className="input input-bordered text-base"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
          </div>

          <div className="form-control mb-3">
            <label className="label">
              <span className="label-text text-base">Kontakt (Tel / E-Mail / Adresse)</span>
            </label>
            <textarea
              className="textarea textarea-bordered text-base"
              rows={2}
              value={form.contactInfo}
              onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
            />
          </div>

          <div className="form-control mb-4">
            <label className="label"><span className="label-text text-base">Bemerkungen</span></label>
            <textarea
              className="textarea textarea-bordered text-base"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-base">Abbrechen</button>
            </form>
            <button
              onClick={handleSave}
              disabled={saving || !form.lastName || !form.firstName}
              className="btn btn-primary text-base"
            >
              {saving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
