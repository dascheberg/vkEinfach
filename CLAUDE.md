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
- Auth: Better Auth (4 Rollen)
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

- Phase 0.6a: Benutzerverwaltung /users (Admin verwaltet alle User + Rollen)
- Phase 0.6b: First-Run-Assistent /setup (Einrichtung für neue Vereinsinstallationen)
- Phase 3 Rest: weitere Auswertungen, Dashboard-Charts
- Phase 4: Reiseverwaltung, Umfragen
- Phase 5: PWA (next-pwa)

---

## NEU: Phase 0.6a — Benutzerverwaltung (/users)

Neue Seite, nur für Rolle admin sichtbar. Navigation-Eintrag erscheint nur wenn admin.

### Was die Seite kann

- Liste aller User: Name, E-Mail, Rolle, Erstellt am, Aktiv ja/nein
- Neuen User anlegen: Name, E-Mail, Passwort (Einmalpasswort), Rolle wählen
- Rolle ändern: Dropdown admin/board/auditor/member
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

- GET /api/users — alle User auflisten (nur admin)
- POST /api/users — neuen User anlegen (nur admin)
- PUT /api/users/[id] — Rolle ändern / deaktivieren (nur admin)
- POST /api/users/[id]/reset-password — Temp-Passwort generieren + E-Mail senden

### Sicherheit

- Alle /api/users-Routen prüfen requireAuth() + role === 'admin'
- Kein User kann seine eigene Rolle ändern oder sich selbst deaktivieren
- Passwörter werden NIE im Klartext gespeichert (Better Auth übernimmt Hashing)

---

## NEU: Phase 0.6b — First-Run-Assistent (/setup)

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

- Zwei Optionen:
  a) Startkonfiguration importieren (36 Konten aus internalAccountsDefault.ts)
  b) Leer starten (später manuell anlegen)
- POST /api/setup/internal-accounts

Schritt 5 — Fertig

- Zusammenfassung was angelegt wurde
- settings-Key setup_complete auf 'true' setzen
- Button: "Zur Anwendung" → redirect /dashboard

### Settings-Key

setup_complete = 'false' (default, wird beim ersten Start eingefügt)
setup_complete = 'true' (nach Abschluss des Wizards)

Beim Anlegen der settings-Tabelle diesen Key mit 'false' als Default einfügen:
INSERT INTO settings (key, value, description) VALUES
('setup_complete', 'false', 'Ersteinrichtung abgeschlossen');

### API-Routen für Setup

- POST /api/setup/admin — Admin + App-Settings anlegen
- POST /api/setup/fiscal-year — Erstes Buchungsjahr
- POST /api/setup/accounts — Externe Konten
- POST /api/setup/internal-accounts — Interne Konten (Bulk oder leer)
- POST /api/setup/complete — setup_complete auf true setzen

Alle /api/setup-Routen sind NICHT durch requireAuth geschützt,
prüfen aber ob setup_complete bereits true ist — wenn ja: 403 zurückgeben.

---

## Dateistruktur

```
src/
  app/
    (protected)/
      layout.tsx              <- Drawer-Layout, volle Breite, prüft setup_complete
      dashboard/              <- Übersicht
      members/                <- Mitgliederverwaltung (komplett)
      settings/               <- Einstellungsseite
      users/                  <- NEU Phase 0.6a: Benutzerverwaltung (nur admin)
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
        page.tsx
    setup/                    <- NEU Phase 0.6b: First-Run-Wizard (ungeschützt)
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
      users/                  <- NEU Phase 0.6a
        route.ts              <- GET + POST
        [id]/route.ts         <- PUT (Rolle/Status)
        [id]/reset-password/route.ts
      setup/                  <- NEU Phase 0.6b
        admin/route.ts
        fiscal-year/route.ts
        accounts/route.ts
        internal-accounts/route.ts
        complete/route.ts
    login/
    layout.tsx
    page.tsx
  components/ui/
    Navigation.tsx
    ConfirmModal.tsx
    SetupWizard.tsx           <- NEU Phase 0.6b: Wizard-Komponente
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
      internalAccountsDefault.ts
  modules/...
  scripts/
    create-admin.ts
```

## Datenbank-Tabellen

| Tabelle             | Beschreibung                                                    |
| ------------------- | --------------------------------------------------------------- |
| members             | Mitglieder mit Funktion (M/1.V/2.V/KW/SW/KS/B1/B2/B3/KP1/KP2)   |
| guests              | Gäste (id, last_name, first_name, contact_info, notes)          |
| external_accounts   | Externe Konten max. 5, current_balance nicht mehr aktuell!      |
| internal_accounts   | Interne Konten, Nummernkreis konfigurierbar (default 100-999)   |
| fiscal_years        | Buchungsjahre (label, date_from, date_to, is_active, is_closed) |
| transactions        | Buchungen (id != receipt_number!)                               |
| receipts            | Scan-Belege: file_path + storage_type (local/nas/cloud)         |
| travels             | Reisen                                                          |
| travel_participants | Teilnehmer (member_id ODER guest_id, nie beide)                 |
| surveys             | Umfragen für Reisewahl                                          |
| survey_options      | Umfrage-Optionen                                                |
| survey_votes        | Abstimmungen                                                    |
| settings            | App-Einstellungen (key/value), inkl. setup_complete             |
| user                | Better Auth User (inkl. role als text-Feld)                     |
| session             | Better Auth Session                                             |
| account             | Better Auth Account                                             |
| verification        | Better Auth Verification                                        |

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

## Interne Konten — Startkonfiguration

100-Übertrag Vorjahr Konto, 101-Bargeld, 102-Beitrag Vorjahre, 103-Beitrag lfd.Jahr,
104-Beitrag nächstes Jahr, 105-Rechnungsabgrenzung, 106-Getränke/Wurst, 107-Verkauf,
108-Sonstige Einnahmen, 109-Spenden(E), 110-Zuschuss Gemeinde, 120-Zuschuss Dritte,
130-Essen Februar, 140/150-Ausfahrt 1/2, 160/170-Reise 1/2 Eigenanteil,
180/190-Reise 1/2 Sonstige, 199-SoPo1, 200-Kaffeenachmittag, 201-Geburtstag/Jubiläum,
202-Beerdigung, 203-Sonstige Ausgaben, 204-Spenden(A), 205-Ehrungen, 210-MTA Müritz,
220-Grillfest, 230-Kinonachmittag, 240-Essen 25.01.2025, 500-Durchlaufende Posten,
600-Kontoführungsgebühren, 800-Kassendifferenzen, 997-Umbuchung Spar/Konto,
998-Umbuchung Konto/Bar, 999-Storno

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
  <form method="dialog" className="modal-backdrop">
    <button>close</button>
  </form>
</dialog>;
```

## Umgebungsvariablen (.env.local)

DATABASE*URL=postgresql://...@...neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
RESEND_API_KEY=re*...
RESEND_FROM_EMAIL=kasse@scschmalfeld.org
