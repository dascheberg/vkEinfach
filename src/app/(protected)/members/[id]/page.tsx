import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  formatDate,
  calculateAge,
  isRoundBirthday,
  calculateMemberYears,
  isMemberAnniversary,
} from "@/lib/utils/calculations";
import Link from "next/link";
import MemberActions from "@/modules/members/components/MemberActions";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  const { id } = await params;

  const [member] = await db.select().from(members).where(eq(members.id, parseInt(id)));
  if (!member) notFound();

  const age = calculateAge(member.birthDate);
  const memberYears = calculateMemberYears(member.joinedAt);
  const roundBday = isRoundBirthday(age);
  const anniversary = isMemberAnniversary(memberYears);
  const isAdmin = role === "admin";

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link href="/members" className="btn btn-ghost text-base">
          Zurück
        </Link>
        <h1 className="text-xl font-bold">
          {member.firstName} {member.lastName}
        </h1>
        {!member.isActive && (
          <span className="badge badge-ghost text-base">Inaktiv</span>
        )}
        {member.deceased && (
          <span className="badge badge-ghost text-base">Verstorben</span>
        )}
      </div>

      {isAdmin && (
        <div className="mb-6">
          <MemberActions memberId={member.id} isActive={member.isActive} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {(roundBday || anniversary) && (
          <div className="alert alert-info text-base">
            <span>
              {roundBday && `Runder Geburtstag: ${age}. Geburtstag`}
              {roundBday && anniversary && " · "}
              {anniversary && `Mitgliedsjubiläum: ${memberYears} Jahre`}
            </span>
          </div>
        )}

        <InfoCard title="Personaldaten">
          <InfoRow label="Nachname" value={member.lastName} />
          <InfoRow label="Vorname" value={member.firstName} />
          <InfoRow label="Straße" value={member.street} />
          <InfoRow
            label="PLZ / Ort"
            value={[member.zip, member.city].filter(Boolean).join(" ") || null}
          />
          <InfoRow label="Geburtsdatum" value={formatDate(member.birthDate)} />
          <InfoRow
            label="Alter"
            value={
              age !== null
                ? `${age} Jahre${roundBday ? " (runder Geburtstag!)" : ""}`
                : null
            }
          />
        </InfoCard>

        <InfoCard title="Kontakt">
          <InfoRow label="Telefon Festnetz" value={member.phoneLandline} />
          <InfoRow label="Telefon Mobil" value={member.phoneMobile} />
          <InfoRow label="E-Mail" value={member.email} />
        </InfoCard>

        <InfoCard title="Vereinsdaten">
          <div className="flex gap-4">
            <span className="text-base text-base-content/60 w-44 shrink-0">Funktion</span>
            <div className="flex flex-wrap gap-1">
              {member.function.split(",").filter(Boolean).map((f) => (
                <span key={f} className="badge badge-outline text-base">{f}</span>
              ))}
            </div>
          </div>
          <InfoRow label="Eingetreten am" value={formatDate(member.joinedAt)} />
          <InfoRow
            label="Mitgliedsjahre"
            value={
              memberYears !== null
                ? `${memberYears} Jahre${anniversary ? " (Jubiläum!)" : ""}`
                : null
            }
          />
          {member.leftAt && (
            <InfoRow label="Ausgetreten am" value={formatDate(member.leftAt)} />
          )}
        </InfoCard>

        <InfoCard title="Beitrag">
          <InfoRow
            label="Status"
            value={member.feePaidCurrentYear ? "Bezahlt" : "Ausstehend"}
          />
          {member.feeNotes && <InfoRow label="Notizen" value={member.feeNotes} />}
        </InfoCard>

        {member.notes && (
          <InfoCard title="Notizen">
            <p className="text-base whitespace-pre-wrap">{member.notes}</p>
          </InfoCard>
        )}

        <p className="text-base text-base-content/40">
          Angelegt: {member.createdAt.toLocaleDateString("de-DE")} · Geändert:{" "}
          {member.updatedAt.toLocaleDateString("de-DE")}
        </p>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body py-4 px-5">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex gap-4">
      <span className="text-base text-base-content/60 w-44 shrink-0">{label}</span>
      <span className="text-base">{value ?? "–"}</span>
    </div>
  );
}
