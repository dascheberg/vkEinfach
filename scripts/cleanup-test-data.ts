/**
 * cleanup-test-data.ts — Alle Testdaten löschen
 *
 * Ausführen:
 *   npx tsx scripts/cleanup-test-data.ts
 *
 * Löscht alle Datensätze die durch seed-test-data.ts angelegt wurden:
 *   - Umfragestimmen, Umfrage-Optionen, Umfragen (title LIKE 'TEST-%')
 *   - Reise-Teilnehmer, Reisen (name LIKE 'TEST-%')
 *   - Scan-Belege für TEST-Buchungen
 *   - Buchungen (description LIKE 'TEST-%' oder receipt_number LIKE 'TEST-%')
 *   - Mitglieder (last_name LIKE 'TEST-%')
 *   - Gäste (last_name LIKE 'TEST-%')
 *   - Benutzer (name LIKE 'TEST-%') → inkl. Session + Account via CASCADE
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { eq, like, inArray, or, isNull, not, and } from "drizzle-orm";
import {
  members,
  guests,
  transactions,
  receipts,
  travels,
  travelParticipants,
  surveys,
  surveyOptions,
  surveyVotes,
  user,
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

function ok(msg: string)   { console.log(`  ✓  ${msg}`); }
function skip(msg: string) { console.log(`  –  ${msg}`); }

async function main() {
  console.log("\n══════════════════════════════════════════");
  console.log("  vkEinfach — Testdaten löschen");
  console.log("══════════════════════════════════════════\n");

  // ── IDs aller TEST-Datensätze sammeln ─────────────────────────────────────
  const [
    testMemberRows,
    testGuestRows,
    testTravelRows,
    testSurveyRows,
    testTxRows,
  ] = await Promise.all([
    db.select({ id: members.id }).from(members).where(like(members.lastName, "TEST-%")),
    db.select({ id: guests.id }).from(guests).where(like(guests.lastName, "TEST-%")),
    db.select({ id: travels.id }).from(travels).where(like(travels.name, "TEST-%")),
    db.select({ id: surveys.id }).from(surveys).where(like(surveys.title, "TEST-%")),
    db.select({ id: transactions.id }).from(transactions).where(
      or(like(transactions.description, "TEST-%"), like(transactions.receiptNumber, "TEST-%"))
    ),
  ]);

  const memberIds = testMemberRows.map(r => r.id);
  const guestIds  = testGuestRows.map(r => r.id);
  const travelIds = testTravelRows.map(r => r.id);
  const surveyIds = testSurveyRows.map(r => r.id);
  const txIds     = testTxRows.map(r => r.id);

  console.log(`Gefunden: ${memberIds.length} Mitglieder, ${guestIds.length} Gäste, ` +
    `${travelIds.length} Reisen, ${surveyIds.length} Umfragen, ${txIds.length} Buchungen\n`);

  // ── 1. Umfragestimmen ─────────────────────────────────────────────────────
  console.log("1. Umfragestimmen\n");

  // Stimmen von TEST-Mitgliedern
  if (memberIds.length > 0) {
    const deleted = await db.delete(surveyVotes).where(inArray(surveyVotes.memberId, memberIds)).returning({ id: surveyVotes.id });
    if (deleted.length > 0) ok(`${deleted.length} Stimme(n) von TEST-Mitgliedern gelöscht`);
    else skip("Keine Stimmen von TEST-Mitgliedern");
  }
  // Stimmen für TEST-Umfragen (können von anderen Mitgliedern sein)
  if (surveyIds.length > 0) {
    const deleted = await db.delete(surveyVotes).where(inArray(surveyVotes.surveyId, surveyIds)).returning({ id: surveyVotes.id });
    if (deleted.length > 0) ok(`${deleted.length} weitere Stimme(n) für TEST-Umfragen gelöscht`);
    else skip("Keine weiteren Stimmen für TEST-Umfragen");
  }

  // ── 2. Umfrage-Optionen ───────────────────────────────────────────────────
  console.log("\n2. Umfrage-Optionen\n");

  if (surveyIds.length > 0) {
    const deleted = await db.delete(surveyOptions).where(inArray(surveyOptions.surveyId, surveyIds)).returning({ id: surveyOptions.id });
    if (deleted.length > 0) ok(`${deleted.length} Option(en) gelöscht`);
    else skip("Keine Optionen vorhanden");
  } else {
    skip("Keine TEST-Umfragen gefunden");
  }

  // ── 3. Umfragen ───────────────────────────────────────────────────────────
  console.log("\n3. Umfragen\n");

  if (surveyIds.length > 0) {
    const deleted = await db.delete(surveys).where(inArray(surveys.id, surveyIds)).returning({ id: surveys.id });
    ok(`${deleted.length} Umfrage(n) gelöscht`);
  } else {
    skip("Keine TEST-Umfragen gefunden");
  }

  // ── 4. Reise-Teilnehmer ───────────────────────────────────────────────────
  console.log("\n4. Reise-Teilnehmer\n");

  const tpConditions = [];
  if (travelIds.length > 0) tpConditions.push(inArray(travelParticipants.travelId, travelIds));
  if (memberIds.length > 0) tpConditions.push(inArray(travelParticipants.memberId,  memberIds));
  if (guestIds.length  > 0) tpConditions.push(inArray(travelParticipants.guestId,   guestIds));

  if (tpConditions.length > 0) {
    const deleted = await db.delete(travelParticipants)
      .where(or(...tpConditions))
      .returning({ id: travelParticipants.id });
    if (deleted.length > 0) ok(`${deleted.length} Teilnehmer-Eintrag/Einträge gelöscht`);
    else skip("Keine Teilnehmer-Einträge vorhanden");
  } else {
    skip("Keine TEST-Reisen, -Mitglieder oder -Gäste gefunden");
  }

  // ── 5. Reisen ─────────────────────────────────────────────────────────────
  console.log("\n5. Reisen\n");

  if (travelIds.length > 0) {
    const deleted = await db.delete(travels).where(inArray(travels.id, travelIds)).returning({ id: travels.id });
    ok(`${deleted.length} Reise(n) gelöscht`);
  } else {
    skip("Keine TEST-Reisen gefunden");
  }

  // ── 6. Scan-Belege für TEST-Buchungen ─────────────────────────────────────
  console.log("\n6. Scan-Belege\n");

  if (txIds.length > 0) {
    const deleted = await db.delete(receipts).where(inArray(receipts.transactionId, txIds)).returning({ id: receipts.id });
    if (deleted.length > 0) ok(`${deleted.length} Scan-Beleg(e) gelöscht`);
    else skip("Keine Scan-Belege für TEST-Buchungen vorhanden");
  } else {
    skip("Keine TEST-Buchungen gefunden");
  }

  // ── 7. Buchungen ──────────────────────────────────────────────────────────
  console.log("\n7. Buchungen\n");

  if (txIds.length > 0) {
    const deleted = await db.delete(transactions).where(inArray(transactions.id, txIds)).returning({ id: transactions.id });
    ok(`${deleted.length} Buchung(en) gelöscht`);
  } else {
    skip("Keine TEST-Buchungen gefunden");
  }

  // ── 8. Referenzen auf TEST-Mitglieder in anderen Buchungen nullen ──────────
  console.log("\n8. Mitglieds-Referenzen in Buchungen bereinigen\n");

  if (memberIds.length > 0) {
    // Buchungen die auf TEST-Mitglieder zeigen aber selbst keine TEST-Buchungen sind
    const updated = await db.update(transactions)
      .set({ memberId: null })
      .where(
        and(
          inArray(transactions.memberId, memberIds),
          not(inArray(transactions.id, txIds.length > 0 ? txIds : [-1]))
        )
      )
      .returning({ id: transactions.id });
    if (updated.length > 0) ok(`${updated.length} Buchung(en) — memberId auf NULL gesetzt`);
    else skip("Keine weiteren Buchungen verweisen auf TEST-Mitglieder");
  } else {
    skip("Keine TEST-Mitglieder vorhanden");
  }

  // ── 9. Mitglieder ─────────────────────────────────────────────────────────
  console.log("\n9. Mitglieder\n");

  if (memberIds.length > 0) {
    const deleted = await db.delete(members).where(inArray(members.id, memberIds)).returning({ id: members.id });
    ok(`${deleted.length} Mitglied(er) gelöscht`);
  } else {
    skip("Keine TEST-Mitglieder gefunden");
  }

  // ── 10. Gäste ─────────────────────────────────────────────────────────────
  console.log("\n10. Gäste\n");

  if (guestIds.length > 0) {
    const deleted = await db.delete(guests).where(inArray(guests.id, guestIds)).returning({ id: guests.id });
    ok(`${deleted.length} Gast/Gäste gelöscht`);
  } else {
    skip("Keine TEST-Gäste gefunden");
  }

  // ── 11. Benutzer (CASCADE löscht session + account) ───────────────────────
  console.log("\n11. Benutzer\n");

  const deleted = await db.delete(user).where(like(user.name, "TEST-%")).returning({ id: user.id, name: user.name });
  if (deleted.length > 0) {
    for (const u of deleted) ok(`${u.name} (id=${u.id})`);
    ok(`${deleted.length} Benutzer gelöscht (inkl. Session + Account via CASCADE)`);
  } else {
    skip("Keine TEST-Benutzer gefunden");
  }

  // ── Zusammenfassung ───────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  console.log("  Fertig. Alle Testdaten wurden gelöscht.");
  console.log("══════════════════════════════════════════\n");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => process.exit(0));
