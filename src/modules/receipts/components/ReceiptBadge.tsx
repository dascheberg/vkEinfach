"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/context/SettingsContext";

interface Receipt {
  id: number;
  fileName: string;
  filePath: string;
  fileType: string | null;
  storageType: string;
  notes: string | null;
}

interface Props {
  transactionId: number;
  receiptNumber: string | null;
  initialCount: number;
  isAdmin: boolean;
}

const STORAGE_LABELS: Record<string, string> = {
  local: "Lokal",
  nas:   "NAS",
  cloud: "Cloud",
};

function detectFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["jpg", "jpeg"].includes(ext)) return "jpg";
  if (["png"].includes(ext)) return "png";
  return "pdf";
}

function buildPath(basePath: string, fileName: string): string {
  if (!basePath) return fileName;
  const sep = basePath.includes("\\") ? "\\" : "/";
  const trimmed = basePath.endsWith(sep) ? basePath : basePath + sep;
  return trimmed + fileName;
}

export default function ReceiptBadge({ transactionId, receiptNumber, initialCount, isAdmin }: Props) {
  const ref        = useRef<HTMLDialogElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const router     = useRouter();
  const { settings } = useSettings();

  const [receipts,    setReceipts]    = useState<Receipt[]>([]);
  const [count,       setCount]       = useState(initialCount);
  const [loading,     setLoading]     = useState(false);
  const [adding,      setAdding]      = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [pathEditing, setPathEditing] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [form,        setForm]        = useState({
    fileName:    "",
    filePath:    "",
    fileType:    "pdf",
    storageType: "local",
    notes:       "",
  });

  async function openModal() {
    ref.current?.showModal();
    setLoading(true);
    try {
      const res = await fetch(`/api/receipts?transactionId=${transactionId}`);
      if (res.ok) {
        const data: Receipt[] = await res.json();
        setReceipts(data);
        setCount(data.length);
      }
    } finally {
      setLoading(false);
    }
  }

  function startAdding() {
    setForm({
      fileName:    "",
      filePath:    settings.receiptDefaultPath,
      fileType:    "pdf",
      storageType: "local",
      notes:       "",
    });
    setPathEditing(false);
    setAdding(true);
  }

  function handleStorageTypeChange(value: string) {
    setForm((f) => ({
      ...f,
      storageType: value,
      filePath: value === "local" ? settings.receiptDefaultPath : "",
    }));
    setPathEditing(false);
  }

  function handleFileNameChange(value: string) {
    setForm((f) => ({
      ...f,
      fileName: value,
      fileType: detectFileType(value),
      filePath: f.storageType === "local" && settings.receiptDefaultPath
        ? buildPath(settings.receiptDefaultPath, value)
        : f.filePath,
    }));
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name;
    setForm((f) => ({
      ...f,
      fileName: name,
      fileType: detectFileType(name),
      filePath: f.storageType === "local"
        ? buildPath(settings.receiptDefaultPath, name)
        : f.filePath,
    }));
    setPathEditing(false);
    e.target.value = "";
  }

  async function handleAdd() {
    if (!form.fileName.trim() || !form.filePath.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/receipts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ transactionId, ...form }),
      });
      if (res.ok) {
        const newReceipt: Receipt = await res.json();
        setReceipts((prev) => [...prev, newReceipt]);
        setCount((prev) => prev + 1);
        setForm({ fileName: "", filePath: "", fileType: "pdf", storageType: "local", notes: "" });
        setPathEditing(false);
        setAdding(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      setCount((prev) => prev - 1);
      router.refresh();
    }
  }

  const defaultPath = settings.receiptDefaultPath;

  return (
    <>
      <button
        type="button"
        className={`btn btn-xs text-base ${count > 0 ? "btn-success btn-outline" : "btn-ghost opacity-40"}`}
        onClick={openModal}
        title="Scan-Belege"
      >
        {count > 0 ? `📎 ${count}` : "📎"}
      </button>

      <dialog ref={ref} className="modal">
        <div className="modal-box max-w-2xl">
          <h3 className="font-bold text-xl mb-4">
            Belege — {receiptNumber ?? `Buchung #${transactionId}`}
          </h3>

          {loading ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : (
            <>
              {receipts.length === 0 ? (
                <p className="text-base text-base-content/60 mb-4">Keine Belege vorhanden.</p>
              ) : (
                <div className="overflow-x-auto mb-4">
                  <table className="table table-zebra text-base w-full">
                    <thead>
                      <tr className="text-base">
                        <th>Dateiname</th>
                        <th>Pfad</th>
                        <th>Typ</th>
                        <th>Ort</th>
                        <th>Notizen</th>
                        <th scope="col"><span className="sr-only">Aktionen</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipts.map((r) => (
                        <tr key={r.id}>
                          <td className="font-mono">{r.fileName}</td>
                          <td className="font-mono text-base break-all max-w-xs">{r.filePath}</td>
                          <td>{r.fileType?.toUpperCase() ?? "–"}</td>
                          <td>{STORAGE_LABELS[r.storageType] ?? r.storageType}</td>
                          <td>{r.notes ?? "–"}</td>
                          <td>
                            <div className="flex gap-1">
                              {r.storageType !== "cloud" && (
                                <a
                                  href={`/api/receipts/${r.id}/view`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-xs btn-info btn-outline text-base"
                                >
                                  Anzeigen
                                </a>
                              )}
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-error btn-outline text-base"
                                  onClick={() => handleDelete(r.id)}
                                >
                                  Löschen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isAdmin && !adding && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm text-base"
                  onClick={startAdding}
                >
                  + Beleg hinzufügen
                </button>
              )}

              {isAdmin && adding && (
                <div className="bg-base-200 rounded-box p-4 space-y-3">
                  <h4 className="font-semibold text-base">Neuer Beleg</h4>

                  {/* Scan-Hinweis */}
                  {defaultPath && form.storageType === "local" && (
                    <div className="alert alert-info py-2 text-base flex flex-wrap items-center gap-2">
                      <span className="flex-1">
                        Scan-Ordner:&nbsp;
                        <span className="font-mono font-semibold">{defaultPath}</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost text-base"
                        title="Pfad in Zwischenablage kopieren, dann im Datei-Dialog Strg+V in die Adressleiste"
                        onClick={() => {
                          navigator.clipboard.writeText(defaultPath);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? "✓ Kopiert" : "Pfad kopieren"}
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Dateiname + Picker */}
                    <label className="form-control">
                      <span className="label-text text-base mb-1">Dateiname *</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input input-bordered text-base flex-1"
                          placeholder="z.B. 2026-0001.pdf"
                          value={form.fileName}
                          onChange={(e) => handleFileNameChange(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm text-base self-end"
                          title={defaultPath ? `Ordner: ${defaultPath}` : "Datei auswählen"}
                          onClick={() => fileRef.current?.click()}
                        >
                          ...
                        </button>
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={handleFilePick}
                        />
                      </div>
                    </label>

                    {/* Speicherort */}
                    <label className="form-control">
                      <span className="label-text text-base mb-1">Speicherort</span>
                      <select
                        className="select select-bordered text-base"
                        value={form.storageType}
                        onChange={(e) => handleStorageTypeChange(e.target.value)}
                      >
                        <option value="local">Lokal</option>
                        <option value="nas">NAS</option>
                        <option value="cloud">Cloud</option>
                      </select>
                    </label>
                  </div>

                  {/* Dateipfad — read-only mit Ändern-Button */}
                  <div className="form-control">
                    <span className="label-text text-base mb-1">Dateipfad *</span>
                    {pathEditing ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input input-bordered text-base font-mono flex-1"
                          placeholder="z.B. C:\Belege\2026\2026-0001.pdf"
                          value={form.filePath}
                          onChange={(e) => setForm((f) => ({ ...f, filePath: e.target.value }))}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-base self-end"
                          onClick={() => setPathEditing(false)}
                        >
                          Fertig
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <div className="input input-bordered text-base font-mono flex-1 flex items-center bg-base-100 text-base-content/70 overflow-hidden">
                          <span className="truncate">
                            {form.filePath || <span className="text-base-content/40">Kein Pfad gesetzt</span>}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-base"
                          onClick={() => setPathEditing(true)}
                        >
                          Ändern
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="form-control">
                      <span className="label-text text-base mb-1">Dateityp</span>
                      <select
                        className="select select-bordered text-base"
                        value={form.fileType}
                        onChange={(e) => setForm((f) => ({ ...f, fileType: e.target.value }))}
                      >
                        <option value="pdf">PDF</option>
                        <option value="jpg">JPG</option>
                        <option value="png">PNG</option>
                      </select>
                    </label>

                    <label className="form-control">
                      <span className="label-text text-base mb-1">Notizen</span>
                      <input
                        type="text"
                        className="input input-bordered text-base"
                        placeholder="Optional"
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm text-base"
                      onClick={handleAdd}
                      disabled={saving || !form.fileName.trim() || !form.filePath.trim()}
                    >
                      {saving ? <span className="loading loading-spinner loading-xs" /> : "Speichern"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-base"
                      onClick={() => setAdding(false)}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="modal-action">
            <form method="dialog">
              <button type="submit" className="btn btn-ghost text-base">Schließen</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </>
  );
}
