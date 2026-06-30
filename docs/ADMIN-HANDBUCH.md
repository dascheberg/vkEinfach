# Administrator-Handbuch — vkEinfach

**Für:** Benutzer mit der Rolle „Administrator"  
**Voraussetzung:** Zugang zum Administratoren-Konto

---

## Inhaltsverzeichnis

1. [Benutzerverwaltung](#1-benutzerverwaltung)
2. [Einstellungen](#2-einstellungen)
3. [Externe Konten verwalten](#3-externe-konten-verwalten)
4. [Interne Konten verwalten](#4-interne-konten-verwalten)
5. [Buchungsjahre](#5-buchungsjahre)
6. [Jahresabschluss durchführen](#6-jahresabschluss-durchführen)
7. [Gäste verwalten](#7-gäste-verwalten)
8. [Reset und Neuinstallation](#8-reset-und-neuinstallation)

> **Stand:** Juni 2026

---

## 1. Benutzerverwaltung

Im Menü auf **„Benutzer"** klicken.

> **Wichtig:** Die Benutzerverwaltung ist nur für Administratoren sichtbar.

### Übersicht der Rollen

| Rolle | Was darf diese Person? |
|-------|------------------------|
| **Administrator** | Alles — inkl. Einstellungen und Benutzerverwaltung |
| **Finanzen** | Buchungen, Konten, Mitglieder, Belege |
| **Vorstand** | Lesen + Reisen und Umfragen verwalten |
| **Kassenprüfer** | Nur lesen |
| **Mitglied** | Dashboard, eigene Daten, Umfragen |

### Neuen Benutzer anlegen

1. Auf **„+ Neuer Benutzer"** klicken
2. Felder ausfüllen:
   - **Name** (vollständiger Name, Pflicht)
   - **E-Mail** (optional, wenn Benutzername gesetzt)
   - **Benutzername** (Pflicht wenn keine E-Mail, mind. 3 Zeichen)
   - **Einmalpasswort** (der Benutzer sollte es nach dem ersten Login ändern)
   - **Rolle** auswählen
   - **Vereinsfunktion** auswählen (Mehrfachauswahl möglich)
3. Checkbox **„Sofort freischalten"** (empfohlen, wenn der Benutzer sofort loslegen soll)
4. Auf **„Speichern"** klicken

### Vereinsfunktionen

Vereinsfunktionen beschreiben das Amt einer Person im Verein — unabhängig von der App-Rolle.  
Mehrere Funktionen können gleichzeitig vergeben werden.

| Kürzel | Bedeutung |
|--------|-----------|
| M | Mitglied (Standard) |
| 1.V | 1. Vorsitzende(r) |
| 2.V | 2. Vorsitzende(r) |
| KW | Kassenwart |
| SW | Schriftwart |
| KS | Kassen- und Schriftwart |
| B1, B2, B3 | 1.–3. Beisitzer |
| KP1, KP2 | 1.–2. Kassenprüfer |

### Benutzer freischalten

Wenn ein Benutzer angelegt wurde ohne sofortige Freischaltung:

1. In der Benutzerliste den Benutzer suchen (er hat ein ⏳-Symbol)
2. Auf **„Freischalten"** klicken
3. Der Benutzer kann sich jetzt einloggen

> Ohne Freischaltung sieht der Benutzer nach dem Login nur die Meldung „Zugang noch nicht freigeschaltet."

### Benutzer sperren

Falls ein Benutzer vorübergehend keinen Zugriff haben soll:

1. In der Benutzerliste auf den Benutzer klicken
2. Auf **„Sperren"** klicken (setzt `approved = false`)

Der Benutzer kann sich weiterhin einloggen, sieht aber nur die Sperrseite.

### Rolle ändern

1. In der Benutzerliste auf den Benutzer klicken
2. Im Dropdown **„Rolle"** die neue Rolle auswählen
3. Änderung wird sofort gespeichert

> **Hinweis:** Sie können Ihre eigene Rolle nicht ändern.

### Passwort zurücksetzen

Für jeden Benutzer stehen drei Passwort-Optionen zur Verfügung:

| Schaltfläche | Was passiert | Wann nutzen? |
|---|---|---|
| **Reset-Mail senden** | Sendet eine E-Mail mit Temp-Passwort (nur wenn E-Mail hinterlegt) | Wenn der Benutzer eine E-Mail-Adresse hat |
| **Passwort setzen** | Admin gibt direkt ein neues Passwort ein (min. 8 Zeichen) | Für ein bekanntes, dauerhaftes Passwort |
| **Temp-Passwort** | Generiert ein zufälliges Passwort (z. B. `AB4712cd`), wird **einmalig** angezeigt | Für Benutzer ohne E-Mail — Passwort telefonisch mitteilen |

> **Ablauf für Benutzer ohne E-Mail:** Temp-Passwort generieren → dem Mitglied telefonisch mitteilen → das Mitglied loggt sich ein und ändert das Passwort in seinem Profil.

### Passwort-Vergessen-Anfragen von der Login-Seite

Wenn ein Benutzer auf der Login-Seite auf **„Passwort vergessen?"** klickt, erhalten Sie automatisch eine Benachrichtigungsmail. Diese enthält Name, Benutzername und E-Mail des Absenders. Sie können dann über die Benutzerverwaltung das Passwort zurücksetzen und die Person kontaktieren.

---

## 2. Einstellungen

Im Menü auf **„Einstellungen"** klicken.

> **Wichtig:** Die Einstellungsseite ist nur für Administratoren zugänglich.

### App-Name und Vereinsname

| Einstellung | Beschreibung | Beispiel |
|-------------|--------------|---------|
| App-Name | Name der Anwendung (erscheint im Browser-Tab und Login) | `vkEinfach` |
| Vereinsname | Vollständiger Vereinsname (erscheint auf PDFs und Login) | `Seniorenclub Beispiel e.V.` |
| Untertitel | Zusatzzeile auf der Login-Seite | `Vereinskasse` |

Änderungen sofort mit **„Speichern"** bestätigen.

### Module aktivieren/deaktivieren

Nicht benötigte Bereiche können ausgeblendet werden.  
Ein deaktiviertes Modul verschwindet aus dem Menü für alle Benutzer.

| Modul | Empfehlung |
|-------|-----------|
| Mitglieder | Immer aktiv lassen |
| Buchungen | Immer aktiv lassen |
| Konten | Immer aktiv lassen |
| Buchungsjahre | Immer aktiv lassen |
| Reisen | Aktivieren wenn Reisen stattfinden |
| Umfragen | Aktivieren nach Bedarf |
| Scan-Belege | Aktivieren wenn Belege digital erfasst werden |
| Auswertungen | Immer aktiv lassen |

### E-Mail Konfiguration (SMTP)

Damit die App E-Mails versenden kann (z. B. Passwort-Reset), muss ein E-Mail-Server eingetragen werden.

| Feld | Erklärung | Beispiel |
|------|-----------|---------|
| SMTP-Server | Adresse des Mailservers | `smtp.strato.de` |
| SMTP-Port | Port des Mailservers | `587` (Standard), `465` (SSL) |
| Benutzername | E-Mail-Adresse für den Login | `kasse@meinverein.de` |
| Passwort | Passwort des E-Mail-Kontos | *(vertraulich)* |
| Absender-Adresse | Die Absender-E-Mail in ausgehenden Mails | `kasse@meinverein.de` |
| Absender-Name | Der angezeigte Name | `Kassenwart Musterverein` |

**Verbindung testen:** Auf **„Verbindung testen"** klicken — bei Erfolg bekommen Sie eine Test-Mail.

> **Sicherheit:** Das SMTP-Passwort wird verschlüsselt in der Datenbank gespeichert. Es wird nie im Klartext angezeigt.

### Standardverzeichnis für Scan-Belege

Wenn Sie regelmäßig Belege erfassen, können Sie hier einen Standard-Ordnerpfad hinterlegen. Dieser wird beim Anlegen neuer Belege automatisch vorausgefüllt.

Beispiel: `C:\Belege\2026\` oder `/home/benutzer/belege/`

---

## 3. Externe Konten verwalten

Im Menü auf **„Konten"** → **„Externe Konten"** klicken.

Externe Konten sind die tatsächlichen Geldkonten des Vereins.

### Kontotypen

| Typ | Bedeutung |
|-----|-----------|
| **Barkasse** | Bargeld in der Kasse |
| **Girokonto** | Kontokorrentkonto bei einer Bank |
| **Sparkonto** | Festgeld, Tagesgeld oder Sparkonto |

### Konten anlegen und bearbeiten

- Maximal **5 externe Konten** möglich
- Jedes Konto kann aktiviert oder deaktiviert werden
- Deaktivierte Konten erscheinen nicht mehr in der Buchungsmaske
- Die Reihenfolge (Sortierung) kann angepasst werden

> **Wichtig:** Externe Kontostand-Felder in der App sind informativ. Der tatsächliche Saldo wird immer aus den Buchungen berechnet.

---

## 4. Interne Konten verwalten

Im Menü auf **„Konten"** → **„Interne Konten"** klicken.

Interne Konten sind Kategorien für Ihre Buchungen — ähnlich wie Kostenstellen.

### Kontotypen

| Typ | Verwendung |
|-----|-----------|
| **Einnahme** | Beiträge, Spenden, Zuschüsse |
| **Ausgabe** | Veranstaltungskosten, Verwaltung |
| **Neutral** | Kassendifferenzen |
| **Umbuchung** | Geldtransfer zwischen externen Konten |
| **Storno** | Stornobuchungen |

### Kontonummer-Schema

Interne Konten haben Nummern (Standard: 100–999). Empfehlung:

| Bereich | Verwendung |
|---------|-----------|
| 100–199 | Einnahmen (Beiträge, Spenden, Reise-Eigenanteile) |
| 200–299 | Ausgaben Veranstaltungen |
| 300–499 | Ausgaben Verwaltung |
| 500–799 | Sonderposten |
| 800–899 | Korrekturen |
| 900–999 | Umbuchungen und Storno |

### Konten anlegen

1. Auf **„+ Neues Konto"** klicken
2. Kontonummer, Bezeichnung und Typ eingeben
3. **„Speichern"**

> **Tipp:** Beim Setup-Wizard können fertige Kontenrahmen für Seniorenvereine oder allgemeine Kleinvereine importiert werden.

---

## 5. Buchungsjahre

Im Menü auf **„Buchungsjahre"** klicken.

### Was ist ein Buchungsjahr?

Das Buchungsjahr definiert den Abrechnungszeitraum. In der Regel entspricht es dem Kalenderjahr (1. Januar bis 31. Dezember).

### Neues Buchungsjahr anlegen

1. Auf **„+ Neues Buchungsjahr"** klicken
2. Felder ausfüllen:
   - **Bezeichnung** (z. B. `2027`, Pflicht)
   - **Beginn** und **Ende** (Pflicht)
   - **Aktueller Beitrag (€)** (optional) — wenn eingetragen, wird dieser Betrag beim Buchen auf Konto 103 automatisch vorausgefüllt
   - **Notizen** (optional)
3. Auf **„Anlegen"** klicken

> **Hinweis:** Es kann immer nur ein Buchungsjahr aktiv sein. Das aktive Jahr erscheint in der Buchungsmaske als Standard.

### Buchungsjahr bearbeiten

Zeitraum oder Beitragshöhe nachträglich ändern:

1. In der Liste auf **„Bearbeiten"** klicken (erscheint bei jedem Jahr)
2. Gewünschte Felder anpassen: Bezeichnung, Beginn, Ende, Beitragshöhe oder Notizen
3. Auf **„Speichern"** klicken

> **Hinweis:** Änderungen am Zeitraum beeinflussen keine bestehenden Buchungen — die Buchungen bleiben dem Jahr fest zugeordnet.

### Buchungsjahr aktivieren

Ein Buchungsjahr muss aktiviert werden bevor Buchungen dafür erfasst werden können.

1. In der Liste auf **„Aktivieren"** klicken
2. Das bisherige aktive Jahr wird automatisch deaktiviert

### Buchungsjahr abschließen

Wenn das Jahr zu Ende ist:

1. Prüfen ob alle Buchungen vollständig sind
2. Auf **„Abschließen"** klicken und bestätigen
3. Das Jahr ist jetzt gesperrt — keine neuen Buchungen mehr möglich

---

## 6. Jahresabschluss durchführen

Der Jahresabschluss überträgt die Kontobestände vom alten in das neue Jahr.

### Schritt-für-Schritt

**Vorbereitung:**
- Alle Buchungen des alten Jahres müssen vollständig sein
- Das neue Buchungsjahr muss bereits angelegt sein

**Ablauf:**

1. Im Menü auf **„Buchungsjahre"** klicken
2. Das abzuschließende Jahr auswählen
3. Auf **„Abschließen"** klicken → Jahr wird gesperrt
4. Auf **„Übertrag erstellen"** klicken
5. Das neue Buchungsjahr als Ziel auswählen
6. Bestätigen

**Was passiert dabei?**  
Für jedes externe Konto (Barkasse, Bankkonten) wird der Abschlusssaldo berechnet und als Eröffnungsbuchung im neuen Jahr eingetragen. Diese Buchungen bekommen den Kontobezeichner des Übertragskontos (100 – Übertrag Vorjahr).

**Prüfung:**  
Nach dem Übertrag sollten die Eröffnungssalden im neuen Jahr mit den Abschlusssalden des alten Jahres übereinstimmen.

---

## 7. Gäste verwalten

Im Menü auf **„Gäste"** klicken.

Gäste sind Personen die an Vereinsveranstaltungen teilnehmen, aber keine Mitglieder sind.

### Gast anlegen

1. Auf **„+ Neuer Gast"** klicken
2. Name, Kontaktdaten (optional) und Bemerkungen eingeben
3. **„Speichern"**

Gäste erscheinen dann in der Teilnehmerliste bei Reisen und können über die Sammelbuchung abgerechnet werden.

### Gast löschen

Gäste können gelöscht werden, solange sie bei keiner Reise angemeldet sind.  
Besteht eine Verknüpfung mit einer Reise, muss zunächst die Teilnahme entfernt werden.

---

## 8. Reset und Neuinstallation

> **Achtung:** Die folgenden Aktionen können Daten unwiderruflich entfernen. Bitte vorher ein Backup der Datenbank erstellen.

### Einzel-Rücksetzen: Setup-Wizard erneut starten

Falls die Grundkonfiguration (Vereinsname, erstes Buchungsjahr, Konten) neu aufgesetzt werden soll:

1. In der Neon-Datenbankkonsole ausführen:
   ```sql
   UPDATE settings SET value = 'false' WHERE key = 'setup_complete';
   UPDATE settings SET value = 'Mein Verein' WHERE key = 'club_name';
   ```
2. Die App aufrufen — Sie werden automatisch zum Setup-Wizard weitergeleitet

> **Hinweis:** Bestehende Buchungen und Mitglieder bleiben erhalten. Der Setup-Wizard legt keine Duplikate an.

### Vollständiges Zurücksetzen (Neuinstallation)

Wenn alles neu gestartet werden soll:

1. Neon-Datenbank leeren: alle Tabellen löschen und die Migration erneut ausführen
2. Oder: Neue Neon-Datenbank anlegen und `DATABASE_URL` in Vercel aktualisieren
3. Setup-Wizard unter `/setup` erneut durchlaufen

### Backup erstellen

**Empfehlung:** Regelmäßige Backups über die Neon-Konsole:

1. [neon.tech](https://neon.tech) → Ihr Projekt öffnen
2. **„Branches"** → **„Create Branch"** (erstellt einen Snapshot-Klon)

Alternativ: SQL-Dump über die Neon-Konsole oder `pg_dump`.

---

## Kontakt und Support

Bei technischen Problemen oder Fragen zur Installation: GitHub Issues verwenden.  
Für Nutzerfragen: Administrator des Vereins ansprechen.
