"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FUNCTIONS = [
  { value: "M", label: "Mitglied (M)" },
  { value: "1.V", label: "1. Vorsitzender (1.V)" },
  { value: "2.V", label: "2. Vorsitzender (2.V)" },
  { value: "KW", label: "Kassenwart (KW)" },
  { value: "SW", label: "Schriftwart (SW)" },
  { value: "KS", label: "Kassenprüfer Stv. (KS)" },
  { value: "B1", label: "Beirat 1 (B1)" },
  { value: "B2", label: "Beirat 2 (B2)" },
  { value: "B3", label: "Beirat 3 (B3)" },
  { value: "KP1", label: "Kassenprüfer 1 (KP1)" },
  { value: "KP2", label: "Kassenprüfer 2 (KP2)" },
];

interface FormData {
  lastName: string;
  firstName: string;
  street: string;
  zip: string;
  city: string;
  birthDate: string;
  phoneLandline: string;
  phoneMobile: string;
  email: string;
  function: string;
  joinedAt: string;
  leftAt: string;
  deceased: boolean;
  isActive: boolean;
  feePaidCurrentYear: boolean;
  feeNotes: string;
  notes: string;
}

interface Props {
  mode: "create" | "edit";
  memberId?: number;
  initial?: Partial<FormData>;
}

export default function MemberForm({ mode, memberId, initial }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormData>({
    lastName: initial?.lastName ?? "",
    firstName: initial?.firstName ?? "",
    street: initial?.street ?? "",
    zip: initial?.zip ?? "",
    city: initial?.city ?? "",
    birthDate: initial?.birthDate ?? "",
    phoneLandline: initial?.phoneLandline ?? "",
    phoneMobile: initial?.phoneMobile ?? "",
    email: initial?.email ?? "",
    function: initial?.function ?? "M",
    joinedAt: initial?.joinedAt ?? "",
    leftAt: initial?.leftAt ?? "",
    deceased: initial?.deceased ?? false,
    isActive: initial?.isActive ?? true,
    feePaidCurrentYear: initial?.feePaidCurrentYear ?? false,
    feeNotes: initial?.feeNotes ?? "",
    notes: initial?.notes ?? "",
  });

  function set(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleFunction(value: string, checked: boolean) {
    const current = form.function.split(",").filter(Boolean);
    if (!checked && current.length === 1) return;
    const updated = checked
      ? [...current.filter((v) => v !== value), value]
      : current.filter((v) => v !== value);
    set("function", updated.join(","));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const url = mode === "create" ? "/api/members" : `/api/members/${memberId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Fehler beim Speichern.");
      setLoading(false);
      return;
    }

    const saved = await res.json();
    router.push(`/members/${(saved as { id: number }).id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      {error && (
        <div className="alert alert-error text-base">
          <span>{error}</span>
        </div>
      )}

      {/* Personaldaten */}
      <Section title="Personaldaten">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nachname*">
            <input
              type="text"
              className="input input-bordered text-base w-full"
              required
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </Field>
          <Field label="Vorname*">
            <input
              type="text"
              className="input input-bordered text-base w-full"
              required
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </Field>
          <Field label="Straße" className="md:col-span-2">
            <input
              type="text"
              className="input input-bordered text-base w-full"
              value={form.street}
              onChange={(e) => set("street", e.target.value)}
            />
          </Field>
          <Field label="PLZ">
            <input
              type="text"
              className="input input-bordered text-base w-full"
              value={form.zip}
              onChange={(e) => set("zip", e.target.value)}
              maxLength={10}
            />
          </Field>
          <Field label="Ort">
            <input
              type="text"
              className="input input-bordered text-base w-full"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
          <Field label="Geburtsdatum">
            <input
              type="date"
              className="input input-bordered text-base w-full"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* Kontakt */}
      <Section title="Kontakt">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Telefon Festnetz">
            <input
              type="tel"
              className="input input-bordered text-base w-full"
              value={form.phoneLandline}
              onChange={(e) => set("phoneLandline", e.target.value)}
            />
          </Field>
          <Field label="Telefon Mobil">
            <input
              type="tel"
              className="input input-bordered text-base w-full"
              value={form.phoneMobile}
              onChange={(e) => set("phoneMobile", e.target.value)}
            />
          </Field>
          <Field label="E-Mail" className="md:col-span-2">
            <input
              type="email"
              className="input input-bordered text-base w-full"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* Vereinsdaten */}
      <Section title="Vereinsdaten">
        <div className="mb-4">
          <p className="label-text text-base mb-2">Vereinsfunktion</p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {FUNCTIONS.map((f) => {
              const isChecked = form.function.split(",").includes(f.value);
              return (
                <label key={f.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={isChecked}
                    onChange={(e) => toggleFunction(f.value, e.target.checked)}
                  />
                  <span className="text-base">{f.label}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Eingetreten am">
            <input
              type="date"
              className="input input-bordered text-base w-full"
              value={form.joinedAt}
              onChange={(e) => set("joinedAt", e.target.value)}
            />
          </Field>
          <Field label="Ausgetreten am">
            <input
              type="date"
              className="input input-bordered text-base w-full"
              value={form.leftAt}
              onChange={(e) => set("leftAt", e.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            <span className="text-base">Aktiv</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.deceased}
              onChange={(e) => set("deceased", e.target.checked)}
            />
            <span className="text-base">Verstorben</span>
          </label>
        </div>
      </Section>

      {/* Beitrag */}
      <Section title="Beitrag">
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input
            type="checkbox"
            className="checkbox checkbox-success"
            checked={form.feePaidCurrentYear}
            onChange={(e) => set("feePaidCurrentYear", e.target.checked)}
          />
          <span className="text-base">Beitrag laufendes Jahr bezahlt</span>
        </label>
        <Field label="Beitragsnotizen">
          <textarea
            className="textarea textarea-bordered text-base w-full"
            rows={2}
            value={form.feeNotes}
            onChange={(e) => set("feeNotes", e.target.value)}
          />
        </Field>
      </Section>

      {/* Notizen */}
      <Section title="Notizen">
        <Field label="Allgemeine Bemerkungen">
          <textarea
            className="textarea textarea-bordered text-base w-full"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </Section>

      <div className="flex gap-4">
        <button type="submit" className="btn btn-primary text-base" disabled={loading}>
          {loading ? "Speichern..." : mode === "create" ? "Mitglied anlegen" : "Speichern"}
        </button>
        <button
          type="button"
          className="btn btn-ghost text-base"
          onClick={() => router.back()}
          disabled={loading}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body py-5 px-6">
        <h2 className="text-xl font-semibold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`form-control ${className}`}>
      <label className="label pb-1">
        <span className="label-text text-base">{label}</span>
      </label>
      {children}
    </div>
  );
}
