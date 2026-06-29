# vkEinfach — Projektdokumentation für Claude

## Projektübersicht

Vereinskasse für den **Seniorenclub Schmalfeld e.V.**
Eigenständige Web-App unter `kasse.scschmalfeld.org` — verlinkt von scschmalfeld.org.
Ziel: Wiederverwendbar für beliebige Vereine (Vereinsname, Module konfigurierbar).

| Eigenschaft         | Wert                            |
| ------------------- | ------------------------------- |
| GitHub              | github.com/dascheberg/vkEinfach |
| Lokales Verzeichnis | ~/dev/vkEinfach (WSL2)          |
| Neon-DB             | neondb (Projekt: vkEinfach)     |
| Vercel-Projekt      | vkeinfach                       |
| Produktiv-URL       | kasse.scschmalfeld.org          |

## Tech-Stack

- Framework: Next.js 14 + TypeScript
- Styling: TailwindCSS v3 + DaisyUI 4.12.24 (Theme: emerald)
- Datenbank: Neon PostgreSQL via @neondatabase/serverless (HTTP-Treiber!)
- ORM: Drizzle ORM
- Auth: Better Auth (4 Rollen) + username-Plugin (Login per Benutzername, E-Mail optional)
- E-Mail: nodemailer (SMTP — konfigurierbar je Verein in Settings, kein externer Dienst)
- PDF: pdfkit (serverExternalPackages: ["pdfkit"] in next.config.mjs)
- Diagramme: Recharts

## Rollen & Berechtigungen

### Konzept: Funktion ≠ Rolle

**Funktion** = Vereinsamt (wer ist die Person im Verein) — Mehrfachauswahl möglich
**Rolle** = App-Berechtigung (was darf die Person in der App) — genau eine pro User

Beide Felder sind in der `user`-Tabelle gespeichert:
- `role` = App-Rolle (text, genau ein Wert)
- `function` = Vereinsfunktion (varchar(100), kommasepariert z.B. "KW,B1")

### App-Rollen (5 Rollen)

| Rolle | Bezeichnung | Beschreibung |
|---|---|---|
| `admin` | Administrator | Vollzugriff inkl. Einstellungen + Benutzerverwaltung |
| `finanzen` | Finanzen | Buchungen, Konten, Belege, Buchungsjahre — alles Finanzielle. Mehrere Personen möglich (Kassenwart + Backup) |
| `vorstand` | Vorstand | Lesen + Reisen/Umfragen anlegen und verwalten |
| `auditor` | Kassenprüfer | Nur lesen — kein Schreiben |
| `member` | Mitglied | Dashboard + Umfragen (lesen + abstimmen) + eigene Daten |

### Vereinsfunktionen (Feld function in user-Tabelle)

Mehrfachauswahl via Checkboxen in /users beim Anlegen/Bearbeiten.
Gespeichert als kommaseparierter String: "KW,B1" oder "1.V,SW"

| Kürzel | Bezeichnung |
|---|---|
| `M` | Mitglied (Standard / Default) |
| `1.V` | 1. Vorsitzende(r) |
| `2.V` | 2. Vorsitzende(r) |
| `KW` | Kassenwart |
| `SW` | Schriftwart |
| `KS` | Kassen- und Schriftwart |
| `B1` | 1. Beisitzer |
| `B2` | 2. Beisitzer |
| `B3` | 3. Beisitzer |
| `KP1` | 1. Kassenprüfer |
| `KP2` | 2. Kassenprüfer |

### DB-Änderung user-Tabelle (SQL für Neon)

```sql
-- Funktion zum App-User hinzufügen
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS function varchar(100) DEFAULT 'M';

-- Neue Rolle 'finanzen' ersetzt 'board' (falls bereits board-User existieren)
UPDATE "user" SET role = 'finanzen' WHERE role = 'board';
```

### Drizzle Schema — user-Tabelle ergänzen

```ts
function: varchar("function", { length: 100 }).default("M"),
```

### Berechtigungsmatrix

| Bereich | admin | finanzen | vorstand | auditor | member |
|---|---|---|---|---|---|
| Einstellungen (App/SMTP/Module) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Benutzerverwaltung /users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mitglieder lesen | ✅ | ✅ | ✅ | ✅ | ❌ |
| Mitglieder anlegen/bearbeiten | ✅ | ✅ | ❌ | ❌ | ❌ |
| Buchungen lesen | ✅ | ✅ | ✅ | ✅ | ❌ |
| Buchungen anlegen/stornieren | ✅ | ✅ | ❌ | ❌ | ❌ |
| Belege erfassen | ✅ | ✅ | ❌ | ❌ | ❌ |
| Konten (intern/extern) lesen | ✅ | ✅ | ✅ | ✅ | ❌ |
| Konten anlegen/bearbeiten | ✅ | ✅ | ❌ | ❌ | ❌ |
| Buchungsjahre lesen | ✅ | ✅ | ✅ | ✅ | ❌ |
| Buchungsjahre anlegen/abschließen | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reisen lesen | ✅ | ✅ | ✅ | ✅ | ❌ |
| Reisen anlegen/verwalten | ✅ | ✅ | ✅ | ❌ | ❌ |
| Umfragen lesen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Umfragen abstimmen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Umfragen anlegen/verwalten | ✅ | ✅ | ✅ | ❌ | ❌ |
| Auswertungen/Berichte lesen | ✅ | ✅ | ✅ | ✅ | ❌ |
| Eigene Login-Daten ändern | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard/Übersicht | ✅ | ✅ | ✅ | ✅ | ✅ |

### Navigation — farbliche Unterscheidung

Menüpunkte in der Sidebar je nach Rolle farblich unterscheiden:
- **Zugängliche Punkte**: normale Farbe (aktiv, klickbar)
- **Blockierte Punkte**: grau + opacity-40, nicht klickbar (span statt Link)

Regeln je Rolle:
- `admin`: alle Punkte aktiv
- `finanzen`: alle Punkte aktiv außer Einstellungen (nur lesen) und Benutzerverwaltung (nicht sichtbar)
- `vorstand`: Buchungen/Konten/Belege/Buchungsjahre grau (nur lesen); Reisen/Umfragen aktiv
- `auditor`: alle Punkte aktiv aber read-only (Seiten selbst zeigen keine Buttons)
- `member`: nur Dashboard + Umfragen aktiv, Rest grau oder nicht sichtbar

### Eigene Profilseite /profile (fehlt noch — für alle Rollen)

Seite die JEDER Nutzer sehen und bearbeiten kann:
- Login-E-Mail ändern
- Benutzernamen ändern
- Passwort ändern (Altes Passwort + Neues Passwort + Wiederholen)
- Vereinsfunktion anzeigen (read-only — nur admin kann das ändern)
- Rolle anzeigen (read-only)

API-Routen:
- GET  /api/profile        — eigene Daten laden
- PUT  /api/profile        — E-Mail / Benutzername ändern
- POST /api/profile/password — Passwort ändern (via Better Auth)

### Einstellungsseite /settings — Sichtbarkeit je Rolle

| Block | Sichtbar für |
|---|---|
| App-Name, Vereinsname, Untertitel | nur admin |
| Modul-Toggles (an/ausschalten) | nur admin |
| E-Mail Konfiguration (SMTP) | nur admin |
| Scan-Beleg Standardverzeichnis | nur admin |

Für alle anderen Rollen: /settings zeigt nur eine Meldung
"Einstellungen können nur vom Administrator geändert werden."
Oder: /settings ist im Menü nur für admin sichtbar — member/auditor/vorstand/finanzen
werden zu /profile weitergeleitet.

### Rollen-Anzeige in der UI (ROLE_LABELS)

```ts
const ROLE_LABELS: Record<string, string> = {
  admin:    "Administrator",
  finanzen: "Finanzen",
  vorstand: "Vorstand",
  auditor:  "Kassenprüfer",
  member:   "Mitglied",
};
```

### Wichtig: Migration bestehender Rollen

Falls bereits User mit alten Rollen (board, board_1, board_2) existieren:
```sql
UPDATE "user" SET role = 'finanzen' WHERE role IN ('board', 'board_1', 'kassenwart');
UPDATE "user" SET role = 'vorstand' WHERE role = 'board_2';
```

## Aktueller Stand

### Erledigt

- Next.js Projekt mit TailwindCSS v3 + DaisyUI
- Drizzle ORM + Neon DB verbunden
- Better Auth mit 5 Rollen (admin/finanzen/vorstand/auditor/member)
- Admin-User angelegt: progdieter@dascheberg.de (Rolle: admin)
- 94 Mitglieder importiert
- Login-Seite (dynamischer App-Name + Vereinsname)
- Dashboard mit Sidebar-Navigation, kein max-w auf Content (volle Breite)
- Mitgliederverwaltung komplett (Phase 1): Suche, Formular, Detail, Bearbeiten, Export
- Members-Export-API: Alters- und Jubiläumsberechnungen via calculations.ts
- Settings-System: app_name, club_name, club_subtitle in DB
- Feature-Flags: alle Module einzeln an/abschaltbar
- Navigation reagiert auf Feature-Flags
- Einstellungsseite unter /settings (inkl. Standardverzeichnis für Scan-Belege)
- Phase 2 (komplett):
  - Externe Konten (max. 5, Typ cash/bank/savings, aktivierbar/deaktivierbar)
  - Interne Konten (flexibler Nummernkreis, Startkonfiguration importierbar)
  - Buchungsjahre: /fiscal-years (anlegen, aktivieren, schließen, Übertrag erstellen)
  - Buchungen (Doppik: ext.Konto + int.Konto, Belegnummer JJJJ-NNNN, Storno JJJJ-ST-NNN)
  - Buchungsliste mit Filtern (Jahr, ext.Konto, Richtung, BN-Suche), Zusammenfassung
  - Storno-Funktion mit ConfirmModal
  - Jahresabschluss-Prozess: Jahr abschließen → Übertrag erstellen → POST /api/fiscal-years/[id]/carry-over
  - Scan-Belege: Pfad-Erfassung (kein Upload), Badge in Buchungsliste, Übersichtsseite /receipts
- Phase 3 (teilweise):
  - Auswertungsseite /reports: Jahresfilter, Monatsdiagramm (Recharts), int./ext. Konten-Übersicht
  - Kassenbuch PDF (Landscape): 7 Spalten, Monatsabschluss-Block, Seitenumbruch nach Monat
  - Jahresabschluss PDF (Portrait): Summary-Boxen, int. Konten, ext. Konten
  - Vermögensaufstellung PDF (Portrait): ext. Kontensalden, Unterschriftzeile
  - Geburtstage & Jubiläen PDF (Portrait): runde Geburtstage (ab 70, x5), Mitgliedsjubiläen (ab 10J, x5)
  - Beitragsstand PDF (Portrait): alle aktiven Mitglieder, gruppiert bezahlt/offen
  - EÜR-Berechnungslogik: neutral-Konten korrekt in Einnahmen UND Ausgaben; transfer/cancel ausgeblendet
- CSV-Import-Modul (/settings → Tab "Daten importieren"):
  - 5-Schritt-Wizard (ImportWizard.tsx): Typ → Datei → Zuordnung → Vorschau → Ergebnis
  - Importtypen: Interne Konten, Benutzer, Mitglieder, Buchungen
  - CSV-Parser (csvParser.ts): BOM-Entfernung, Auto-Delimiter (;/,), quoted fields, applyMapping()
  - Importlogik in src/lib/utils/importAccounts.ts / importUsers.ts / importMembers.ts / importTransactions.ts
  - API: POST /api/import/preview (erste 10 Zeilen), POST /api/import/execute (vollständiger Import)
  - Ext. Konten-Hinweis in Schritt 2 (Buchungen): zeigt verfügbare Konten, Matching nach Name/sortOrder/id
  - Buchungen-Import: Belegnummern fortlaufend über getNextReceiptNumber(), kein db.transaction()
- Benutzerverwaltung /users — Phase 0.6a vollständig:
  - Suchfeld: Debounced (300ms) Namenssuche, live clientseitig
  - Sortierbuttons: Name / Freigabe / Rolle / Erstellt am (Toggle Richtung, aktiver Button btn-primary)
  - Filter-Chips: Alle / Freigeschaltet / Gesperrt (join-Gruppe, DaisyUI)
  - Alle clientseitig via useMemo — kein zusätzlicher API-Aufruf
  - Drei Passwort-Buttons je User: Reset-Mail (nur mit E-Mail, ConfirmModal) / Passwort setzen / Temp-Passwort
  - Temp-Passwort: Format 2 Großbuchstaben + 4 Ziffern + 2 Kleinbuchstaben (z.B. "AB4712cd"), EINMALIG im Modal
- Login-Seite: "Passwort vergessen" dynamisch:
  - Mit @ im Eingabefeld → Link /forgot-password sichtbar
  - Ohne @ (Benutzername) → Hinweis "Bitte den Administrator kontaktieren"
  - Nur angezeigt wenn Eingabefeld nicht leer

### Offen — Reihenfolge

- Phase 0.6b: First-Run-Assistent /setup
- Phase 0.6c: Gästeverwaltung /guests
- Phase 0.6d: Profilseite /profile (alle Rollen — eigene Login-Daten ändern)
- Sammelbuchung /transactions/sammel (Massenbuchung für Beiträge + Veranstaltungen)
- Phase 3 Rest: Dashboard-Kennzahlen, EÜR-Seite, Monatsbericht, Offene Posten, Kontenblatt
- Phase 4: Reiseverwaltung + Umfragen (selbst gebaut)
- Phase 5: CI/CD + Vercel-Deployment + Domain-Setup + SSL
- Phase 6: Tests + Testdaten
- Phase 7: PWA (next-pwa)
- Phase 8: Dokumentation

---

## Better Auth — Username-Plugin

Mitglieder ohne E-Mail-Adresse können sich per Benutzername einloggen.
E-Mail ist optional. Login-Formular zeigt "Benutzername oder E-Mail".

### Umsetzung

1. Plugin aktivieren in src/lib/auth/index.ts:
```ts
import { username } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [username()],
  // ... rest bleibt gleich
});
```

2. Spalten username, approved und function in Neon zur user-Tabelle hinzufügen:
```sql
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS username varchar(50) UNIQUE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS function varchar(100) DEFAULT 'M';
-- Bestehende Rollen migrieren falls nötig:
UPDATE "user" SET role = 'finanzen' WHERE role IN ('board', 'kassenwart');
UPDATE "user" SET approved = true WHERE role = 'admin';
```

3. Drizzle-Schema (schema.ts) — user-Tabelle ergänzen:
```ts
username: varchar("username", { length: 50 }).unique(),
approved: boolean("approved").notNull().default(false),
function: varchar("function", { length: 100 }).default("M"),
```

4. Login-Formular (src/app/login/page.tsx) anpassen:
   - Feld "Benutzername oder E-Mail" statt nur E-Mail
   - Wenn Eingabe ein @ enthält → signIn.email()
   - Sonst → signIn.username()

5. Benutzerverwaltung /users — beim Anlegen Benutzername vergeben (Pflicht wenn keine E-Mail)

### Regeln

- Benutzername: min. 3 Zeichen, nur Buchstaben/Zahlen/Punkte/Unterstriche
- E-Mail UND Benutzername können beide zum Login verwendet werden
- Wer eine E-Mail hat: Benutzername optional
- Wer keine E-Mail hat: Benutzername Pflicht
- Benutzername wird vom Admin vergeben (nicht selbst wählbar für member-Rolle)

### Login-Logik (client-seitig)

```ts
const isEmail = input.includes("@");
if (isEmail) {
  await authClient.signIn.email({ email: input, password });
} else {
  await authClient.signIn.username({ username: input, password });
}
```

---

## Genehmigungsroutine — User-Freischaltung

Jeder neue Benutzer muss durch einen Admin freigeschaltet werden bevor er
die App nutzen kann. Greift für alle Rollen außer admin.

### Workflow

```
Neuer User angelegt (durch Admin in /users)
        ↓
approved = false (Default)
        ↓
User loggt sich ein → Weiterleitung auf /pending
        ↓
Admin sieht in /users: User wartet auf Freischaltung
Admin erhält optional E-Mail via sendMail() (nodemailer)
        ↓
Admin klickt "Freischalten" → approved = true
        ↓
User kann die App normal nutzen
```

### Zwei Szenarien

| Szenario | Beschreibung |
|---|---|
| Admin legt User an + schaltet sofort frei | approved beim Anlegen direkt auf true setzen (Checkbox im Formular) |
| Admin legt User an, schaltet später frei | approved bleibt false, User wartet auf Freischaltung |

### Technische Umsetzung

SQL (bereits im Username-Plugin-Abschnitt enthalten):
```sql
ALTER TABLE "user" ADD COLUMN approved boolean NOT NULL DEFAULT false;
```

In (protected)/layout.tsx — Prüfung nach requireAuth():
```ts
const session = await requireAuth();
if (!session.user.approved && session.user.role !== 'admin') {
  redirect('/pending');
}
```

Wichtig: Admin (role = 'admin') ist immer approved — kein redirect.
Beim Anlegen des ersten Admin-Users (Setup-Wizard): approved = true setzen.

### Seite /pending (ungeschützt, kein requireAuth)

Zeigt nur eine freundliche Meldung:
- "Ihr Zugang wurde noch nicht freigeschaltet."
- "Bitte wenden Sie sich an den Kassenwart."
- Kontaktdaten des Admins (aus Settings: club_name, optional contact_email)
- Button: "Abmelden" (authClient.signOut())

### Anpassungen in /users (Phase 0.6a)

- User-Liste zeigt zusätzliche Spalte: Freigabe (✅ / ⏳)
- Badge "Wartet auf Freischaltung" bei approved = false
- Button "Freischalten" → PUT /api/users/[id] mit { approved: true }
- Button "Sperre aufheben" / "Sperren" → PUT /api/users/[id] mit { approved: false }
- Beim Anlegen neuer User: Checkbox "Sofort freischalten" (default: angehakt)
- Optional: Admin erhält E-Mail via sendMail() (nodemailer) wenn User auf Freischaltung wartet

### E-Mail-Benachrichtigung (optional, via nodemailer/sendMail)

Wenn Admin einen User anlegt ohne sofortige Freischaltung:
- E-Mail an Admin (aus settings: smtp_from oder admin_email)
- Betreff: "vkEinfach — Neuer Benutzer wartet auf Freischaltung"
- Inhalt: Name, Benutzername/E-Mail, Link zu /users

### API-Ergänzungen

- PUT /api/users/[id] — bereits geplant — ergänzen um approved-Feld
- Neues Feld in POST /api/users: approved (boolean, default false)

### Wichtige Regel

- approved-Prüfung findet IMMER serverseitig statt (layout.tsx Server Component)
- Kein Client-seitiger Bypass möglich
- Admin kann sich nicht selbst sperren (approved bleibt true für eigenen Account)

---

## E-Mail Konfiguration — SMTP (nodemailer)

vkEinfach verwendet KEIN externes E-Mail-Service wie Resend.
Jeder Verein konfiguriert seinen eigenen SMTP-Server in den Einstellungen.
Dadurch ist vkEinfach vollständig unabhängig von externen Diensten.

### Paket

```bash
npm install --legacy-peer-deps nodemailer
npm install --legacy-peer-deps -D @types/nodemailer
```

### Umgebungsvariable für Verschlüsselung

In .env.local und Vercel Environment Variables:
```
SMTP_ENCRYPTION_KEY=<32-Byte Hex-String>
```
Generieren: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Settings-Tabelle — neue Keys (SQL für Neon)

```sql
INSERT INTO settings (key, value, description) VALUES
  ('smtp_host',      '',          'SMTP-Server z.B. mail.meinverein.de'),
  ('smtp_port',      '587',       'SMTP-Port (587=STARTTLS, 465=SSL, 25=unsicher)'),
  ('smtp_user',      '',          'SMTP-Benutzername / E-Mail-Adresse'),
  ('smtp_password',  '',          'SMTP-Passwort (AES-256 verschlüsselt)'),
  ('smtp_from',      '',          'Absender-Adresse z.B. kasse@meinverein.de'),
  ('smtp_from_name', 'vkEinfach', 'Absender-Name z.B. Kassenwart Musterverein');
```

### Datei src/lib/utils/mailer.ts

```ts
import nodemailer from "nodemailer";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getSettings } from "./settings";

const ALGO = "aes-256-cbc";
const KEY = Buffer.from(process.env.SMTP_ENCRYPTION_KEY!, "hex");

export function encryptPassword(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptPassword(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGO, KEY, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export async function sendMail({
  to, subject, html, text,
}: {
  to: string; subject: string; html: string; text?: string;
}) {
  const s = await getSettings();
  if (!s.smtpHost || !s.smtpUser || !s.smtpPassword) {
    throw new Error("SMTP nicht konfiguriert. Bitte Einstellungen vervollständigen.");
  }
  const transporter = nodemailer.createTransport({
    host: s.smtpHost,
    port: Number(s.smtpPort ?? 587),
    secure: Number(s.smtpPort) === 465,
    auth: { user: s.smtpUser, pass: decryptPassword(s.smtpPassword) },
  });
  await transporter.sendMail({
    from: `"${s.smtpFromName || "vkEinfach"}" <${s.smtpFrom || s.smtpUser}>`,
    to, subject, html, text,
  });
}
```

### AppSettings Typ — Ergänzungen in src/lib/utils/settings.ts

```ts
smtpHost: string;
smtpPort: string;
smtpUser: string;
smtpPassword: string;      // verschlüsselt aus DB
smtpFrom: string;
smtpFromName: string;
smtpConfigured: boolean;   // true wenn host + user + password gesetzt
```

### Einstellungsseite /settings — neuer Block "E-Mail Konfiguration"

Neuer Abschnitt unter den Modul-Toggles:
- SMTP-Server (Textfeld)
- SMTP-Port (Textfeld + Radio: 587/465/25)
- Benutzername (Textfeld)
- Passwort (Passwortfeld — wird NIE im Klartext an Client zurückgegeben)
- Absender-Adresse (Textfeld)
- Absender-Name (Textfeld)
- Button "Verbindung testen" → POST /api/settings/test-smtp → Test-Mail an Admin
- Button "Speichern" → Passwort wird VOR dem Speichern mit encryptPassword() verschlüsselt

### API-Route POST /api/settings/test-smtp

Sendet Test-Mail an E-Mail des eingeloggten Admin-Users.
Gibt { ok: true } oder { error: "Fehlermeldung" } zurück.

### Wo sendMail() verwendet wird

- /api/users/[id]/reset-password — Temp-Passwort per Mail
- /api/setup/complete — Willkommens-Mail nach Setup (optional)
- Zukünftig: Beitragsmahnungen, Geburtstagserinnerungen (optional)

### Für Seniorenclub Schmalfeld — Konfiguration in /settings

```
SMTP-Server:     smtp.strato.de
SMTP-Port:       587
Benutzername:    kasse@scschmalfeld.org
Passwort:        <E-Mail-Passwort von Strato>
Absender:        kasse@scschmalfeld.org
Absender-Name:   Seniorenclub Schmalfeld e.V.
```

---

## Finale Architektur-Entscheidung

vkEinfach ist **Open-Source-Software** — kein gehosteter Dienst.

```
Du = Entwickler und Code-Lieferant
Jeder Verein = eigenständiger Betreiber seiner eigenen Instanz
```

### Prinzip

- Du lieferst den Code (GitHub-Repo, öffentlich oder privat)
- Jeder Verein deployt seine eigene Instanz auf eigener Infrastruktur
- Du hast NULL Zugriff auf Daten anderer Vereine
- DSGVO-Verantwortung liegt beim jeweiligen Verein
- Kosten für jeden Verein: 0€ (Vercel Free + Neon Free)

### Vollständige Kapselung — so ist es umgesetzt

```
Verein A (Seniorenclub Schmalfeld)
  GitHub: fork von dascheberg/vkEinfach
  Neon:   eigene DB (nur der Verein hat die Credentials)
  Vercel: eigenes Projekt
  URL:    app.scschmalfeld.org oder kasse.scschmalfeld.org

Verein B (Sportverein Musterhausen)
  GitHub: fork von dascheberg/vkEinfach
  Neon:   eigene DB (komplett getrennt von Verein A)
  Vercel: eigenes Projekt
  URL:    kasse.sportverein-musterhausen.de
```

Kein gemeinsamer Code-Pfad, keine gemeinsamen Daten, keine gegenseitige Beeinflussung.

### Mitglieder-Zugriff von überall

Vercel + Neon = Cloud-Deployment → Mitglieder können von jedem Gerät zugreifen.
SQLite (lokal) wäre nur für Heimnetz geeignet — wird NICHT verwendet.

### Was du konkret tust

1. Code auf GitHub pflegen (Bugfixes, neue Features)
2. README mit Installations-Anleitung
3. Setup-Wizard macht Ersteinrichtung automatisch
4. Fertig — du bist aus der Datenhaltung raus

### Was ein neuer Verein tut

1. GitHub-Repo forken (ein Klick)
2. Neon-Account anlegen (5 Min., kostenlos auf neon.tech)
3. Vercel-Account anlegen (5 Min., kostenlos auf vercel.com)
4. Umgebungsvariablen in Vercel eintragen
5. Setup-Wizard aufrufen → Vereinsname, Buchungsjahr, Konten, Admin-User
6. Optional: eigene Domain eintragen

### E-Mail — kein externer Dienst

Resend wird NICHT verwendet. Jeder Verein konfiguriert seinen eigenen
SMTP-Server in den App-Einstellungen (/settings → E-Mail Konfiguration).
Strato-Kunden: smtp.strato.de Port 587.
Details siehe Abschnitt "E-Mail Konfiguration — SMTP".

### Was noch zu tun ist für vollständige Kapselung

| Aufgabe | Status |
|---|---|
| Kein hardkodierter Vereinsname im Code | ⚠️ Bereinigen (grep-Befehle siehe unten) |
| SMTP statt Resend | 🔲 Claude Code umsetzen lassen |
| Setup-Wizard vollständig | 🔲 Phase 0.6b |
| README Installations-Anleitung | 🔲 Phase 8 |
| Alle Settings aus DB (kein .env für Vereinsdaten) | ✅ Bereits so |

Hardkodierte Vereinsnamen bereinigen:
```bash
grep -r "Seniorenclub" ~/dev/vkEinfach/src/
grep -r "Schmalfeld" ~/dev/vkEinfach/src/
grep -r "scschmalfeld" ~/dev/vkEinfach/src/
grep -r "kasse.scschmalfeld" ~/dev/vkEinfach/src/
```
Alle Treffer durch Settings-Werte ersetzen:
- club_name statt "Seniorenclub Schmalfeld e.V."
- app_name statt "vkEinfach" (hardkodiert)
- settings.smtpFrom statt "kasse@scschmalfeld.org"

---

## Multi-Instance Strategie (vkEinfach als Produkt für beliebige Vereine)

vkEinfach ist als Multi-Instance App konzipiert:
- Jeder Verein bekommt eine eigene Vercel-Deployment + eigene Neon-DB
- Kein Multi-Tenant (keine club_id in allen Tabellen) — einfacher, sicherer, isolierter
- Setup-Wizard macht Ersteinrichtung für neue Vereine möglich

### Neue Instanz für einen Verein einrichten

1. GitHub-Repo forken oder Template-Repo verwenden
2. Neue Neon-DB anlegen, Migration ausführen
3. Neues Vercel-Projekt anlegen, Umgebungsvariablen setzen
4. Subdomain einrichten (z.B. app.meinverein.de oder meinverein.vkeinfach.de)
5. https://app.meinverein.de/setup aufrufen → Wizard durchlaufen

### Wichtig: Kein hardkodierter Vereinsname

Im gesamten Code darf NIRGENDWO "Seniorenclub Schmalfeld" oder "Schmalfeld"
hardkodiert stehen — alles muss aus settings kommen (app_name, club_name).

Prüfen mit:
```bash
grep -r "Seniorenclub" ~/dev/vkEinfach/src/
grep -r "Schmalfeld" ~/dev/vkEinfach/src/
grep -r "scschmalfeld" ~/dev/vkEinfach/src/
```
Gefundene Stellen durch Settings-Werte ersetzen.

---

## Deployment — vkeinfach.de

| Eigenschaft | Wert |
|---|---|
| Produktiv-URL | https://app.vkeinfach.de |
| Vercel-Domain | app.vkeinfach.de |
| DNS bei Strato | app CNAME cname.vercel-dns.com (in vkeinfach.de DNS) |
| E-Mail Absender | konfigurierbar via SMTP in /settings |
| Resend | wird NICHT mehr verwendet — aus Vercel + .env.local entfernen |

---

## Sammelbuchung (/transactions/sammel)

Massenbuchung für wiederkehrende Zahlungen (Mitgliedsbeiträge, Veranstaltungs-Eigenanteile).
Erreichbar über Button "+ Sammelbuchung" auf der Buchungsseite neben "+ Einzelbuchung".

### UI-Konzept

```
┌─────────────────────────────────────────────┐
│  Sammelbuchung                              │
├─────────────────────────────────────────────┤
│  Datum:        [15.01.2026        ]         │
│  Ext. Konto:   [Barkasse        ▼]         │
│  Int. Konto:   [103 - Beitrag   ▼]         │
│  Betrag/Person:[30,00 €          ]         │
│  Beschreibung: [Mitgliedsbeitrag ]         │
│                                             │
│  Gesamtbetrag: [1.200,00 €  ] ← optional, zur Kontrolle
├─────────────────────────────────────────────┤
│  Personen auswählen:                        │
│  🔍 Suche...          [Alle] [Keine]        │
│                                             │
│  ☑ Müller, Hans                [Mitglied]  │
│  ☑ Schmidt, Grete              [Mitglied]  │
│  ☐ Bauer, Klaus (bereits bez.) [Mitglied]  │
│  ☑ Meier, Kurt                 [Gast]      │
├─────────────────────────────────────────────┤
│  40 Personen × 30,00 € = 1.200,00 €  ✅   │
│                                             │
│  [Abbrechen]    [Buchungen erstellen]       │
└─────────────────────────────────────────────┘
```

### Intelligente Mitgliederliste — abhängig vom internen Konto

| Internes Konto | Liste zeigt | Zusatzfeld |
|---|---|---|
| 103 (Beitrag lfd. Jahr) | Nur Mitglieder mit fee_paid_current_year = false | — |
| 104 (Beitrag nächstes Jahr) | Alle aktiven Mitglieder | — |
| 160/170 oder anderes Reise-Konto | Alle Mitglieder + Gäste | Reise-Dropdown (Pflicht) |
| 200–240 (Veranstaltungen) | Alle Mitglieder + Gäste | — |
| Alle anderen | Alle aktiven Mitglieder | — |

Bei Konto 103: bereits bezahlte Mitglieder ausgegraut und nicht wählbar.

**Reise-Konto Erkennung:** Konten deren accountKind = 'income' UND Nummer im Bereich
160–199 (konfigurierbar) gelten als Reise-Konten → Reise-Dropdown erscheint automatisch.
Alternativ: Konten die im Namen "Reise" oder "Eigenanteil" enthalten.

### Reise-Dropdown (erscheint dynamisch bei Reise-Konten)

```
Int. Konto:  [160 - Reise 1 Eigenanteil     ▼]
Reise:       [Ostseereise 2026 (15 Teiln.) ▼]  ← Pflichtfeld, erscheint automatisch
```

- Zeigt alle Reisen des aktiven Buchungsjahres mit Status 'planning' oder 'confirmed'
- Format: "Reisename (Datum)" 
- Pflichtfeld wenn Reise-Konto gewählt — Speichern ohne Auswahl nicht möglich

### Gesamtbetrag-Kontrolle

- Gesamtbetrag-Feld ist optional (kein Pflichtfeld)
- Wenn ausgefüllt: muss exakt mit (Anzahl × Betrag/Person) übereinstimmen
- Grün ✅ wenn Übereinstimmung, Rot ❌ bei Abweichung
- Bei Abweichung: Speichern nicht möglich bis Korrektur

```
Eingabe:          1.200,00 €
Berechnet:        1.200,00 €  ✅ — Buchungen erstellen möglich
Eingabe:          1.100,00 €
Berechnet:        1.200,00 €  ❌ — Abweichung 100,00 €, Speichern gesperrt
```

### Was im Hintergrund passiert (Option A — separate Buchungen)

- Je gewählter Person wird eine eigene Buchung angelegt
- Gleiche Felder für alle: Datum, Betrag, Ext.Konto, Int.Konto, Beschreibung
- Unterschiedlich je Buchung: member_id oder guest_id, receipt_number (fortlaufend)
- Belegnummern fortlaufend: 2026-0041, 2026-0042, ... 2026-0080
- Kein db.transaction() — sequenzielle Inserts in try-catch (Neon HTTP-Treiber!)

### Automatische Statusupdates nach Buchungserstellung

| Konto | Automatische Aktion |
|---|---|
| 103 (Beitrag lfd. Jahr) | fee_paid_current_year = true für alle gewählten Mitglieder |
| Reise-Konto (160/170 etc.) | travel_participants: upsert mit is_registered = true, is_paid = true |
| Alle anderen | Kein automatischer Status-Update |

#### Reise-Konto: Upsert-Logik in travel_participants

Für jede gewählte Person bei Reise-Konto:

```
Person bereits in travel_participants für diese Reise?
        ↓
   JA  → UPDATE: is_paid = true, paid_at = heute
        ↓
   NEIN → INSERT: is_registered = true, is_paid = true,
                  paid_at = heute, registered_at = heute
          (Person wird automatisch zur Reise angemeldet UND als bezahlt markiert)
```

```ts
for (const person of selectedParticipants) {
  // 1. Buchung anlegen
  await createTransaction({ ...bookingData, memberId: person.memberId });

  // 2. travel_participants upsert
  const existing = await db.query.travelParticipants.findFirst({
    where: and(
      eq(travelParticipants.travelId, selectedTravelId),
      person.memberId
        ? eq(travelParticipants.memberId, person.memberId)
        : eq(travelParticipants.guestId, person.guestId)
    )
  });

  if (existing) {
    await db.update(travelParticipants)
      .set({ isPaid: true, paidAt: new Date() })
      .where(eq(travelParticipants.id, existing.id));
  } else {
    await db.insert(travelParticipants).values({
      travelId: selectedTravelId,
      memberId: person.memberId ?? null,
      guestId: person.guestId ?? null,
      isRegistered: true,
      isPaid: true,
      paidAt: new Date(),
    });
  }
}
```

Hinweis: Kein db.transaction() — sequenzielle Ausführung in try-catch (Neon HTTP-Treiber!)

### API-Route

POST /api/transactions/sammel

Request:
```ts
{
  date: string,
  externalAccountId: number,
  internalAccountId: number,
  amountPerPerson: number,
  description: string,
  totalAmount?: number,        // optional, nur zur Validierung
  travelId?: number,           // Pflicht wenn Reise-Konto gewählt
  participants: {
    memberId?: number,
    guestId?: number,
  }[]
}
```

Response:
```ts
{
  created: number,             // Anzahl erstellter Buchungen
  totalAmount: number,         // Gesamtbetrag
  receiptNumbers: string[],    // alle vergebenen Belegnummern
  statusUpdates: {
    feesPaid?: number,         // Mitglieder deren Beitrag auf bezahlt gesetzt wurde
    travelRegistered?: number, // neu zur Reise angemeldete Personen
    travelPaid?: number,       // Teilnehmer deren Reisezahlung auf bezahlt gesetzt wurde
  }
}
```

### Sichtbarkeit

Nur für Rollen: admin, finanzen
Nicht sichtbar für: vorstand, auditor, member

---

## CSV-Import Modul (/settings → Tab "Daten importieren")

Nur für Rolle `admin` sichtbar. Neuer Tab auf der Einstellungsseite.

### Ablauf (immer gleich, 5 Schritte)

```
1. Import-Typ wählen (Konten / Benutzer / Mitglieder / Buchungen)
2. CSV-Datei hochladen
3. Spalten-Mapping: welche CSV-Spalte → welches App-Feld
4. Vorschau: erste 5 Zeilen, Fehler markiert
5. Import starten → Ergebnis anzeigen
```

### Allgemeine Regeln für alle Import-Typen

- Trennzeichen: Semikolon `;`
- Erste Zeile: Header (wird übersprungen)
- Encoding: UTF-8 (mit oder ohne BOM — BOM wird automatisch entfernt)
- Leere Zeilen werden übersprungen
- Betrag: Dezimalpunkt ODER Komma erlaubt (30.00 oder 30,00)
- Datum: DD.MM.JJJJ
- Boolean: ja/nein, true/false, 1/0 — alles erlaubt
- Doppelte werden IMMER übersprungen (nie überschreiben)
- Kein db.transaction() — sequenzielle Inserts in try-catch

### Mapping-UI

Dropdown je App-Feld mit allen CSV-Spalten als Optionen + "-- ignorieren".
Pflichtfelder mit * markiert. "Weiter" nur wenn alle Pflichtfelder gemappt.

### Vorschau

Erste 5 Zeilen anzeigen:
- ✅ = importierbar
- ⚠ = importierbar mit Warnung (fehlende optionale Felder)
- ❌ = wird übersprungen (Duplikat oder Pflichtfeld fehlt)
Zusammenfassung: "X importierbar, Y mit Warnung, Z übersprungen"

---

### Import-Typ 1: Interne Konten

**Duplikat-Erkennung:** Kontonummer bereits vorhanden → überspringen

| App-Feld | Pflicht | Erlaubte Werte |
|---|---|---|
| Kontonummer | ✅ | Zahl 1-9999 |
| Bezeichnung | ✅ | Text max. 150 Zeichen |
| Typ | ❌ | income/expense/neutral/transfer/cancel (Default: neutral) |

Beispiel-CSV:
```
nummer;bezeichnung;typ
100;Übertrag Vorjahr Konto;income
103;Beitrag laufendes Jahr;income
200;Ausgaben Kaffeenachmittag;expense
997;Umbuchung Spar/Konto;transfer
999;Storno;cancel
```

---

### Import-Typ 2: Benutzer

Benutzername wird IMMER automatisch generiert: vorname.nachname
(Umlaute: ä→ae, ö→oe, ü→ue, ß→ss, alles klein)
Bei Duplikaten: Nummer anhängen (hans.mueller2, hans.mueller3)
E-Mail ist optional — kein Pflichtfeld.
Passwort-Default: vorname24640

**Duplikat-Erkennung:** Benutzername vorname.nachname bereits vorhanden → überspringen

Praktisch: Mitglieder-CSV kann direkt als Benutzer-CSV verwendet werden!

| App-Feld | Pflicht | Hinweis |
|---|---|---|
| Nachname | ✅ | Für Benutzername-Generierung |
| Vorname | ✅ | Für Benutzername + Passwort |
| E-Mail | ❌ | Optional |
| Passwort | ❌ | Default: vorname24640 |
| Rolle | ❌ | Default: member. Erlaubt: admin/finanzen/vorstand/auditor/member |
| Funktion | ❌ | Default: M. Erlaubt: M/1.V/2.V/KW/SW/KS/B1/B2/B3/KP1/KP2 |

Nach Import: approved = true (automatisch freigeschaltet)
Fake-E-Mail wenn keine E-Mail: vorname.nachname@intern.vkeinfach.local

Beispiel-CSV:
```
nachname;vorname;rolle;funktion
Müller;Hans;member;M
Schmidt;Grete;finanzen;KW
Bauer;Klaus;auditor;KP1
```

---

### Import-Typ 3: Mitglieder

**Duplikat-Erkennung:** Nachname + Vorname + Geburtsdatum bereits vorhanden → überspringen
Wenn kein Geburtsdatum: nur Nachname + Vorname prüfen

| App-Feld | Pflicht | Format |
|---|---|---|
| Nachname | ✅ | Text |
| Vorname | ✅ | Text |
| Straße | ❌ | Text |
| PLZ | ❌ | Text |
| Ort | ❌ | Text |
| Geburtsdatum | ❌ | DD.MM.JJJJ |
| Telefon Festnetz | ❌ | Text |
| Telefon Mobil | ❌ | Text |
| E-Mail | ❌ | Text |
| Funktion | ❌ | M/1.V/2.V/KW/SW/KS/B1/B2/B3/KP1/KP2 (Default: M) |
| Eingetreten am | ❌ | DD.MM.JJJJ |
| Aktiv | ❌ | ja/nein/true/false/1/0 (Default: true) |
| Beitrag bezahlt | ❌ | ja/nein/true/false/1/0 (Default: false) |
| Bemerkungen | ❌ | Text |

Beispiel-CSV:
```
nachname;vorname;geburtsdatum;strasse;plz;ort;eingetreten
Müller;Hans;15.03.1952;Dorfstr. 1;24640;Schmalfeld;01.01.2015
Schmidt;Grete;22.07.1948;Hauptstr. 5;24640;Schmalfeld;01.01.2010
```

---

### Import-Typ 4: Buchungen

**Duplikat-Erkennung:** Belegnummer bereits vorhanden → überspringen
Wenn keine Belegnummer in CSV: wird automatisch vergeben (nie Duplikat)

| App-Feld | Pflicht | Format |
|---|---|---|
| Datum | ✅ | DD.MM.JJJJ |
| Betrag | ✅ | Dezimal (30.00 oder 30,00) — immer positiv |
| Richtung | ✅ | in/out oder E/A oder Einnahme/Ausgabe |
| Externes Konto | ✅ | Name des Kontos ODER Sortier-Nummer (1-5) |
| Internes Konto | ✅ | Kontonummer (100-999) |
| Beschreibung | ❌ | Text |
| Belegnummer | ❌ | JJJJ-NNNN (sonst automatisch vergeben) |
| Mitglied Nachname | ❌ | Text — wird per Nachname+Vorname gesucht |
| Mitglied Vorname | ❌ | Text |

Buchungsjahr: wird aus dem Datum der Buchung ermittelt.
Wenn kein Buchungsjahr für das Jahr existiert → Warnung, Buchung trotzdem importieren.

Beispiel-CSV:
```
datum;betrag;richtung;ext_konto;int_konto;beschreibung;belegnummer;mitglied_nachname;mitglied_vorname
03.01.2026;30.00;in;1;103;Mitgliedsbeitrag;2026-0001;Müller;Hans
05.01.2026;250.00;out;1;200;Kaffeenachmittag;2026-0002;;
```

---

### API-Routen CSV-Import

- POST /api/import/preview  — CSV parsen, Mapping anwenden, Vorschau zurückgeben
- POST /api/import/execute  — Import durchführen, Ergebnis zurückgeben

Request:
```ts
{
  type: 'accounts' | 'users' | 'members' | 'transactions',
  csvContent: string,
  mapping: { [appField: string]: string | null }
}
```

Response execute:
```ts
{
  imported: number,
  skipped: number,
  warnings: number,
  errors: number,
  details: {
    row: number,
    status: 'imported' | 'skipped' | 'warning' | 'error',
    message: string
  }[]
}
```

### Dateistruktur CSV-Import

```
src/app/(protected)/settings/page.tsx  <- neuer Tab "Daten importieren"
src/app/api/import/
  preview/route.ts
  execute/route.ts
src/lib/utils/
  csvParser.ts          <- CSV einlesen, BOM entfernen, Mapping anwenden
  importAccounts.ts     <- Import interne Konten
  importUsers.ts        <- Import Benutzer (inkl. Benutzername-Generierung)
  importMembers.ts      <- Import Mitglieder
  importTransactions.ts <- Import Buchungen
```

---

### Was die Seite kann

- Liste aller User: Name, E-Mail, Benutzername, Rolle, Funktion, Freigabe-Status, Erstellt am
- Neuen User anlegen:
  - Name (Pflicht)
  - E-Mail (optional wenn Benutzername gesetzt)
  - Benutzername (Pflicht wenn keine E-Mail)
  - Passwort (Einmalpasswort)
  - Rolle wählen: admin / finanzen / vorstand / auditor / member
  - Vereinsfunktion: Checkboxen (Mehrfachauswahl): M / 1.V / 2.V / KW / SW / KS / B1 / B2 / B3 / KP1 / KP2
  - Checkbox "Sofort freischalten" (approved = true)
- Rolle ändern: Dropdown
- Vereinsfunktion ändern: Checkboxen
- User freischalten / sperren (approved true/false)
- User deaktivieren / reaktivieren (kein Löschen — Datenschutz)
- Passwort-Optionen (alle nur für admin, kein confirm() — eigenes Modal):
  a) "Reset-Mail senden" — nur wenn User eine E-Mail hat
  b) "Passwort setzen" — Admin gibt neues Passwort direkt ein (min. 8 Zeichen, kein altes nötig)
  c) "Temp-Passwort" — generiert zufälliges Passwort (2 Großbuchstaben + 4 Zahlen + 2 Kleinbuchstaben, z.B. "AB4712cd"), setzt es sofort, zeigt es EINMALIG im Modal an mit Hinweis "Bitte dem Mitglied telefonisch mitteilen"

### Passwort-Problem ohne E-Mail

Wenn ein Mitglied kein E-Mail hat und sein Passwort vergessen hat:
- "Passwort vergessen" auf Login-Seite funktioniert nicht (keine E-Mail)
- Lösung: Admin nutzt "Temp-Passwort" Button → teilt es telefonisch mit
- Mitglied loggt sich ein → ändert Passwort in /profile

"Passwort vergessen" auf Login-Seite (umgesetzt in src/app/login/page.tsx):
- Eingabefeld enthält @: Link "Passwort vergessen?" → /forgot-password anzeigen
- Eingabefeld ohne @ (Benutzername): grauer Text "Passwort vergessen? Bitte den Administrator kontaktieren."
- Eingabefeld leer: gar nichts anzeigen
- isEmail = identifier.includes("@") wird auf Komponentenebene berechnet (reaktiv)

### Rollen-Anzeige in der UI (ROLE_LABELS)

| DB-Rolle | Anzeige         |
| -------- | --------------- |
| admin    | Administrator   |
| finanzen | Finanzen        |
| vorstand | Vorstand        |
| auditor  | Kassenprüfer    |
| member   | Mitglied        |

### Better Auth API-Aufrufe (serverseitig in API-Routen)

- User anlegen: auth.api.signUpEmail({ body: { name, email, password } }) dann UPDATE "user" SET role = X
- Rolle ändern: UPDATE "user" SET role = X WHERE id = Y (direkt via Drizzle)
- User deaktivieren: Feld banned = true in Better Auth ODER eigenes Feld in user-Tabelle
- Passwort setzen/zurücksetzen: hashPassword(pw) aus better-auth/crypto → db.update(account).set({ password: hashed }).where(eq(account.userId, id), eq(account.providerId, "credential"))
- Reset-Mail: Temp-Passwort generieren → hashen → DB setzen → sendMail() via nodemailer

### Hinweis zu Better Auth user-Tabelle

Die user-Tabelle liegt in Neon und ist im Drizzle-Schema als schema.user definiert.
Rolle wird als text-Feld role gespeichert. Direkter Drizzle-Zugriff ist erlaubt für
Admin-Operationen (Rolle setzen, User auflisten).

### API-Routen

- GET  /api/users                          — alle User auflisten (nur admin)
- POST /api/users                          — neuen User anlegen (nur admin)
- PUT  /api/users/[id]                     — Rolle ändern / deaktivieren (nur admin)
- POST /api/users/[id]/reset-password      — Temp-Passwort per E-Mail senden (nur wenn E-Mail vorhanden)
- POST /api/users/[id]/set-password        — Passwort direkt setzen (Admin gibt neues Passwort ein)
- POST /api/users/[id]/temp-password       — Zufälliges Temp-Passwort generieren + setzen, zurückgeben

### Sicherheit

- Alle /api/users-Routen prüfen requireAuth() + role === 'admin'
- Kein User kann seine eigene Rolle ändern oder sich selbst deaktivieren
- Passwörter werden NIE im Klartext gespeichert (Better Auth übernimmt Hashing)

---

## Phase 0.6d — Profilseite (/profile)

Für ALLE Rollen zugänglich — jeder Nutzer kann seine eigenen Login-Daten ändern.
Menüpunkt "Mein Profil" erscheint für alle Rollen in der Navigation (unten, neben Abmelden).

### Was die Seite zeigt

- Name (read-only — nur admin kann Namen ändern)
- Benutzername (änderbar)
- E-Mail (änderbar)
- Vereinsfunktion (read-only — nur admin kann das ändern)
- Rolle (read-only, in Klartext: "Finanzen", "Mitglied" usw.)
- Passwort ändern (separater Block): Altes Passwort + Neues Passwort + Wiederholen

### API-Routen

- GET  /api/profile           — eigene User-Daten laden (aus Session)
- PUT  /api/profile           — Benutzername / E-Mail ändern
- POST /api/profile/password  — Passwort ändern (Better Auth)

### Regeln

- Jeder User sieht nur seine eigenen Daten
- Benutzername muss eindeutig bleiben (Prüfung vor Speichern)
- E-Mail muss eindeutig bleiben (Prüfung vor Speichern)
- Passwort-Änderung erfordert altes Passwort zur Verifikation
- Kein Zugriff auf andere User-Daten

---

Einmalige Einrichtung beim ersten Start einer frischen Installation.
Danach dauerhaft deaktiviert (settings-Key setup_complete = 'true').

### Erkennung ob Setup nötig

In (protected)/layout.tsx (Server Component):
- getSettings() aufrufen
- Wenn settings.setupComplete !== 'true' → redirect('/setup')
- /setup ist NICHT geschützt durch requireAuth (muss vor Login erreichbar sein)
- ABER: /setup prüft selbst ob bereits ein admin-User existiert
  - Kein admin vorhanden → Setup-Wizard anzeigen
  - Admin vorhanden aber setup_complete fehlt → direkt Schritt 3 (Grundkonfiguration)

### Setup-Schritte (Wizard mit Fortschrittsanzeige)

Schritt 1 — Willkommen & Admin-Account anlegen
  - Nur angezeigt wenn noch kein User in der DB existiert
  - Felder: App-Name, Vereinsname, Untertitel
  - Admin-Name, Admin-E-Mail, Passwort, Passwort wiederholen
  - POST /api/setup/admin → legt User an, setzt Rolle admin, speichert App-Settings

Schritt 2 — Erstes Buchungsjahr anlegen
  - Felder: Bezeichnung (z.B. "2026"), Von-Datum, Bis-Datum
  - Wird sofort als aktives Jahr gesetzt (is_active = true)
  - POST /api/setup/fiscal-year

Schritt 3 — Externe Konten anlegen
  - Mindestens 1 Konto (Barkasse) ist Pflicht
  - Bis zu 5 Konten, Name + Typ (cash/bank/savings)
  - POST /api/setup/accounts

Schritt 4 — Interne Konten
  - Drei Optionen zur Auswahl:
    a) Startkonfiguration "Seniorenclub" (39 Konten, Ausflüge/Reisen/Vereinsleben)
    b) Startkonfiguration "Allgemein klein" (33 Konten, generisch für beliebige Vereine)
    c) CSV-Import (eigener, bereits individualisierter Kontenrahmen hochladen)
  - CSV-Format: nummer;bezeichnung;typ (Semikolon-getrennt)
  - Erlaubte Typen: income, expense, neutral, transfer, cancel
  - Nach Import: Vorschau der Konten vor dem Speichern
  - POST /api/setup/internal-accounts

Schritt 5 — Fertig
  - Zusammenfassung was angelegt wurde
  - settings-Key setup_complete auf 'true' setzen
  - Button: "Zur Anwendung" → redirect /dashboard

### Settings-Key

setup_complete = 'false' (default)
setup_complete = 'true'  (nach Abschluss des Wizards)

INSERT INTO settings (key, value, description) VALUES
  ('setup_complete', 'false', 'Ersteinrichtung abgeschlossen');

### API-Routen für Setup

- POST /api/setup/admin               — Admin + App-Settings anlegen
- POST /api/setup/fiscal-year         — Erstes Buchungsjahr
- POST /api/setup/accounts            — Externe Konten
- POST /api/setup/internal-accounts   — Interne Konten (Bulk oder leer)
- POST /api/setup/complete            — setup_complete auf true setzen

Alle /api/setup-Routen sind NICHT durch requireAuth geschützt,
prüfen aber ob setup_complete bereits true ist — wenn ja: 403 zurückgeben.

---

## Phase 0.6c — Gästeverwaltung (/guests)

Voraussetzung für Phase 4 (Reiseverwaltung). Gäste sind keine Vereinsmitglieder,
können aber an Reisen teilnehmen. Werden nicht in Mitglieder-Auswertungen einbezogen.

### Tabelle guests (bereits in DB angelegt)

id, last_name, first_name, contact_info (Freitext: Tel/E-Mail/Adresse), notes, created_at

### Was die Seite kann

- Liste aller Gäste: Name, Kontaktinfo, Bemerkungen
- Gast anlegen / bearbeiten
- Gast löschen (nur wenn keine Reise-Teilnahme vorhanden)
- Suche nach Name

### API-Routen

- GET    /api/guests        — alle Gäste
- POST   /api/guests        — neuen Gast anlegen
- PUT    /api/guests/[id]   — Gast bearbeiten
- DELETE /api/guests/[id]   — Gast löschen (nur wenn keine Reise-Teilnahme)

---

## Phase 3 Rest — Auswertungen Ergänzungen

Umsetzungsreihenfolge für Claude Code:
1. Dashboard-Kennzahlen + Altersdiagramm
2. EÜR-Seite
3. Offene Posten
4. Kontenblatt
5. Monatsbericht
6. PDF-Export für alle neuen Seiten

---

### 3.1 Dashboard-Startseite (/dashboard) — Kennzahlen + Altersverteilung

#### Obere Reihe — 4 Kennzahlen-Cards

| Card | Datenquelle | Inhalt |
|---|---|---|
| Mitglieder | members WHERE is_active = true | "93 aktiv — Ø Alter: 71 Jahre" |
| Offene Beiträge | members WHERE is_active AND NOT fee_paid_current_year | "12 noch nicht bezahlt" |
| Kassenstand | SUM aus transactions WHERE fiscal_year_id = aktiv | "4.823,50 € gesamt" |
| Nächster Geburtstag | members, nächste 30 Tage nach Monat+Tag | "Müller, Hans — 15.07. (72 Jahre)" |

Durchschnittsalter berechnen:
```ts
const avgAge = Math.round(members.reduce((sum, m) => sum + calcAge(m.birthDate), 0) / members.length);
```

#### Mittlerer Bereich — Altersverteilung (Recharts BarChart)

Altersgruppen in 5-Jahres-Schritten von 60 bis 110+:
- Gruppen: "60–64", "65–69", "70–74", "75–79", "80–84", "85–89", "90–94", "95–99", "100+"
- X-Achse: Altersgruppe, Y-Achse: Anzahl Mitglieder
- Tooltip: "3 Mitglieder im Alter 70–74"
- Unter dem Chart: Zeile mit Statistik:
  "Mitglieder: 93 — Durchschnittsalter: 71 Jahre — Jüngstes Mitglied: 62 — Ältestes Mitglied: 89"
- Nur aktive Mitglieder mit bekanntem Geburtsdatum einbeziehen

Gruppierungslogik:
```ts
const groups: Record<string, number> = {
  "60–64": 0, "65–69": 0, "70–74": 0, "75–79": 0,
  "80–84": 0, "85–89": 0, "90–94": 0, "95–99": 0, "100+": 0
};
members.forEach(m => {
  const age = calcAge(m.birthDate);
  if (age < 60) return; // unter 60 nicht anzeigen
  const key = age >= 100 ? "100+" : `${Math.floor(age/5)*5}–${Math.floor(age/5)*5+4}`;
  if (groups[key] !== undefined) groups[key]++;
});
```

#### Unterer Bereich — zwei Spalten

Links: Einnahmen vs. Ausgaben laufendes Jahr
- Kleines Recharts BarChart nach Monat (Jan–Dez)
- Zwei Balken je Monat: Einnahmen (grün) / Ausgaben (rot)
- Daten aus transactions WHERE fiscal_year_id = aktives Jahr

Rechts: Nächste Geburtstage
- Liste der nächsten 5 Geburtstage in den kommenden 30 Tagen
- Anzeige: Name, Datum, wird X Jahre alt
- Geburtstag berechnen nach Monat+Tag unabhängig vom Jahr

#### API-Route

GET /api/dashboard — gibt zurück:
```ts
{
  memberCount: number,
  avgAge: number,
  minAge: number,
  maxAge: number,
  ageGroups: { label: string; count: number }[],
  openFees: number,
  totalBalance: number,
  upcomingBirthdays: { name: string; date: string; age: number }[],
  monthlyChart: { month: string; income: number; expense: number }[]
}
```

---

### 3.2 EÜR-Seite (/reports/euer)

Einnahmen-Überschuss-Rechnung — wichtigste Auswertung für Kassenwart und Kassenprüfer.

#### Layout

Filter oben: Buchungsjahr (Dropdown, default: aktives Jahr)

Zwei Spalten nebeneinander:

```
EINNAHMEN                              AUSGABEN
─────────────────────────────          ─────────────────────────────
Beiträge lfd. Jahr    1.860,00 €      Kaffeenachmittage    320,00 €
Spenden                 250,00 €      Grillfest            480,00 €
Zuschuss Gemeinde       500,00 €      Ehrungen             150,00 €
Verkauf Getränke        180,00 €      Sonstige Ausgaben     95,00 €
─────────────────────────────          ─────────────────────────────
Summe Einnahmen       2.790,00 €      Summe Ausgaben     1.045,00 €

             Überschuss: 1.745,00 €
          (bzw. Fehlbetrag wenn negativ)
```

#### Regeln

- accountKind = 'income': Einnahmen-Spalte zeigt SUM(direction='in'); NICHT in Ausgaben
- accountKind = 'expense': Ausgaben-Spalte zeigt SUM(direction='out'); NICHT in Einnahmen
- accountKind = 'neutral': Einnahmen wenn SUM(direction='in') > 0; Ausgaben wenn SUM(direction='out') > 0 — kann in BEIDEN Spalten erscheinen (z.B. Kassendifferenzen)
- accountKind = 'transfer' oder 'cancel': NICHT anzeigen (in WHERE-Filter ausgeschlossen)
- Konten mit 0€ in der jeweiligen Richtung nicht anzeigen (keine Nullzeilen)
- Summe Einnahmen = income.totalIn + neutral.totalIn; Summe Ausgaben = expense.totalOut + neutral.totalOut
- Überschuss = Summe Einnahmen − Summe Ausgaben (grün wenn ≥ 0, rot wenn negativ)
- Konten nach Nummer aufsteigend sortieren
- PDF-Button: Portrait-PDF mit Vereinsname + Geschäftsjahr + Erstellungsdatum + Unterschriftzeile

#### API-Route

GET /api/reports/euer?fiscalYearId=X — gibt zurück:
```ts
{
  income: { accountNumber: number; accountName: string; total: number }[],
  expense: { accountNumber: number; accountName: string; total: number }[],
  totalIncome: number,
  totalExpense: number,
  surplus: number  // positiv = Überschuss, negativ = Fehlbetrag
}
```

---

### 3.3 Offene Posten (/reports/open-items)

Mitglieder die im aktiven Jahr den Beitrag noch nicht bezahlt haben.

#### Layout

Überschrift: "Offene Beiträge 2026 — Stand: 26.06.2026"

Tabelle:

| Name | Eingetreten | Mitgliedsjahre | Funktion |
|---|---|---|---|
| Bauer, Gertrud | 01.01.2015 | 11 Jahre | M |
| Fischer, Klaus | 01.03.2019 | 7 Jahre | M |

Fußzeile: "12 Mitglieder mit offenem Beitrag"
Optional: "Gesamtbetrag: 240,00 €" wenn settings-Key member_fee vorhanden

#### Regeln

- Nur aktive Mitglieder (is_active = true)
- Nur Mitglieder mit fee_paid_current_year = false
- Sortierung: Nachname alphabetisch
- PDF-Button: Portrait-PDF als druckbare Mahnliste

#### Settings-Key (optional)

member_fee = "20.00" (Beitragshöhe in Euro, für Gesamtbetragsberechnung)
In settings-Tabelle eintragen wenn gewünscht.

#### API-Route

GET /api/reports/open-items — gibt zurück:
```ts
{
  members: {
    id: number; lastName: string; firstName: string;
    joinedAt: string; yearsOfMembership: number; function: string
  }[],
  count: number,
  totalAmount: number | null  // null wenn member_fee nicht in Settings
}
```

---

### 3.4 Kontenblatt (/reports/account-ledger)

Alle Buchungen zu einem bestimmten internen Konto — nützlich für Kassenprüfer.

#### Layout

Filter oben: Internes Konto (Dropdown, Kontonummer + Name) + Buchungsjahr

```
Kontenblatt: 103 — Beitrag laufendes Jahr  |  2026

Datum        Belegnr.     Beschreibung           Einnahme    Ausgabe    Saldo
─────────────────────────────────────────────────────────────────────────────
03.01.2026   2026-0001    Beitrag Müller H.       20,00 €               20,00 €
03.01.2026   2026-0002    Beitrag Schmidt G.      20,00 €               40,00 €
05.01.2026   2026-0003    Beitrag Fischer K.      20,00 €               60,00 €
...
─────────────────────────────────────────────────────────────────────────────
Summe Einnahmen: 1.860,00 €   Summe Ausgaben: 0,00 €   Endsaldo: 1.860,00 €
```

#### Regeln

- Saldo kumuliert (einzige Stelle in vkEinfach wo kumulierter Saldo sinnvoll ist)
- Sortierung: Buchungsdatum aufsteigend, dann Belegnummer
- Stornierte Buchungen mit Hinweis "(storniert)" anzeigen
- PDF-Button: Landscape-PDF

#### API-Route

GET /api/reports/account-ledger?internalAccountId=X&fiscalYearId=Y — gibt zurück:
```ts
{
  account: { number: number; name: string },
  fiscalYear: { label: string },
  entries: {
    date: string; receiptNumber: string; description: string;
    income: number | null; expense: number | null; runningBalance: number
  }[],
  totalIncome: number,
  totalExpense: number,
  finalBalance: number
}
```

---

### 3.5 Monatsbericht (/reports/monthly)

Zusammenfassung eines einzelnen Monats.

#### Layout

Filter oben: Jahr (Dropdown) + Monat (Dropdown Jan–Dez)

```
Monatsbericht Juni 2026  —  Seniorenclub Schmalfeld e.V.
──────────────────────────────────────────────────────────
Einnahmen                                      1.240,00 €
Ausgaben                                         380,00 €
──────────────────────────────────────────────────────────
Überschuss / Fehlbetrag                          860,00 €

Kontostand je Kasse am Monatsende:
  Barkasse                                       420,00 €
  Konto Bank A                                 4.823,50 €
  ──────────────────────────────────────────────────────
  Summe                                        5.243,50 €

Buchungen dieses Monats (12):
Datum        Belegnr.    Beschreibung         Konto   Einnahme   Ausgabe
────────────────────────────────────────────────────────────────────────
03.06.2026   2026-0041   Beitrag Meier         103     20,00 €
...
```

#### Regeln

- Kontostand am Monatsende = alle Buchungen von Jahresbeginn bis Monatsende
- Buchungsliste kompakt (kein kumulierter Saldo hier)
- PDF-Button: Portrait-PDF

#### API-Route

GET /api/reports/monthly?year=2026&month=6 — gibt zurück:
```ts
{
  totalIncome: number,
  totalExpense: number,
  surplus: number,
  accountBalances: { name: string; balance: number }[],
  totalBalance: number,
  entries: {
    date: string; receiptNumber: string; description: string;
    internalAccountNumber: number; income: number | null; expense: number | null
  }[]
}
```

---

---

## Phase 4 — Reiseverwaltung (/travel)

Umfragen werden selbst gebaut (keine externe Library) — Tabellen surveys,
survey_options, survey_votes bereits im Schema vorhanden.

### Datenmodell — Ergänzungen zur bestehenden travels-Tabelle

Die travels-Tabelle muss um folgende Felder ergänzt werden:

| Neues Feld       | Typ        | Beschreibung                       |
| ---------------- | ---------- | ---------------------------------- |
| date_from        | date       | Reisebeginn                        |
| date_to          | date       | Reiseende                          |
| min_participants | integer    | Mindestanzahl Teilnehmer           |
| max_participants | integer    | Maximale Anzahl Teilnehmer         |
| description      | text       | Kurzbeschreibung der Veranstaltung |
| fiscal_year_id   | integer FK | Zuordnung zum Buchungsjahr         |

Bestehende Felder bleiben: name, total_cost, own_contribution, status, notes.

### Datenmodell — Ergänzungen zur travel_participants-Tabelle

| Neues Feld    | Typ                   | Beschreibung |
| ------------- | --------------------- | ------------ |
| is_registered | boolean DEFAULT true  | Angemeldet   |
| is_paid       | boolean DEFAULT false | Bezahlt      |

Bestehende Felder paid_amount und paid_at bleiben (ergänzend).
Regel: member_id ODER guest_id gesetzt — nie beide (CHECK-Constraint bleibt).

### Status-Werte für travels

- planning   — in Planung
- confirmed  — bestätigt (Mindestanzahl erreicht)
- completed  — abgeschlossen
- cancelled  — abgesagt

### Seitenstruktur

```
/travel                      Übersicht aller Reisen im aktiven/gewählten Geschäftsjahr
/travel/neu                  Neue Reise anlegen
/travel/[id]                 Reise-Detail: Info-Block + Teilnehmerliste
/travel/[id]/bearbeiten      Reise bearbeiten
/travel/surveys              Umfragen-Übersicht
/travel/surveys/neu          Neue Umfrage anlegen
/travel/surveys/[id]         Abstimmung + Auswertung
```

### Übersichtsseite /travel

Tabelle mit einer Zeile pro Reise, gefiltert nach Geschäftsjahr (Dropdown):

| Spalte             | Inhalt                                           |
| ------------------ | ------------------------------------------------ |
| Veranstaltung      | Name + Status-Badge (geplant/bestätigt/etc.)     |
| Zeitraum           | 15.06.–18.06.2026                                |
| Min / Max          | 20 / 40                                          |
| Angemeldet         | 27 (COUNT aus travel_participants)               |
| Noch nicht bezahlt | 8 (angemeldet minus bezahlt)                     |
| Aktionen           | Detail / Bearbeiten                              |

### Formular neue/bearbeitete Reise

Felder:
- Name der Veranstaltung (Pflicht)
- Datum von / Datum bis
- Mindestanzahl Teilnehmer / Maximale Anzahl Teilnehmer
- Preis pro Teilnehmer (own_contribution)
- Gesamtkosten (total_cost, optional)
- Kurze Beschreibung
- Status (Dropdown)
- Buchungsjahr (aus fiscal_years, default: aktives Jahr)
- Bemerkungen

### Detail-Seite /travel/[id]

OBERER BEREICH — Reise-Info:
- Alle Felder anzeigen (Name, Zeitraum, Beschreibung, Preis, Status)
- Fortschrittsbalken: Angemeldete / Max. Teilnehmer (z.B. 27/40)
- Kennzahlen-Cards: Angemeldet | Bezahlt | Noch offen | Einnahmen gesamt
- Button: Bearbeiten (nur admin)

UNTERER BEREICH — Teilnehmerliste:

| Name         | Typ      | Angemeldet | Bezahlt  | Aktionen |
| ------------ | -------- | ---------- | -------- | -------- |
| Müller, Hans | Mitglied | Checkbox   | Checkbox | Entfernen|
| Meier, Kurt  | Gast     | Checkbox   | Checkbox | Entfernen|

- Checkboxen direkt togglebar (PATCH /api/travel/[id]/participants/[pid])
- Entfernen mit ConfirmModal (nur admin)
- Oberhalb: Teilnehmer hinzufügen

### Teilnehmer hinzufügen

- Suchfeld: sucht gleichzeitig in members UND guests (nach Name)
- Ergebnis: Name, Typ (Mitglied/Gast), bei Mitglied: Funktion
- Bereits angemeldete Personen ausgegraut (nicht doppelt buchbar)
- Klick → fügt zur Liste hinzu (POST /api/travel/[id]/participants)
- Standard: is_registered = true, is_paid = false

### API-Routen Phase 4

- GET    /api/travel                             — alle Reisen (Filter: fiscal_year_id)
- POST   /api/travel                             — neue Reise anlegen
- GET    /api/travel/[id]                        — Reise-Detail inkl. Teilnehmerzahlen
- PUT    /api/travel/[id]                        — Reise bearbeiten
- DELETE /api/travel/[id]                        — Reise löschen (nur wenn keine Teilnehmer)
- GET    /api/travel/[id]/participants           — Teilnehmerliste
- POST   /api/travel/[id]/participants           — Teilnehmer hinzufügen
- PATCH  /api/travel/[id]/participants/[pid]     — is_registered / is_paid togglen
- DELETE /api/travel/[id]/participants/[pid]     — Teilnehmer entfernen
- GET    /api/travel/search-participants?q=      — Suche in members + guests gleichzeitig
- GET    /api/travel/surveys                     — alle Umfragen
- POST   /api/travel/surveys                     — neue Umfrage
- GET    /api/travel/surveys/[id]                — Umfrage-Detail + Ergebnisse
- POST   /api/travel/surveys/[id]/vote           — Abstimmen (member_id aus Session)
- PATCH  /api/travel/surveys/[id]                — Status ändern (open/closed)

### Umfragen (/travel/surveys)

Übersicht: Liste aller Umfragen mit Status, Abstimmungsende, Anzahl Stimmen.

Detail-Seite /travel/surveys/[id]:
- Titel + Status
- Optionen als Radiobuttons (nur eine Stimme pro Mitglied)
- Abstimmen-Button (nur wenn status = 'open' und noch nicht abgestimmt)
- Auswertung als Balkendiagramm (Recharts — bereits installiert)
- Abstimmungsende-Datum

### SQL für Phase 4 — Datenbankänderungen (in Neon ausführen)

ALTER TABLE travels
  ADD COLUMN date_from date,
  ADD COLUMN date_to date,
  ADD COLUMN min_participants integer DEFAULT 0,
  ADD COLUMN max_participants integer,
  ADD COLUMN description text,
  ADD COLUMN fiscal_year_id integer REFERENCES fiscal_years(id);

ALTER TABLE travel_participants
  ADD COLUMN is_registered boolean NOT NULL DEFAULT true,
  ADD COLUMN is_paid boolean NOT NULL DEFAULT false;

---

## Phase 5 — CI/CD + Vercel-Deployment + Domain + SSL

- GitHub Actions: automatischer Deploy auf Vercel bei Push auf main
- Vercel-Projekt verbinden: vercel link
- Produktiv-Domain: kasse.scschmalfeld.org (DNS-Eintrag bei Domain-Provider)
- SSL: automatisch via Vercel (Let's Encrypt)
- Umgebungsvariablen in Vercel-Dashboard eintragen (DATABASE_URL, BETTER_AUTH_SECRET usw.)
- BETTER_AUTH_URL auf https://kasse.scschmalfeld.org setzen
- Neon: Connection Pooling für Produktiv-Betrieb aktivieren

---

## Phase 6 — Tests + Testdaten

Ansatz: Manuelles Testen zuerst, automatisierte Tests optional später.
Reihenfolge: Test-Accounts anlegen → Seed-Script → Manuellen Testplan durcharbeiten → Fehler fixen.

---

### 6.1 Test-Accounts anlegen (manuell in /users)

Vier Test-Accounts anlegen — je einen pro Rolle:

| Account        | Rolle   | Benutzername | Passwort      |
| -------------- | ------- | ------------ | ------------- |
| Test Kassenwart| admin   | test.admin   | Test1234!     |
| Test Vorstand  | board   | test.board   | Test1234!     |
| Test Prüfer    | auditor | test.auditor | Test1234!     |
| Test Mitglied  | member  | test.member  | Test1234!     |

Alle Test-Accounts nach dem Testen wieder deaktivieren (nicht löschen).

---

### 6.2 Seed-Script (scripts/seed-test-data.ts)

Claude Code soll dieses Script anlegen. Es befüllt die DB mit Testdaten:

#### Was das Script anlegt

**Test-Mitglieder (10 Stück):**
- Verschiedene Altersgruppen (60–90 Jahre)
- Verschiedene Funktionen (M, 1.V, KW, B1, KP1)
- Mix aus bezahlt/nicht bezahlt
- Alle mit Präfix "TEST-" im Nachnamen (leicht zu erkennen und zu löschen)

**Test-Buchungen (20 Stück):**
- Verteilt über Jan–Jun des aktiven Jahres
- Mix aus Einnahmen und Ausgaben
- Verschiedene interne Konten
- Verschiedene externe Konten
- 2 Stornos enthalten

**Test-Reise (1 Stück):**
- Name: "TEST-Reise Ostsee 2026"
- Status: confirmed
- 5 Teilnehmer (3 bezahlt, 2 offen)
- Mix aus Mitgliedern und 1 Gast

**Test-Umfrage (1 Stück):**
- Titel: "TEST-Umfrage Reiseziel 2027"
- Status: open
- 3 Optionen, 5 Stimmen verteilt

#### Ausführung

```bash
cd ~/dev/vkEinfach
export $(cat .env.local | grep DATABASE_URL)
npx tsx scripts/seed-test-data.ts
```

#### Cleanup — Testdaten wieder entfernen

```bash
npx tsx scripts/cleanup-test-data.ts
```

Claude Code soll auch cleanup-test-data.ts anlegen:
- Löscht alle Einträge mit "TEST-" Präfix
- Löscht Test-Buchungen (erkennbar an Belegnummer-Präfix "TEST-")
- Löscht Test-Reise + Teilnehmer
- Löscht Test-Umfrage + Votes
- Deaktiviert Test-User (löscht sie nicht)

---

### 6.3 Manueller Testplan

#### Block 1 — Grundfunktionen (ca. 30 Min.)

| Test | Schritte | Erwartetes Ergebnis |
| ---- | -------- | ------------------- |
| Login Benutzername | test.admin + Passwort eingeben | Weiterleitung Dashboard |
| Login E-Mail | E-Mail-Adresse + Passwort | Weiterleitung Dashboard |
| Login falsche Daten | Falsches Passwort | Fehlermeldung sichtbar |
| Abmelden | Button "Abmelden" | Weiterleitung Login |
| Direktaufruf geschützt | /dashboard ohne Login aufrufen | Weiterleitung Login |
| Direktaufruf pending | User ohne approved aufrufen | /pending Seite |

#### Block 2 — Rollen & Berechtigungen (ca. 45 Min.)

Mit jedem Test-Account einloggen und prüfen:

| Rolle | Darf sehen | Darf NICHT sehen/tun |
| ----- | ---------- | -------------------- |
| admin | Alles inkl. /users | — |
| board | Alle Seiten lesend | Buttons Speichern/Neu/Löschen |
| auditor | Buchungen, Konten, Mitglieder | Bearbeiten, /users |
| member | Nur eigene Daten | Alle anderen Seiten |

Konkret testen:
- board: Buchungsliste öffnen → keine "Neu"-Buttons sichtbar
- auditor: Mitgliederliste öffnen → nur Lesen, kein Bearbeiten
- member: /dashboard → nur eigene Daten, kein Menüpunkt Buchungen
- member: /transactions direkt aufrufen → Redirect oder 403

#### Block 3 — Mitgliederverwaltung (ca. 20 Min.)

| Test | Schritte | Erwartetes Ergebnis |
| ---- | -------- | ------------------- |
| Neues Mitglied | /members/neu → Formular ausfüllen | In Liste sichtbar |
| Bearbeiten | Mitglied öffnen → bearbeiten | Änderungen gespeichert |
| Beitrag bezahlt | Toggle setzen | Badge wechselt auf "Bezahlt" |
| Deaktivieren | Mitglied deaktivieren | Verschwindet aus aktiver Liste |
| Filter | Filter "Nur Aktive" | Deaktivierte nicht sichtbar |
| Suche | Namen suchen | Korrekte Ergebnisse |
| Jubiläumsliste | PDF aufrufen | PDF öffnet korrekt |
| Geburtstagsliste | PDF aufrufen | PDF öffnet korrekt |

#### Block 4 — Buchungen (ca. 45 Min.)

| Test | Schritte | Erwartetes Ergebnis |
| ---- | -------- | ------------------- |
| Einnahme buchen | Neu → Einnahme → alle Felder | In Liste sichtbar, Saldo korrekt |
| Ausgabe buchen | Neu → Ausgabe → alle Felder | In Liste sichtbar, Saldo korrekt |
| Storno | Buchung öffnen → Stornieren | Storno-Buchung angelegt |
| Filter Jahr | Jahresfilter wechseln | Nur Buchungen des Jahres |
| Filter Konto | Ext. Konto filtern | Nur Buchungen dieses Kontos |
| Belegnummer | Neue Buchung | Format JJJJ-NNNN korrekt |
| Scan-Beleg | Pfad eintragen | Büroklammer-Icon in Liste |
| Kassenbuch PDF | PDF generieren | Landscape, Monatsblöcke korrekt |

#### Block 5 — Auswertungen (ca. 20 Min.)

| Test | Schritte | Erwartetes Ergebnis |
| ---- | -------- | ------------------- |
| Dashboard Kennzahlen | /dashboard aufrufen | Mitgliederzahl, Ø Alter korrekt |
| Altersdiagramm | /dashboard | Balken für Altersgruppen sichtbar |
| EÜR | /reports/euer | Einnahmen/Ausgaben stimmen mit Buchungen |
| Offene Posten | /reports/open-items | Nur Mitglieder ohne bezahlten Beitrag |
| Kontenblatt | /reports/account-ledger → Konto 103 | Alle Beitragsbuchungen, kum. Saldo |
| Monatsbericht | /reports/monthly → aktueller Monat | Zahlen korrekt |
| EÜR PDF | PDF-Button | Portrait-PDF öffnet |

#### Block 6 — Reisen & Umfragen (ca. 20 Min.)

| Test | Schritte | Erwartetes Ergebnis |
| ---- | -------- | ------------------- |
| Reise anlegen | /travel/neu → Formular | In Übersicht sichtbar |
| Teilnehmer suchen | Suchfeld → Name eingeben | Members + Guests in Ergebnissen |
| Teilnehmer hinzufügen | Mitglied anklicken | In Teilnehmerliste |
| Bezahlt markieren | Checkbox togglen | Sofort gespeichert |
| Gast hinzufügen | Gast in Suche | In Liste mit Typ "Gast" |
| Umfrage anlegen | /travel/surveys/neu | In Übersicht sichtbar |
| Abstimmen | Als member einloggen → abstimmen | Stimme gespeichert |
| Auswertung | Als admin → Diagramm | Balken mit Stimmenanzahl |

#### Block 7 — Einstellungen (ca. 10 Min.)

| Test | Schritte | Erwartetes Ergebnis |
| ---- | -------- | ------------------- |
| Vereinsname ändern | Settings → speichern | Navigation + Login zeigen neuen Namen |
| Modul deaktivieren | Toggle aus | Menüpunkt verschwindet |
| Modul reaktivieren | Toggle ein | Menüpunkt erscheint wieder |
| Benutzerverwaltung | /users → neuen User anlegen | User in Liste sichtbar |
| Freischalten | User freischalten | approved = true |

---

### 6.4 Fehler dokumentieren

Beim Testen gefundene Fehler nach diesem Schema notieren:

```
Fehler #1
Seite: /reports/euer
Schritt: PDF-Button klicken
Erwartetes Ergebnis: PDF öffnet
Tatsächliches Ergebnis: Fehlermeldung 500
Browser-Konsole: [Fehlermeldung hier]
```

Dann Claude Code den Fehler beheben lassen.

---

### 6.5 Produktiv vs. Lokal testen

Wichtig: Beide Umgebungen testen!

| Umgebung | URL | DB |
| -------- | --- | -- |
| Lokal | http://localhost:3000 | Neon (gleiche DB!) |
| Produktiv | https://kasse.scschmalfeld.org | Neon (gleiche DB!) |

Da beide auf dieselbe Neon-DB zeigen: Testdaten die lokal angelegt werden
sind auch produktiv sichtbar. Cleanup-Script nach dem Testen ausführen!

---

## Phase 7 — PWA (next-pwa)

- next-pwa installieren: npm install --legacy-peer-deps next-pwa
- next.config.mjs anpassen: withPWA wrapper
- public/manifest.json anlegen (Name, Icons, Theme-Color emerald)
- Service Worker: Mitgliederliste + Buchungen offline cachen
- Icons in verschiedenen Größen (192x192, 512x512)
- Erst nach stabilem Produktiv-Betrieb umsetzen

---

## Phase 8 — Dokumentation

- Benutzerhandbuch (PDF): Kassenwart, Vorstand, Kassenprüfer, Mitglied
- Installations-Anleitung für neue Vereine (README.md)
- API-Dokumentation (optional)
- CLAUDE.md aktuell halten als Entwickler-Referenz

---

## Dateistruktur

```
src/
  app/
    (protected)/
      layout.tsx
      dashboard/
      members/
      settings/
        ImportWizard.tsx            <- 5-Schritt CSV-Import-Wizard (nur für admin sichtbar)
      users/                        <- Phase 0.6a vollständig
        page.tsx
        UsersClient.tsx             <- Suche, Sortierung, Filter-Chips, Passwort-Buttons (clientseitig)
      guests/                       <- Phase 0.6c
        page.tsx
      accounts/
        page.tsx
      fiscal-years/
        page.tsx
      transactions/
        page.tsx
        neu/page.tsx
        sammel/page.tsx         <- Sammelbuchung
      receipts/
        page.tsx
      reports/
        page.tsx                    <- bestehend
        euer/page.tsx               <- Phase 3 Rest
        monthly/page.tsx            <- Phase 3 Rest
        open-items/page.tsx         <- Phase 3 Rest
        account-ledger/page.tsx     <- Phase 3 Rest
      travel/                       <- Phase 4
        page.tsx
        neu/page.tsx
        [id]/page.tsx
        [id]/bearbeiten/page.tsx
        surveys/page.tsx
        surveys/neu/page.tsx
        surveys/[id]/page.tsx
    setup/                          <- Phase 0.6b
      page.tsx
    api/
      auth/[...all]/
      members/...
      settings/
      accounts/...
      fiscal-years/...
      transactions/...
        sammel/route.ts         <- POST Sammelbuchung
      receipts/...
      reports/...
      import/
        preview/route.ts            <- POST CSV-Vorschau (erste 10 Zeilen)
        execute/route.ts            <- POST CSV-Import (vollständig)
      users/                        <- Phase 0.6a
        route.ts
        [id]/route.ts
        [id]/reset-password/route.ts  <- Temp-Passwort generieren + per E-Mail senden
        [id]/set-password/route.ts    <- Passwort direkt setzen (min. 8 Zeichen, kein altes nötig)
        [id]/temp-password/route.ts   <- Temp-Passwort (2Groß+4Ziffern+2Klein), einmalig zurückgeben
      guests/                       <- Phase 0.6c
        route.ts
        [id]/route.ts
      setup/                        <- Phase 0.6b
        admin/route.ts
        fiscal-year/route.ts
        accounts/route.ts
        internal-accounts/route.ts
        complete/route.ts
      travel/                       <- Phase 4
        route.ts
        [id]/route.ts
        [id]/participants/route.ts
        [id]/participants/[pid]/route.ts
        search-participants/route.ts
        surveys/route.ts
        surveys/[id]/route.ts
        surveys/[id]/vote/route.ts
    login/
    layout.tsx
    page.tsx
  components/ui/
    Navigation.tsx
    ConfirmModal.tsx
    SetupWizard.tsx                 <- Phase 0.6b
  context/
    SettingsContext.tsx
  lib/
    auth/...
    db/...
    utils/
      settings.ts
      transactions.ts
      calculations.ts
      csvParser.ts                  <- BOM-Entfernung, Auto-Delimiter (;/,), quoted fields, applyMapping()
      importAccounts.ts             <- previewAccountRow, importAccounts (interne Konten)
      importUsers.ts                <- generateUsername, importUsers (via auth.api.signUpEmail)
      importMembers.ts              <- parseDate (DD.MM.YYYY + ISO), importMembers
      importTransactions.ts         <- normalizeDirection, importTransactions (ext.Konto: Name/sortOrder/id)
      mailer.ts                     <- sendMail() via nodemailer, encryptPassword/decryptPassword (AES-256)
    data/
      internalAccountsDefault.ts    <- Variante A (Seniorenclub), B (Allgemein), C (CSV-Parser)
  modules/
    accounts/components/...
    fiscal-years/components/...
    members/components/...
    transactions/components/...
    receipts/components/...
    reports/components/...
    travel/                         <- Phase 4
      components/
        TravelForm.tsx
        TravelParticipants.tsx
        ParticipantSearch.tsx
        SurveyForm.tsx
        SurveyVoting.tsx
    guests/                         <- Phase 0.6c
      components/
        GuestForm.tsx
  scripts/
    create-admin.ts
    seed-test-data.ts               <- Phase 6
```

## Datenbank-Tabellen

| Tabelle             | Beschreibung                                                          |
| ------------------- | --------------------------------------------------------------------- |
| members             | Mitglieder mit Funktion (M/1.V/2.V/KW/SW/KS/B1/B2/B3/KP1/KP2)      |
| guests              | Gäste (id, last_name, first_name, contact_info, notes)               |
| external_accounts   | Externe Konten max. 5, current_balance nicht mehr aktuell!           |
| internal_accounts   | Interne Konten, Nummernkreis konfigurierbar (default 100-999)        |
| fiscal_years        | Buchungsjahre (label, date_from, date_to, is_active, is_closed)      |
| transactions        | Buchungen (id != receipt_number!)                                     |
| receipts            | Scan-Belege: file_path + storage_type (local/nas/cloud)              |
| travels             | Reisen (erweitert um date_from/to, min/max_participants, description) |
| travel_participants | Teilnehmer (is_registered + is_paid als Booleans)                    |
| surveys             | Umfragen für Reisewahl (selbst gebaut)                               |
| survey_options      | Umfrage-Optionen                                                      |
| survey_votes        | Abstimmungen (je Mitglied eine Stimme)                               |
| settings            | App-Einstellungen (key/value), inkl. setup_complete                  |
| user                | Better Auth User (role, username, approved, function — E-Mail optional) |
| session             | Better Auth Session                                                   |
| account             | Better Auth Account                                                   |
| verification        | Better Auth Verification                                              |

### Wichtige Spalten transactions

- id — technischer Auto-Increment, für FKs
- receipt_number — Belegnummer JJJJ-NNNN (Storno: JJJJ-ST-NNN), jährlich neu
- fiscal_year_id — FK fiscal_years.id (INTEGER, NOT NULL)
- direction — 'in' = Einnahme, 'out' = Ausgabe
- external_account_id — FK external_accounts
- internal_account_id — FK internal_accounts
- member_id — FK members (optional)
- travel_id — FK travels (optional)
- reference_booking_no — optionale Referenz auf andere Buchungs-Nr.

## Settings-System

- Tabelle settings mit key/value Paaren
- getSettings() in src/lib/utils/settings.ts gibt AppSettings zurück
- SettingsContext in src/context/SettingsContext.tsx — überall via useSettings() verfügbar
- Feature-Flags: settings.features.members usw. — steuern Navigation + Seitenzugriff
- Aktuelle Keys:
  app_name, club_name, club_subtitle,
  module_members, module_guests, module_accounts, module_transactions,
  module_travel, module_reports, module_receipts,
  internal_accounts_min (default 100), internal_accounts_max (default 999),
  receipt_default_path,
  setup_complete (false/true),
  member_fee (optional, Beitragshöhe in Euro),
  smtp_host, smtp_port, smtp_user, smtp_password (AES-256 verschlüsselt),
  smtp_from, smtp_from_name

## Buchungen — wichtige Konzepte

Doppik: Jede Buchung hat ein externes Konto (Barkasse/Bank) und ein internes Konto (Kategorie).

### accountKind (interne Konten)

| Wert     | Bedeutung            | Sichtbar bei Einnahme | Sichtbar bei Ausgabe |
| -------- | -------------------- | --------------------- | -------------------- |
| income   | Einnahmekonto        | ja                    | nein                 |
| expense  | Ausgabenkonto        | nein                  | ja                   |
| neutral  | Kassendifferenz etc. | ja                    | ja                   |
| transfer | Umbuchung            | ja                    | ja                   |
| cancel   | Storno               | ja                    | ja                   |

### Salden — WICHTIG

- current_balance in external_accounts wird NICHT mehr aktualisiert (veraltet, ignorieren)
- Alle Salden werden aus Buchungen berechnet — immer gefiltert nach aktivem/gewähltem Buchungsjahr:
  SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) WHERE fiscal_year_id = X
- Jahresabschluss-Prozess:
  1. Buchungsjahr abschließen (isClosed = true)
  2. Übertrag erstellen → POST /api/fiscal-years/[id]/carry-over mit {targetFyId}
  3. API berechnet Abschlusssaldo je externem Konto und erstellt Buchungen auf Konto 100 im Ziel-Jahr

## Kassenbuch PDF — Format

- Landscape A4, 7 Spalten: Beleg-Nr. | Datum | Beschreibung | Ext.(3 Zeichen) | Int.Konto | Einnahme | Ausgabe
- Kein kumulierter Saldo in der Transaktionsliste
- Nach jeder Monatsgruppe: Monatsabschluss-Block + Seitenumbruch
  - Part A: Einnahmen / Ausgaben / Gewinn-Verlust
  - Part B: je ext. Konto: Vormonatsende | Veränderung | Saldo Monatsende; Summenzeile

## Interne Konten — Startkonfigurationen

Drei Varianten in src/lib/data/internalAccountsDefault.ts:

### Variante A — "Seniorenclub" (accountsSeniorenclub)
Basiert auf Kontenstruktur Seniorenclub Schmalfeld e.V.
Geeignet für Vereine mit Ausflügen, Reisen, Kaffeenachmittagen, Kulturveranstaltungen.

100-Übertrag Vorjahr Konto, 101-Bargeld, 102-Beitrag Vorjahre, 103-Beitrag lfd.Jahr,
104-Beitrag nächstes Jahr, 105-Rechnungsabgrenzung, 106-Getränke/Wurst, 107-Verkauf,
108-Sonstige Einnahmen, 109-Spenden(E), 110-Zuschuss Gemeinde, 120-Zuschuss Dritte,
130-Essen Februar, 140/150-Ausfahrt 1/2, 160/170-Reise 1/2 Eigenanteil,
180/190-Reise 1/2 Sonstige, 199-SoPo1, 200-Kaffeenachmittag, 201-Geburtstag/Jubiläum,
202-Beerdigung, 203-Sonstige Ausgaben, 204-Spenden(A), 205-Ehrungen, 210-MTA Müritz,
220-Grillfest, 230-Kinonachmittag, 240-Essen 25.01.2025, 250-SoPo4, 299-SoPo5,
400-SoPo6, 500-Durchlaufende Posten, 600-Kontoführungsgebühren, 800-Kassendifferenzen,
997-Umbuchung Spar/Konto, 998-Umbuchung Konto/Bar, 999-Storno

### Variante B — "Allgemein klein" (accountsAllgemein)
Generisch für beliebige kleine Vereine. Keine vereinsspezifischen Konten.
Geeignet für Sportvereine, Kulturvereine, Fördervereine, Elternvereine usw.

100-Übertrag Bankkonten, 101-Übertrag Barkasse, 102-Beiträge Vorjahre,
103-Beiträge lfd.Jahr, 104-Beiträge nächstes Jahr, 105-Rechnungsabgrenzung,
106-Einnahmen Veranstaltungen, 107-Einnahmen Verkauf, 108-Sonstige Einnahmen,
109-Spenden(E), 110-Zuschüsse öffentlich, 111-Zuschüsse Dritte/Sponsoren,
112-Versicherungserstattungen, 113-Zinserträge, 130/140/150-Veranstaltung 1/2/3,
160-Reise Eigenanteil, 170-Reise Kosten, 200-Vereinsveranstaltungen,
201-Ehrungen/Jubiläen, 202-Mitgliederpflege, 203-Sonstige Ausgaben, 204-Spenden(A),
300-Verwaltung/Büro, 301-Öffentlichkeitsarbeit, 302-Versicherungen, 303-Miete/Raumkosten,
500-Durchlaufende Posten, 600-Kontoführungsgebühren, 700-Zinsaufwand,
800-Kassendifferenzen, 997-Umbuchung Sparkonto/Konto, 998-Umbuchung Konto/Bar, 999-Storno

### Variante C — CSV-Import (parseAccountsCsv)
Eigener, bereits individualisierter Kontenrahmen. CSV-Datei hochladen.

Format (Semikolon-getrennt, erste Zeile = Header optional):
  nummer;bezeichnung;typ
  100;Übertrag Vorjahr;income
  103;Beitrag laufendes Jahr;income
  200;Ausgaben Fest;expense

Erlaubte Typen: income, expense, neutral, transfer, cancel
Regeln: Nummer eindeutig (1-9999), Bezeichnung max. 150 Zeichen,
        BOM wird entfernt, Kommentarzeilen mit # werden ignoriert
Nach Import: Vorschau der erkannten Konten vor dem endgültigen Speichern

## Vereinsfunktionen (Feld function in members)

M / 1.V / 2.V / KW / SW / KS / B1 / B2 / B3 / KP1 / KP2
Default: M (Mitglied)

## Wichtige Regeln — IMMER einhalten

- npm install IMMER mit --legacy-peer-deps
- API-Routen IMMER: export const dynamic = "force-dynamic"
- Fetch-Aufrufe IMMER: "Content-Type": "application/json" Header
- BETTER_AUTH_URL muss exakt mit Browser-URL übereinstimmen
- Schriftgrößen NUR text-base und text-xl
- KEIN confirm() — eigene 2-Schritt-Bestätigung (ConfirmModal)
- package.json NIE in Archiven
- Passwörter NUR über Better Auth
- TailwindCSS v3 (NICHT v4!) + DaisyUI 4.12.24
- chmod +x node_modules/.bin/next falls "Permission denied"
- drizzle-kit Befehle: erst export $(cat .env.local | grep DATABASE_URL)
- Neon HTTP-Treiber: KEIN db.transaction() möglich — sequenzielle Queries in try-catch
- router.refresh() nach Client-Mutationen aufrufen
- createdBy / uploadedBy in DB-Tabellen: aus Session lesen (nicht mehr hardcoded 1)

## Scan-Belege — Konzept

- Kein Datei-Upload — nur Pfad wird in DB erfasst; Datei liegt wo sie will (lokal, NAS)
- storageType: 'local' | 'nas' | 'cloud'
- filePath: frei eingebbarer Pfad, Standardverzeichnis aus Settings (receipt_default_path)
- Dateityp wird automatisch aus Dateinamen erkannt
- Mehrere Belege pro Buchung möglich (1:n)
- ReceiptBadge: DaisyUI-dialog via ref.current?.showModal()
- WSL2: Pfade werden in /api/receipts/[id]/view von C:\... nach /mnt/c/... konvertiert

## Muster — DaisyUI-Modal in Client-Komponenten

```tsx
const ref = useRef<HTMLDialogElement>(null);
ref.current?.showModal();
<dialog ref={ref} className="modal">
  <div className="modal-box">...</div>
  <form method="dialog" className="modal-backdrop"><button>close</button></form>
</dialog>
```

## Umgebungsvariablen (.env.local)

DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
SMTP_ENCRYPTION_KEY=32-Zeichen-zufaelliger-String-fuer-AES256

SMTP_ENCRYPTION_KEY generieren:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

KEIN RESEND_API_KEY mehr — E-Mail läuft über SMTP aus der settings-Tabelle.
Für Produktion (Vercel) zusätzlich:
  BETTER_AUTH_URL=https://app.vkeinfach.de
  NEXT_PUBLIC_BETTER_AUTH_URL=https://app.vkeinfach.de
