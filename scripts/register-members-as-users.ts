import { db } from "../src/lib/db";
import { members } from "../src/lib/db/schema";
import { auth } from "../src/lib/auth";
import { eq, and, isNull, or } from "drizzle-orm";

// Hilfsfunktion: Umlaute und Sonderzeichen ersetzen
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/é|è|ê/g, "e")
    .replace(/à|â/g, "a")
    .replace(/[^a-z0-9.]/g, ""); // alle anderen Sonderzeichen entfernen
}

async function registerMembersAsUsers() {
  console.log("Starte Registrierung aller aktiven Mitglieder als Benutzer...\n");

  // Alle aktiven Mitglieder laden
  const activeMembers = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.isActive, true),
        or(isNull(members.leftAt), isNull(members.deceased))
      )
    )
    .orderBy(members.lastName, members.firstName);

  console.log(`Gefundene aktive Mitglieder: ${activeMembers.length}\n`);

  // Alle bestehenden Benutzernamen laden um Duplikate zu vermeiden
  const existingUsers = await db.execute(
    `SELECT username, email FROM "user"`
  );
  const existingUsernames = new Set(
    (existingUsers.rows as any[]).map((u: any) => u.username).filter(Boolean)
  );
  const existingEmails = new Set(
    (existingUsers.rows as any[]).map((u: any) => u.email).filter(Boolean)
  );

  const results = {
    created: 0,
    skipped: 0,
    errors: 0,
    details: [] as string[],
  };

  for (const member of activeMembers) {
    const firstName = member.firstName?.trim() ?? "";
    const lastName = member.lastName?.trim() ?? "";

    if (!firstName || !lastName) {
      results.skipped++;
      results.details.push(`⚠  Übersprungen (kein Name): ID ${member.id}`);
      continue;
    }

    // Benutzername generieren: vorname.nachname (alles klein, Umlaute ersetzen)
    const baseUsername = `${sanitizeName(firstName)}.${sanitizeName(lastName)}`;

    // Eindeutigen Benutzernamen finden (Nummer anhängen bei Duplikat)
    let username = baseUsername;
    let counter = 2;
    while (existingUsernames.has(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Passwort: vorname24640 (Umlaute ersetzen, alles klein)
    const password = `${sanitizeName(firstName)}24640`;

    // Fake-E-Mail für Better Auth (wird nie verwendet)
    const fakeEmail = `${username}@intern.vkeinfach.local`;

    // Prüfen ob bereits ein User mit dieser Fake-E-Mail existiert
    if (existingEmails.has(fakeEmail)) {
      results.skipped++;
      results.details.push(`⏭  Bereits vorhanden: ${username} (${firstName} ${lastName})`);
      continue;
    }

    try {
      // User anlegen via Better Auth
      const result = await auth.api.signUpEmail({
        body: {
          email: fakeEmail,
          password: password,
          name: `${firstName} ${lastName}`,
        },
      });

      if (!result?.user?.id) {
        throw new Error("Kein User-Objekt zurückgegeben");
      }

      // Rolle, Funktion und Benutzername setzen
      await db.execute(
        `UPDATE "user"
         SET role = 'member',
             function = 'M',
             username = $1,
             approved = true
         WHERE id = $2`,
        [username, result.user.id]
      );

      // Benutzername zur Liste hinzufügen
      existingUsernames.add(username);
      existingEmails.add(fakeEmail);

      results.created++;
      results.details.push(
        `✅ Angelegt: ${username} / Passwort: ${password} (${firstName} ${lastName})`
      );
    } catch (error: any) {
      results.errors++;
      results.details.push(
        `❌ Fehler bei ${firstName} ${lastName}: ${error.message}`
      );
    }

    // Kurze Pause um Neon nicht zu überlasten
    await new Promise((r) => setTimeout(r, 100));
  }

  // Zusammenfassung
  console.log("═══════════════════════════════════════════════════");
  console.log("ERGEBNIS");
  console.log("═══════════════════════════════════════════════════");
  console.log(`✅ Erfolgreich angelegt: ${results.created}`);
  console.log(`⏭  Bereits vorhanden:   ${results.skipped}`);
  console.log(`❌ Fehler:              ${results.errors}`);
  console.log("═══════════════════════════════════════════════════\n");
  console.log("DETAILS:");
  results.details.forEach((d) => console.log(d));
  console.log("\nFertig!");
  console.log("\nHINWEIS: Alle Mitglieder können sich einloggen mit:");
  console.log("  Benutzername: vorname.nachname");
  console.log("  Passwort:     vorname24640");
  console.log("  (Umlaute ersetzt: ä→ae, ö→oe, ü→ue, ß→ss)");
}

registerMembersAsUsers()
  .catch(console.error)
  .finally(() => process.exit(0));
  .finally(() => process.exit(0));
