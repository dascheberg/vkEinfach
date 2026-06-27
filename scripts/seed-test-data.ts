/**
 * seed-test-data.ts — Testdaten anlegen
 *
 * Ausführen:
 *   npx tsx scripts/seed-test-data.ts
 *
 * Alle angelegten Datensätze tragen "TEST-" im Hauptfeld (lastName, name, title, description).
 * Zum Löschen: npx tsx scripts/cleanup-test-data.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomBytes, scrypt } from "node:crypto";
import { eq, like, and } from "drizzle-orm";
import {
  members,
  guests,
  transactions,
  travels,
  travelParticipants,
  surveys,
  surveyOptions,
  fiscalYears,
  externalAccounts,
  internalAccounts,
  user,
  account,
} from "../src/lib/db/schema";

// ── .env.local laden ────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const sql = neon(process.env.DATABASE_URL!);
const db  = drizzle(sql);

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Passwort-Hash im Format von Better Auth (@better-auth/utils/password node) */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key  = await new Promise<Buffer>((res, rej) =>
    scrypt(
      password.normalize("NFKC"), salt, 64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, buf) => (err ? rej(err) : res(buf)),
    ),
  );
  return `${salt}:${key.toString("hex")}`;
}

/** ID im Stil von Better Auth (alphanumerisch, 28 Zeichen) */
function genId(): string {
  return randomBytes(24).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 28);
}

function ok(msg: string)   { console.log(`  ✓  ${msg}`); }
function skip(msg: string) { console.log(`  –  ${msg}`); }
function warn(msg: string) { console.warn(`  ⚠  ${msg}`); }

// ── Hauptfunktion ────────────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════════════════════════════════════");
  console.log("  vkEinfach — Testdaten anlegen");
  console.log("══════════════════════════════════════════\n");

  // ── 1. Test-User anlegen ──────────────────────────────────────────────────
  console.log("1. Test-Benutzer (4 Rollen)\n");

  const TEST_PASSWORD = "test1234";
  const pwHash = await hashPassword(TEST_PASSWORD);

  const testUsers: { name: string; email: string; username: string; role: string }[] = [
    { name: "TEST-Admin",         email: "test-admin@intern.local",   username: "test-admin",   role: "admin"   },
    { name: "TEST-Vorstand",      email: "test-board@intern.local",   username: "test-board",   role: "board"   },
    { name: "TEST-Kassenprüfer",  email: "test-auditor@intern.local", username: "test-auditor", role: "auditor" },
    { name: "TEST-Mitglied",      email: "test-member@intern.local",  username: "test-member",  role: "member"  },
  ];

  for (const u of testUsers) {
    // Prüfe ob schon vorhanden
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, u.email));
    if (existing.length > 0) {
      skip(`${u.name} (bereits vorhanden)`);
      continue;
    }
    const userId = genId();
    const accId  = genId();
    await db.insert(user).values({
      id:            userId,
      name:          u.name,
      email:         u.email,
      emailVerified: false,
      role:          u.role,
      banned:        false,
      username:      u.username,
      approved:      true,
    });
    await db.insert(account).values({
      id:         accId,
      accountId:  userId,
      providerId: "credential",
      userId,
      password:   pwHash,
    });
    ok(`${u.name}  (${u.role}, login: ${u.username} / ${TEST_PASSWORD})`);
  }

  // ── 2. Test-Mitglieder anlegen ────────────────────────────────────────────
  console.log("\n2. Test-Mitglieder (10)\n");

  const testMemberDefs = [
    { lastName: "TEST-Müller",      firstName: "Hans",      birthDate: "1964-03-15", joinedAt: "2015-01-01", feePaid: true,  func: "M",   notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Schmidt",     firstName: "Erika",     birthDate: "1958-09-20", joinedAt: "2010-03-01", feePaid: true,  func: "M",   notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Weber",       firstName: "Karl",      birthDate: "1954-06-28", joinedAt: "2005-01-01", feePaid: true,  func: "KW",  notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Fischer",     firstName: "Hildegard", birthDate: "1952-12-05", joinedAt: "1998-01-01", feePaid: true,  func: "M",   notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Koch",        firstName: "Friedrich", birthDate: "1948-07-10", joinedAt: "2002-06-01", feePaid: false, func: "M",   notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Bauer",       firstName: "Gertrude",  birthDate: "1943-04-22", joinedAt: "1995-01-01", feePaid: true,  func: "M",   notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Schulz",      firstName: "Werner",    birthDate: "1940-11-30", joinedAt: "1990-01-01", feePaid: false, func: "1.V", notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Zimmermann",  firstName: "Ursula",    birthDate: "1934-08-15", joinedAt: "1985-01-01", feePaid: true,  func: "M",   notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Wagner",      firstName: "Ernst",     birthDate: "1957-02-14", joinedAt: "2012-01-01", feePaid: false, func: "M",   notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Becker",      firstName: "Helga",     birthDate: "1950-07-03", joinedAt: "2008-01-01", feePaid: true,  func: "M",   notes: "TEST-Testdatensatz" },
  ];

  const insertedMemberIds: number[] = [];

  for (const m of testMemberDefs) {
    const existing = await db.select({ id: members.id })
      .from(members)
      .where(and(eq(members.lastName, m.lastName), eq(members.firstName, m.firstName)));
    if (existing.length > 0) {
      insertedMemberIds.push(existing[0].id);
      skip(`${m.lastName}, ${m.firstName} (bereits vorhanden)`);
      continue;
    }
    const [inserted] = await db.insert(members).values({
      lastName:           m.lastName,
      firstName:          m.firstName,
      birthDate:          m.birthDate,
      joinedAt:           m.joinedAt,
      function:           m.func,
      isActive:           true,
      feePaidCurrentYear: m.feePaid,
      notes:              m.notes,
    }).returning({ id: members.id });
    insertedMemberIds.push(inserted.id);
    ok(`${m.lastName}, ${m.firstName}  (geb. ${m.birthDate}, ${m.func}, Beitrag: ${m.feePaid ? "ja" : "nein"})`);
  }

  // ── 3. Test-Gäste anlegen ─────────────────────────────────────────────────
  console.log("\n3. Test-Gäste (3)\n");

  const testGuestDefs = [
    { lastName: "TEST-Besucher",  firstName: "Klaus",   contactInfo: "Tel: 0123-456789",         notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Freund",    firstName: "Maria",   contactInfo: "m.freund@example.test",    notes: "TEST-Testdatensatz" },
    { lastName: "TEST-Extern",    firstName: "Herbert", contactInfo: null,                       notes: "TEST-Gast für Reisetest" },
  ];

  const insertedGuestIds: number[] = [];

  for (const g of testGuestDefs) {
    const existing = await db.select({ id: guests.id })
      .from(guests)
      .where(and(eq(guests.lastName, g.lastName), eq(guests.firstName, g.firstName)));
    if (existing.length > 0) {
      insertedGuestIds.push(existing[0].id);
      skip(`${g.lastName}, ${g.firstName} (bereits vorhanden)`);
      continue;
    }
    const [inserted] = await db.insert(guests).values(g).returning({ id: guests.id });
    insertedGuestIds.push(inserted.id);
    ok(`${g.lastName}, ${g.firstName}`);
  }

  // ── 4. Aktives Buchungsjahr + Konten ermitteln ────────────────────────────
  console.log("\n4. Buchungsjahr + Konten suchen\n");

  const [activeFY] = await db.select().from(fiscalYears).where(eq(fiscalYears.isActive, true));
  const [firstExtAcc] = await db.select().from(externalAccounts).where(eq(externalAccounts.isActive, true));
  const [incomeAcc]  = await db.select().from(internalAccounts)
    .where(and(eq(internalAccounts.isActive, true), eq(internalAccounts.accountKind, "income")));
  const [expenseAcc] = await db.select().from(internalAccounts)
    .where(and(eq(internalAccounts.isActive, true), eq(internalAccounts.accountKind, "expense")));

  if (!activeFY)    warn("Kein aktives Buchungsjahr — Buchungen und Reise werden übersprungen");
  if (!firstExtAcc) warn("Kein aktives externes Konto — Buchungen werden übersprungen");
  if (!incomeAcc)   warn("Kein Einnahmekonto (accountKind='income') — Einnahmen werden übersprungen");
  if (!expenseAcc)  warn("Kein Ausgabenkonto (accountKind='expense') — Ausgaben werden übersprungen");

  // ── 5. Test-Buchungen anlegen ─────────────────────────────────────────────
  console.log("\n5. Test-Buchungen (12)\n");

  if (!activeFY || !firstExtAcc) {
    skip("Buchungen übersprungen (fehlendes Buchungsjahr oder externes Konto)");
  } else {
    const fallbackIntAccId = (await db.select({ id: internalAccounts.id })
      .from(internalAccounts).where(eq(internalAccounts.isActive, true)).limit(1))[0]?.id;

    const incId  = incomeAcc?.id  ?? fallbackIntAccId;
    const expId  = expenseAcc?.id ?? fallbackIntAccId;

    if (!incId || !expId) {
      skip("Buchungen übersprungen (kein internes Konto vorhanden)");
    } else {
      const txDefs: {
        date: string; dir: "in" | "out"; amount: string;
        intId: number; desc: string; bn: string; memberId?: number;
      }[] = [
        { date: "2026-01-10", dir: "in",  amount: "1860.00", intId: incId,  bn: "TEST-0001", desc: "TEST-Mitgliedsbeiträge Januar",       memberId: insertedMemberIds[0] },
        { date: "2026-01-25", dir: "in",  amount: "50.00",   intId: incId,  bn: "TEST-0002", desc: "TEST-Spende Müller" },
        { date: "2026-02-08", dir: "out", amount: "45.00",   intId: expId,  bn: "TEST-0003", desc: "TEST-Bürobedarf Februar" },
        { date: "2026-02-20", dir: "in",  amount: "30.00",   intId: incId,  bn: "TEST-0004", desc: "TEST-Einnahmen Getränkeverkauf" },
        { date: "2026-03-15", dir: "out", amount: "120.00",  intId: expId,  bn: "TEST-0005", desc: "TEST-Veranstaltungskosten März" },
        { date: "2026-03-28", dir: "in",  amount: "250.00",  intId: incId,  bn: "TEST-0006", desc: "TEST-Zuschuss Gemeinde" },
        { date: "2026-04-05", dir: "out", amount: "85.00",   intId: expId,  bn: "TEST-0007", desc: "TEST-Porto und Drucksachen" },
        { date: "2026-04-18", dir: "in",  amount: "40.00",   intId: incId,  bn: "TEST-0008", desc: "TEST-Einnahmen Kaffeenachmittag" },
        { date: "2026-05-12", dir: "out", amount: "200.00",  intId: expId,  bn: "TEST-0009", desc: "TEST-Ehrungen Mai",                  memberId: insertedMemberIds[2] },
        { date: "2026-05-30", dir: "in",  amount: "75.00",   intId: incId,  bn: "TEST-0010", desc: "TEST-Sonstige Einnahmen Mai" },
        { date: "2026-06-06", dir: "out", amount: "160.00",  intId: expId,  bn: "TEST-0011", desc: "TEST-Ausflug Kosten" },
        { date: "2026-06-20", dir: "in",  amount: "100.00",  intId: incId,  bn: "TEST-0012", desc: "TEST-Spende Schmidt" },
      ];

      for (const tx of txDefs) {
        const existing = await db.select({ id: transactions.id })
          .from(transactions).where(eq(transactions.receiptNumber, tx.bn));
        if (existing.length > 0) { skip(`${tx.bn} (bereits vorhanden)`); continue; }
        await db.insert(transactions).values({
          receiptNumber:     tx.bn,
          bookingDate:       tx.date,
          fiscalYearId:      activeFY.id,
          amount:            tx.amount,
          direction:         tx.dir,
          externalAccountId: firstExtAcc.id,
          internalAccountId: tx.intId,
          memberId:          tx.memberId ?? null,
          description:       tx.desc,
          createdBy:         1,
        });
        ok(`${tx.bn}  ${tx.dir === "in" ? "+" : "-"}${tx.amount} €  ${tx.desc}`);
      }
    }
  }

  // ── 6. Test-Reise anlegen ─────────────────────────────────────────────────
  console.log("\n6. Test-Reise\n");

  if (!activeFY) {
    skip("Reise übersprungen (kein aktives Buchungsjahr)");
  } else {
    const [existingTravel] = await db.select({ id: travels.id })
      .from(travels).where(like(travels.name, "TEST-%"));

    let travelId: number;

    if (existingTravel) {
      travelId = existingTravel.id;
      skip("TEST-Reise bereits vorhanden");
    } else {
      const [inserted] = await db.insert(travels).values({
        name:            "TEST-Tagesfahrt Lübeck",
        dateFrom:        "2026-09-15",
        dateTo:          "2026-09-15",
        minParticipants: 10,
        maxParticipants: 20,
        ownContribution: "35.00",
        description:     "TEST-Geplante Tagesfahrt nach Lübeck (Testdaten)",
        fiscalYearId:    activeFY.id,
        status:          "planning",
        notes:           "TEST-Testdatensatz",
      }).returning({ id: travels.id });
      travelId = inserted.id;
      ok(`TEST-Tagesfahrt Lübeck (id=${travelId})`);
    }

    // Teilnehmer hinzufügen (erste 3 Testmitglieder + 1 Gast)
    for (const membId of insertedMemberIds.slice(0, 3)) {
      const existing = await db.select({ id: travelParticipants.id })
        .from(travelParticipants)
        .where(and(eq(travelParticipants.travelId, travelId), eq(travelParticipants.memberId, membId)));
      if (existing.length > 0) { skip(`Teilnehmer member_id=${membId} (bereits vorhanden)`); continue; }
      await db.insert(travelParticipants).values({
        travelId,
        memberId:     membId,
        isRegistered: true,
        isPaid:       membId === insertedMemberIds[0], // erster hat bezahlt
        paidAmount:   membId === insertedMemberIds[0] ? "35.00" : "0.00",
      });
      ok(`Teilnehmer member_id=${membId} angemeldet`);
    }
    if (insertedGuestIds[0]) {
      const gId = insertedGuestIds[0];
      const existing = await db.select({ id: travelParticipants.id })
        .from(travelParticipants)
        .where(and(eq(travelParticipants.travelId, travelId), eq(travelParticipants.guestId, gId)));
      if (existing.length === 0) {
        await db.insert(travelParticipants).values({
          travelId,
          guestId:      gId,
          isRegistered: true,
          isPaid:       false,
          paidAmount:   "0.00",
        });
        ok(`Teilnehmer guest_id=${gId} angemeldet`);
      } else {
        skip(`Gast guest_id=${gId} (bereits vorhanden)`);
      }
    }
  }

  // ── 7. Test-Umfrage anlegen ───────────────────────────────────────────────
  console.log("\n7. Test-Umfrage\n");

  const [existingSurvey] = await db.select({ id: surveys.id })
    .from(surveys).where(like(surveys.title, "TEST-%"));

  if (existingSurvey) {
    skip("TEST-Umfrage bereits vorhanden");
  } else {
    const [insertedSurvey] = await db.insert(surveys).values({
      title:    "TEST-Wohin soll die nächste Reise gehen?",
      status:   "open",
      closesAt: "2026-08-31",
    }).returning({ id: surveys.id });

    const options = [
      { optionText: "TEST-Hamburg Speicherstadt",  sortOrder: 1 },
      { optionText: "TEST-Bremen Altstadt",         sortOrder: 2 },
      { optionText: "TEST-Hannover Herrenhausen",   sortOrder: 3 },
    ];
    for (const opt of options) {
      await db.insert(surveyOptions).values({ surveyId: insertedSurvey.id, ...opt });
    }
    ok(`TEST-Umfrage angelegt (id=${insertedSurvey.id}, 3 Optionen)`);
  }

  // ── Zusammenfassung ───────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  console.log("  Fertig. Testdaten sind in der DB.");
  console.log("  Login-Passwort für alle TEST-User: test1234");
  console.log("  Löschen: npx tsx scripts/cleanup-test-data.ts");
  console.log("══════════════════════════════════════════\n");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => process.exit(0));
