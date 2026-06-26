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
- E-Mail: Resend
- PDF: pdfkit (serverExternalPackages: ["pdfkit"] in next.config.mjs)
- Diagramme: Recharts

## Rollen

| Rolle   | Bezeichnung  | Zugriff                 |
| ------- | ------------ | ----------------------- |
| admin   | Kassenwart   | Alles lesen + schreiben |
| board   | Vorstand     | Alles nur lesen         |
| auditor | Kassenprüfer | Alles nur lesen         |
| member  | Mitglied     | Nur eigene Daten        |

## Aktueller Stand

### Erledigt

- Next.js Projekt mit TailwindCSS v3 + DaisyUI
- Drizzle ORM + Neon DB verbunden
- Better Auth mit 4 Rollen (admin/board/auditor/member)
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

### Offen — Reihenfolge

- Phase 0.6a: Benutzerverwaltung /users (Admin verwaltet alle User + Rollen + Benutzername)
- Phase 0.6b: First-Run-Assistent /setup (Einrichtung für neue Vereinsinstallationen)
- Phase 0.6c: Gästeverwaltung /guests (Voraussetzung für Phase 4)
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

2. Spalten username und approved in Neon zur user-Tabelle hinzufügen:
```sql
ALTER TABLE "user" ADD COLUMN username varchar(50) UNIQUE;
ALTER TABLE "user" ADD COLUMN approved boolean NOT NULL DEFAULT false;
```

3. Drizzle-Schema (schema.ts) — user-Tabelle ergänzen:
```ts
username: varchar("username", { length: 50 }).unique(),
approved: boolean("approved").notNull().default(false),
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
Admin erhält optional E-Mail via Resend
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
- Optional: Admin erhält E-Mail wenn User auf Freischaltung wartet

### E-Mail-Benachrichtigung (optional, via Resend)

Wenn Admin einen User anlegt ohne sofortige Freischaltung:
- E-Mail an Admin (aus settings: admin_email oder RESEND_FROM_EMAIL)
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

Neue Seite, nur für Rolle admin sichtbar. Navigation-Eintrag erscheint nur wenn admin.

### Was die Seite kann

- Liste aller User: Name, E-Mail, Benutzername, Rolle, Freigabe-Status, Erstellt am
- Neuen User anlegen: Name, E-Mail (optional), Benutzername (Pflicht wenn keine E-Mail), Passwort, Rolle wählen, Checkbox "Sofort freischalten"
- Rolle ändern: Dropdown admin/board/auditor/member
- User freischalten / sperren (approved true/false)
- User deaktivieren / reaktivieren (kein Löschen — Datenschutz)
- Passwort zurücksetzen: generiert Temp-Passwort, sendet E-Mail via Resend

### Rollen-Anzeige in der UI

| DB-Rolle | Anzeige      |
| -------- | ------------ |
| admin    | Kassenwart   |
| board    | Vorstand     |
| auditor  | Kassenprüfer |
| member   | Mitglied     |

### Better Auth API-Aufrufe (serverseitig in API-Routen)

- User anlegen: auth.api.signUpEmail({ body: { name, email, password } }) dann UPDATE "user" SET role = X
- Rolle ändern: UPDATE "user" SET role = X WHERE id = Y (direkt via Drizzle)
- User deaktivieren: Feld banned = true in Better Auth ODER eigenes Feld in user-Tabelle
- Passwort zurücksetzen: auth.api.resetPassword oder manuelles UPDATE im account-Tabelle

### Hinweis zu Better Auth user-Tabelle

Die user-Tabelle liegt in Neon und ist im Drizzle-Schema als schema.user definiert.
Rolle wird als text-Feld role gespeichert. Direkter Drizzle-Zugriff ist erlaubt für
Admin-Operationen (Rolle setzen, User auflisten).

### API-Routen

- GET  /api/users                     — alle User auflisten (nur admin)
- POST /api/users                     — neuen User anlegen (nur admin)
- PUT  /api/users/[id]                — Rolle ändern / deaktivieren (nur admin)
- POST /api/users/[id]/reset-password — Temp-Passwort generieren + E-Mail senden

### Sicherheit

- Alle /api/users-Routen prüfen requireAuth() + role === 'admin'
- Kein User kann seine eigene Rolle ändern oder sich selbst deaktivieren
- Passwörter werden NIE im Klartext gespeichert (Better Auth übernimmt Hashing)

---

## Phase 0.6b — First-Run-Assistent (/setup)

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

- Nur interne Konten mit accountKind = 'income' auf der linken Seite
- Nur interne Konten mit accountKind = 'expense' auf der rechten Seite
- Konten mit accountKind = 'neutral'/'transfer'/'cancel' werden NICHT angezeigt
- Nur Konten mit tatsächlichen Buchungen anzeigen (keine Nullzeilen)
- Konten nach Nummer aufsteigend sortieren
- Überschuss grün, Fehlbetrag rot
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

- Testdaten-Script: scripts/seed-test-data.ts (Mitglieder, Buchungen, Reisen)
- Test-Accounts je Rolle anlegen (admin, board, auditor, member)
- Manuelle Testszenarien dokumentieren:
  - Login / Logout je Rolle
  - Buchung anlegen + stornieren
  - Jahresabschluss + Übertrag
  - Reise anlegen + Teilnehmer anmelden
  - Umfrage erstellen + abstimmen
- Optional: Playwright E2E-Tests für kritische Pfade

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
      users/                        <- Phase 0.6a
        page.tsx
      guests/                       <- Phase 0.6c
        page.tsx
      accounts/
        page.tsx
      fiscal-years/
        page.tsx
      transactions/
        page.tsx
        neu/page.tsx
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
      receipts/...
      reports/...
      users/                        <- Phase 0.6a
        route.ts
        [id]/route.ts
        [id]/reset-password/route.ts
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
| user                | Better Auth User (role, username, approved — E-Mail optional)        |
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
  setup_complete (false/true)

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
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=kasse@scschmalfeld.org
