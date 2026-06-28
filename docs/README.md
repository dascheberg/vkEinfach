# vkEinfach — Vereinskasse einfach gemacht

**vkEinfach** ist eine kostenlose, browserbasierte Kassenverwaltung für kleine Vereine. Jeder Verein betreibt seine eigene, vollständig isolierte Instanz — keine gemeinsamen Server, keine geteilten Daten.

---

## Was ist vkEinfach?

vkEinfach hilft Vereinen dabei, ihre Kasse übersichtlich zu führen — ohne Tabellenkalkulationen, ohne komplizierte Buchhaltungssoftware. Die wichtigsten Funktionen auf einen Blick:

- **Mitgliederverwaltung** — Stammdaten, Beitragsstatus, Jubiläen, Geburtstage
- **Kassenbuch** — Einnahmen und Ausgaben mit Belegnummern, Storno, Scan-Belegen
- **Sammelbuchung** — Mitgliedsbeiträge und Veranstaltungsanteile mit einem Klick buchen
- **Jahresabschluss** — Buchungsjahr abschließen, Saldenübertrag auf das neue Jahr
- **Auswertungen & PDFs** — Kassenbuch, EÜR, Kontenblatt, Offene Posten, Geburtstagslisten
- **Reiseverwaltung** — Teilnehmer verwalten, Zahlungsstatus, Gästeliste
- **Umfragen** — Abstimmungen für Reiseziele und Vereinsthemen
- **Benutzerverwaltung** — 5 Rollen, Freischaltung durch Admin
- **E-Mail** — SMTP-Benachrichtigungen über eigenen Mailserver
- **Mehrinstanzfähig** — Jeder Verein hat seine eigene Installation

---

## Schnellstart (3 Schritte)

### 1. Repository forken

Auf GitHub anmelden und dieses Repository forken — ein Klick genügt.

### 2. Dienste anlegen (je 5 Minuten, kostenlos)

| Dienst | Zweck | Link |
|--------|-------|------|
| **Neon** | Datenbank (PostgreSQL) | [neon.tech](https://neon.tech) |
| **Vercel** | Hosting (Next.js) | [vercel.com](https://vercel.com) |

### 3. Setup-Wizard durchlaufen

Vercel-Projekt anlegen, Umgebungsvariablen eintragen, auf `https://deine-app.vercel.app/setup` gehen und den Setup-Wizard in 5 Schritten abschließen.

Vollständige Anleitung: [INSTALLATION.md](INSTALLATION.md)

---

## Screenshots

| Dashboard | Buchungen | Auswertungen |
|-----------|-----------|--------------|
| *(folgt)* | *(folgt)* | *(folgt)* |

---

## Rollen

| Rolle | Beschreibung |
|-------|--------------|
| **Administrator** | Vollzugriff, Einstellungen, Benutzerverwaltung |
| **Finanzen** | Buchungen, Konten, Mitglieder, Belege |
| **Vorstand** | Lesend + Reisen und Umfragen verwalten |
| **Kassenprüfer** | Nur lesen |
| **Mitglied** | Dashboard + eigene Daten + Umfragen |

---

## Tech-Stack

- **Framework**: Next.js 14 + TypeScript
- **Datenbank**: PostgreSQL via Neon (serverless)
- **Styling**: TailwindCSS + DaisyUI (Theme: emerald)
- **Auth**: Better Auth
- **PDF**: pdfkit
- **Diagramme**: Recharts

---

## Dokumentation

| Dokument | Zielgruppe |
|----------|-----------|
| [BENUTZERHANDBUCH.md](BENUTZERHANDBUCH.md) | Kassenwart, Vorstand, Mitglieder |
| [ADMIN-HANDBUCH.md](ADMIN-HANDBUCH.md) | Administrator |
| [INSTALLATION.md](INSTALLATION.md) | Technische Einrichtung |

---

## Lizenz

MIT License — freie Nutzung, Weitergabe und Anpassung erlaubt.

---

## Kontakt & Beitragen

Fehler gefunden oder Verbesserungsidee? Einfach ein Issue auf GitHub öffnen.  
Pull Requests sind willkommen.

Entwickelt für den **Seniorenclub Schmalfeld e.V.** — nutzbar von jedem Verein.
