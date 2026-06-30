# Installations-Anleitung — vkEinfach

**Für:** Technisch versierte Personen die vkEinfach für einen neuen Verein einrichten  
**Dauer:** ca. 30–60 Minuten  
**Kosten:** 0 € (alle verwendeten Dienste sind im Free-Tier kostenlos)

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#1-voraussetzungen)
2. [Accounts anlegen](#2-accounts-anlegen)
3. [Repository vorbereiten](#3-repository-vorbereiten)
4. [Datenbank einrichten (Neon)](#4-datenbank-einrichten-neon)
5. [Hosting einrichten (Vercel)](#5-hosting-einrichten-vercel)
6. [Umgebungsvariablen](#6-umgebungsvariablen)
7. [Domain einrichten](#7-domain-einrichten)
8. [Setup-Wizard durchlaufen](#8-setup-wizard-durchlaufen)
9. [E-Mail (SMTP) konfigurieren](#9-e-mail-smtp-konfigurieren)
10. [Anpassungen nach dem Setup](#10-anpassungen-nach-dem-setup)
11. [Lokale Entwicklungsumgebung](#11-lokale-entwicklungsumgebung)
12. [Upgrade einer bestehenden Installation](#12-upgrade-einer-bestehenden-installation)
13. [Backup-Empfehlungen](#13-backup-empfehlungen)

---

## 1. Voraussetzungen

### Was Sie brauchen

- Einen Computer mit Internetzugang
- Eine E-Mail-Adresse für die Accounts
- Ca. 30–60 Minuten Zeit

### Was Sie **nicht** brauchen

- Eigenen Server
- Technische Vorkenntnisse in Programmierung
- Kreditkarte (alle Dienste haben kostenlose Tarife)

---

## 2. Accounts anlegen

### GitHub-Account

GitHub ist die Plattform wo der Quellcode liegt.

1. Auf [github.com](https://github.com) gehen
2. **„Sign up"** klicken
3. E-Mail-Adresse, Benutzername und Passwort eingeben
4. E-Mail-Adresse bestätigen

### Neon-Account (Datenbank)

Neon stellt die PostgreSQL-Datenbank bereit.

1. Auf [neon.tech](https://neon.tech) gehen
2. **„Sign up"** klicken (am einfachsten mit dem GitHub-Account)
3. Kostenlosen Plan auswählen

### Vercel-Account (Hosting)

Vercel macht die App im Internet verfügbar.

1. Auf [vercel.com](https://vercel.com) gehen
2. **„Sign up"** klicken (am einfachsten mit dem GitHub-Account)
3. Kostenlosen „Hobby"-Plan auswählen

---

## 3. Repository vorbereiten

### Option A — Fork (empfohlen für eigene Anpassungen)

1. Auf GitHub einloggen
2. Das vkEinfach-Repository aufrufen
3. Oben rechts auf **„Fork"** klicken
4. Bestätigen — Sie haben jetzt eine eigene Kopie des Codes

### Option B — Template

Falls das Repository als Template markiert ist:
1. Auf **„Use this template"** klicken
2. Repository-Name eingeben (z. B. `vereinskasse-meinverein`)
3. **„Create repository"** klicken

---

## 4. Datenbank einrichten (Neon)

1. Auf [console.neon.tech](https://console.neon.tech) einloggen
2. **„New Project"** klicken
3. Projekt benennen (z. B. `vereinskasse-meinverein`)
4. Region auswählen (empfohlen: `eu-central-1` Frankfurt)
5. **„Create Project"** klicken

### Connection String notieren

Nach der Erstellung sehen Sie einen Connection String:  
```
postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

Diesen String kopieren und sicher aufbewahren — er wird später in Vercel eingetragen.

### Datenbank-Tabellen anlegen (Migration)

Die Tabellen werden beim ersten Deployment automatisch angelegt — sofern Sie die Migrationsscripts nicht manuell ausführen möchten.

Wenn Sie die Tabellen manuell anlegen möchten:
1. In der Neon-Konsole auf **„SQL Editor"** klicken
2. Das Migrations-SQL aus dem Repository (`drizzle/migrations/`) ausführen

---

## 5. Hosting einrichten (Vercel)

1. Auf [vercel.com](https://vercel.com) einloggen
2. **„New Project"** klicken
3. **„Import Git Repository"** → Ihr vkEinfach-Fork auswählen
4. Framework automatisch erkannt: **Next.js** ✓
5. **Noch nicht deployen** — erst Umgebungsvariablen eintragen (Schritt 6)

---

## 6. Umgebungsvariablen

In Vercel unter **Settings → Environment Variables** eintragen:

### Pflichtfelder

| Variable | Beschreibung | Beispiel |
|----------|--------------|---------|
| `DATABASE_URL` | Connection String von Neon | `postgresql://user:pass@...neon.tech/neondb?sslmode=require` |
| `BETTER_AUTH_SECRET` | Geheimer Schlüssel für Authentifizierung | 32 zufällige Zeichen |
| `BETTER_AUTH_URL` | Öffentliche URL der App | `https://kasse.meinverein.de` |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Gleiche URL, öffentlich zugänglich | `https://kasse.meinverein.de` |
| `SMTP_ENCRYPTION_KEY` | Schlüssel zur E-Mail-Passwortverschlüsselung | 32-Byte Hex-String |

### Schlüssel generieren

**BETTER_AUTH_SECRET** — 32 zufällige Zeichen, z. B.:
```bash
openssl rand -base64 32
```

**SMTP_ENCRYPTION_KEY** — 32-Byte Hex-String:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Oder einen Online-Generator nutzen: `https://generate-secret.vercel.app/32`

### Wichtig für lokale Entwicklung

Für die lokale Entwicklung eine Datei `.env.local` anlegen:

```env
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
SMTP_ENCRYPTION_KEY=...
```

> **Sicherheit:** Die `.env.local`-Datei niemals in Git einchecken! Sie ist in `.gitignore` bereits ausgeschlossen.

### Deployment starten

Nach dem Eintragen aller Variablen:
1. In Vercel auf **„Deploy"** klicken
2. Der erste Build dauert ca. 2–3 Minuten
3. Bei Erfolg erscheint eine grüne Bestätigung und eine `.vercel.app`-URL

---

## 7. Domain einrichten

### Vercel-Standard-Domain

Nach dem Deployment ist die App unter einer automatisch generierten Adresse erreichbar:  
`https://vereinskasse-meinverein.vercel.app`

Das ist bereits funktionsfähig. Eine eigene Domain ist optional.

### Eigene Domain einrichten

**Voraussetzung:** Sie besitzen eine eigene Domain (z. B. bei Strato, IONOS, All-Inkl.)

**In Vercel:**
1. Zum Projekt gehen → **Settings → Domains**
2. Ihre Domain eingeben (z. B. `kasse.meinverein.de`)
3. Vercel zeigt Ihnen die nötigen DNS-Einträge

**Beim Domain-Anbieter (z. B. Strato):**
1. DNS-Einstellungen öffnen
2. Neuen CNAME-Eintrag anlegen:
   - Name: `kasse` (für kasse.meinverein.de)
   - Ziel: `cname.vercel-dns.com`
3. Speichern — DNS-Änderungen können 24–48 Stunden dauern

**Umgebungsvariablen aktualisieren:**  
Wenn die eigene Domain aktiv ist, `BETTER_AUTH_URL` und `NEXT_PUBLIC_BETTER_AUTH_URL` in Vercel auf die neue Domain aktualisieren und neu deployen.

### SSL (HTTPS)

SSL-Zertifikate werden von Vercel automatisch via Let's Encrypt ausgestellt. Kein Handlungsbedarf.

---

## 8. Setup-Wizard durchlaufen

Sobald die App erreichbar ist, wird beim ersten Aufruf automatisch auf den Setup-Wizard weitergeleitet.

### Schritt 1 — App-Name und Admin-Account

- **App-Name** (erscheint im Browser-Tab): z. B. `Vereinskasse`
- **Vereinsname** (erscheint auf PDFs und Login): z. B. `Turnverein Musterstadt e.V.`
- **Untertitel**: z. B. `Kassenverwaltung`
- **Admin-Name**: Vollständiger Name des Kassenverantwortlichen
- **Admin-E-Mail**: E-Mail-Adresse für den Login
- **Passwort**: Sicheres Passwort (mind. 8 Zeichen)

### Schritt 2 — Erstes Buchungsjahr

- **Bezeichnung**: z. B. `2026`
- **Von**: `01.01.2026`
- **Bis**: `31.12.2026`

### Schritt 3 — Externe Konten

Mindestens ein Konto anlegen:

| Beispiel | Typ |
|---------|-----|
| Barkasse | Barkasse |
| Konto Volksbank | Girokonto |
| Sparkonto | Sparkonto |

### Schritt 4 — Interne Konten

Drei Optionen:

| Option | Beschreibung |
|--------|--------------|
| **Seniorenclub** | 39 Konten optimiert für Senioren-/Freizeitvereine |
| **Allgemein klein** | 33 generische Konten für beliebige Kleinvereine |
| **CSV-Import** | Eigener Kontenrahmen als CSV-Datei |

CSV-Format für eigene Konten:
```
nummer;bezeichnung;typ
100;Übertrag Vorjahr;income
103;Beitrag laufendes Jahr;income
200;Veranstaltungskosten;expense
```

Erlaubte Typen: `income`, `expense`, `neutral`, `transfer`, `cancel`

### Schritt 5 — Fertig

- Zusammenfassung prüfen
- Auf **„Zur Anwendung"** klicken
- Setup ist abgeschlossen

---

## 9. E-Mail (SMTP) konfigurieren

Damit die App E-Mails versenden kann (Passwort-Reset etc.), muss ein SMTP-Server eingetragen werden.

### In der App

1. Als Administrator einloggen
2. Im Menü auf **„Einstellungen"** klicken
3. Abschnitt **„E-Mail Konfiguration"** ausfüllen

### Typische SMTP-Einstellungen

**Strato:**
```
Server:  smtp.strato.de
Port:    587
Sicher:  STARTTLS (automatisch bei Port 587)
```

**Gmail** (App-Passwort benötigt):
```
Server:  smtp.gmail.com
Port:    587
```

**IONOS:**
```
Server:  smtp.ionos.de
Port:    587
```

**Hinweis:** Bei vielen Anbietern muss für SMTP ein separates „App-Passwort" generiert werden (nicht das normale Konto-Passwort). Details beim jeweiligen E-Mail-Anbieter nachschlagen.

### Verbindung testen

Nach dem Speichern auf **„Verbindung testen"** klicken. Bei Erfolg erhalten Sie eine Test-Mail an Ihre Admin-E-Mail-Adresse.

---

## 10. Anpassungen nach dem Setup

### „Passwort vergessen?" — Empfänger-E-Mail anpassen

Wenn ein Benutzer auf der Login-Seite auf **„Passwort vergessen?"** klickt, sendet die App eine Benachrichtigung an eine fest hinterlegte Administrator-E-Mail-Adresse.

Diese Adresse muss einmalig im Code angepasst werden:

1. Datei öffnen: `src/app/api/forgot-password/route.ts`
2. Zeile suchen:
   ```ts
   const ADMIN_EMAIL = "ihre-admin@meinverein.de";
   ```
3. E-Mail-Adresse durch die eigene ersetzen und speichern
4. Deployment in Vercel neu starten (Push auf main-Branch)

> **Hinweis:** Ohne diesen Schritt gehen Passwort-Vergessen-Anfragen an die falsche Adresse.

---

## 11. Lokale Entwicklungsumgebung

Für Entwickler die am Code arbeiten möchten:

### Voraussetzungen

- Node.js 18+ ([nodejs.org](https://nodejs.org))
- npm (kommt mit Node.js)
- Git

### Installation

```bash
# Repository klonen
git clone https://github.com/IHR-USERNAME/vkEinfach.git
cd vkEinfach

# Abhängigkeiten installieren
npm install --legacy-peer-deps

# Umgebungsvariablen anlegen
cp .env.example .env.local
# .env.local mit Ihren Werten ausfüllen

# Entwicklungsserver starten
npm run dev
```

Die App ist dann unter `http://localhost:3000` erreichbar.

### Datenbank-Schema aktualisieren

Nach Schemaänderungen:

```bash
# DATABASE_URL aus .env.local laden
export $(cat .env.local | grep DATABASE_URL)

# Drizzle Studio öffnen (Datenbank-Browser)
npx drizzle-kit studio
```

---

## 12. Upgrade einer bestehenden Installation

Wenn Sie eine ältere vkEinfach-Installation auf eine neue Version aktualisieren, müssen neben dem Code-Update ggf. auch Datenbankspalten hinzugefügt werden.

### Code aktualisieren

```bash
# Neuesten Code holen (im geklonten Repository)
git pull origin main

# Abhängigkeiten aktualisieren
npm install --legacy-peer-deps
```

Danach in Vercel neu deployen (automatisch wenn GitHub verbunden, sonst manuell über Vercel-Dashboard).

### Datenbank-Migrationen ausführen

Neue Versionen können neue Datenbankspalten erfordern. Diese werden **nicht automatisch** eingespielt — sie müssen manuell im Neon SQL Editor ausgeführt werden.

#### Version Juni 2026 — erforderliche Migrationen

Folgende SQL-Statements im Neon SQL Editor ausführen, wenn Sie von einer Version vor Juni 2026 aktualisieren:

```sql
-- Beitragshöhe je Buchungsjahr
ALTER TABLE fiscal_years
  ADD COLUMN IF NOT EXISTS membership_fee numeric(10,2);

-- Umfrage-Abstimmung: Verknüpfung mit User-Account statt nur Mitglied
ALTER TABLE survey_votes
  ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE survey_votes
  ADD COLUMN IF NOT EXISTS user_id text;
```

> **Woran erkenne ich ob die Migration nötig ist?** Wenn nach dem Code-Update die Buchungsseite (`/transactions`) einen Server-Error zeigt, fehlen wahrscheinlich die neuen Spalten. Die SQL-Statements beheben das.

### Reihenfolge beim Upgrade

1. Datenbank-Migration in Neon ausführen
2. Code-Update deployen (oder lokal neu starten)
3. App aufrufen und Funktion prüfen

---

## 13. Backup-Empfehlungen

### Automatische Backups (Neon)

Neon erstellt automatisch tägliche Backups. Im Free-Tier werden Backups für 7 Tage aufbewahrt.

### Manuelle Snapshots via Branches

Für wichtige Zeitpunkte (z. B. vor dem Jahresabschluss):

1. In der [Neon-Konsole](https://console.neon.tech) einloggen
2. Ihr Projekt öffnen
3. **„Branches"** → **„Create Branch"**
4. Branch benennen (z. B. `backup-jahresabschluss-2026`)

Ein Branch ist ein vollständiger Datenbankschnappschuss und kann bei Bedarf wiederhergestellt werden.

### SQL-Dump (manuell)

```bash
pg_dump "postgresql://user:pass@...neon.tech/neondb?sslmode=require" > backup-$(date +%Y%m%d).sql
```

### Was gesichert werden sollte

- **Datenbank** (Neon): Alle Vereinsdaten, Buchungen, Mitglieder
- **Umgebungsvariablen** (Vercel): Kopie der Variablen sicher aufbewahren (Passwortmanager)
- **SMTP-Passwort** und **Auth-Secret**: Offline sichern

### Wiederherstellung

Im Neon-Dashboard einen Backup-Branch auswählen und als Hauptbranch einsetzen. Oder SQL-Dump mit `psql` einspielen.

---

## Häufige Probleme

**„Cannot connect to database"**  
→ `DATABASE_URL` in Vercel prüfen. Muss exakt der Neon Connection String mit `?sslmode=require` sein.

**„Auth error" oder Endlosschleife beim Login**  
→ `BETTER_AUTH_URL` und `NEXT_PUBLIC_BETTER_AUTH_URL` müssen exakt mit der tatsächlichen URL übereinstimmen (inkl. `https://`, ohne abschließendes `/`).

**Setup-Wizard leitet immer zu /login weiter**  
→ In der Neon-Konsole prüfen: `SELECT * FROM settings WHERE key = 'setup_complete';`  
Wenn Wert `true` ist: `UPDATE settings SET value = 'false' WHERE key = 'setup_complete';`

**E-Mail kommt nicht an**  
→ Spam-Ordner prüfen. SMTP-Einstellungen in der App testen. Bei Gmail: App-Passwort statt normalem Passwort verwenden.

**Buchungsseite zeigt Server-Error nach Code-Update**  
→ Wahrscheinlich fehlen neue Datenbankspalten. SQL-Migrationen aus [Abschnitt 12](#12-upgrade-einer-bestehenden-installation) im Neon SQL Editor ausführen.
