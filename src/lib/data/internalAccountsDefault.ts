// ─────────────────────────────────────────────────────────────────────────────
// vkEinfach — Startkonfigurationen interne Konten
//
// Verwendung im Setup-Wizard (Phase 0.6b, Schritt 4):
//   import { accountsSeniorenclub, accountsAllgemein } from "@/lib/data/internalAccountsDefault";
//
// account_kind Werte:
//   'income'   = Einnahmekonto
//   'expense'  = Ausgabenkonto
//   'neutral'  = Kassendifferenzen, Rechnungsabgrenzung etc.
//   'transfer' = Umbuchungen zwischen Konten
//   'cancel'   = Storno
// ─────────────────────────────────────────────────────────────────────────────

export type InternalAccountTemplate = {
  number: number;
  name: string;
  accountKind: "income" | "expense" | "neutral" | "transfer" | "cancel";
};

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTE A — "Seniorenclub"
// Geeignet für Seniorenvereine mit Ausflügen, Reisen, Kaffeenachmittagen
// Geeignet für: Vereine mit Ausflügen, Reisen, Kaffeenachmittagen,
//               Grillabenden, Kulturveranstaltungen
// ─────────────────────────────────────────────────────────────────────────────
export const accountsSeniorenclub: InternalAccountTemplate[] = [
  // Überträge
  { number: 100, name: "Übertrag Vorjahr Konto", accountKind: "income" },
  { number: 101, name: "Übertrag Vorjahr Bargeld-Kasse", accountKind: "income" },

  // Beiträge
  { number: 102, name: "Beitrag Vorjahre", accountKind: "income" },
  { number: 103, name: "Beitrag laufendes Jahr", accountKind: "income" },
  { number: 104, name: "Beitrag nächstes Jahr", accountKind: "income" },

  // Sonstiges Einnahmen / Abgrenzung
  { number: 105, name: "Rechnungsabgrenzung", accountKind: "neutral" },
  { number: 106, name: "Verkauf Getränke / Wurst", accountKind: "income" },
  { number: 107, name: "Verkauf sonstiges", accountKind: "income" },
  { number: 108, name: "Sonstige Einnahmen", accountKind: "income" },
  { number: 109, name: "Spenden (Einnahme)", accountKind: "income" },
  { number: 110, name: "Zuschuss Gemeinde", accountKind: "income" },
  { number: 120, name: "Zuschuss Dritte", accountKind: "income" },

  // Veranstaltungen (Einnahmen/Ausgaben gemischt je nach Buchung)
  { number: 130, name: "Essen Februar", accountKind: "neutral" },
  { number: 140, name: "Aufwand/Gewinn/Verlust Ausfahrt 1", accountKind: "neutral" },
  { number: 150, name: "Aufwand/Gewinn/Verlust Ausfahrt 2", accountKind: "neutral" },

  // Reisen
  { number: 160, name: "Reise 1 - Eigenanteil", accountKind: "income" },
  { number: 170, name: "Reise 2 - Eigenanteil", accountKind: "income" },
  { number: 180, name: "Reise 1 - Sonstige Posten", accountKind: "expense" },
  { number: 190, name: "Reise 2 - Sonstige Posten", accountKind: "expense" },
  { number: 199, name: "SoPo 1", accountKind: "neutral" },

  // Ausgaben Vereinsleben
  { number: 200, name: "Ausgaben Kaffeenachmittag", accountKind: "expense" },
  { number: 201, name: "Ausgaben Geburtstag / Jubiläum", accountKind: "expense" },
  { number: 202, name: "Ausgaben Beerdigung", accountKind: "expense" },
  { number: 203, name: "Sonstige Ausgaben", accountKind: "expense" },
  { number: 204, name: "Spenden (Ausgabe)", accountKind: "expense" },
  { number: 205, name: "Ausgaben Ehrungen", accountKind: "expense" },
  { number: 210, name: "MTA Müritz", accountKind: "expense" },
  { number: 220, name: "Ausgaben Grillfest", accountKind: "expense" },
  { number: 230, name: "Ausgaben Kinonachmittag", accountKind: "expense" },
  { number: 240, name: "Eigenanteil Essen 25.01.2025", accountKind: "expense" },
  { number: 250, name: "SoPo 4", accountKind: "neutral" },
  { number: 299, name: "SoPo 5", accountKind: "neutral" },
  { number: 400, name: "SoPo 6", accountKind: "neutral" },

  // Sonderfälle
  { number: 500, name: "Durchlaufende Posten", accountKind: "neutral" },
  { number: 600, name: "Kontoführungsgebühren", accountKind: "expense" },
  { number: 800, name: "Kassendifferenzen", accountKind: "neutral" },

  // Umbuchungen & Storno
  { number: 997, name: "Umbuchung Spar an/von Konto", accountKind: "transfer" },
  { number: 998, name: "Umbuchung Konto an/von Bar", accountKind: "transfer" },
  { number: 999, name: "Storno", accountKind: "cancel" },
];

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTE B — "Allgemein klein"
// Generische Startkonfiguration für beliebige kleine Vereine.
// Keine vereinsspezifischen Konten — nur universelle Kategorien.
// Geeignet für: Sportvereine, Kulturvereine, Fördervereine,
//               Elternvereine, Nachbarschaftshilfen usw.
// ─────────────────────────────────────────────────────────────────────────────
export const accountsAllgemein: InternalAccountTemplate[] = [
  // Überträge
  { number: 100, name: "Übertrag Vorjahr Bankkonten", accountKind: "income" },
  { number: 101, name: "Übertrag Vorjahr Barkasse", accountKind: "income" },

  // Beiträge
  { number: 102, name: "Mitgliedsbeiträge Vorjahre", accountKind: "income" },
  { number: 103, name: "Mitgliedsbeiträge laufendes Jahr", accountKind: "income" },
  { number: 104, name: "Mitgliedsbeiträge nächstes Jahr", accountKind: "income" },

  // Einnahmen
  { number: 105, name: "Rechnungsabgrenzung", accountKind: "neutral" },
  { number: 106, name: "Einnahmen Veranstaltungen", accountKind: "income" },
  { number: 107, name: "Einnahmen Verkauf", accountKind: "income" },
  { number: 108, name: "Sonstige Einnahmen", accountKind: "income" },
  { number: 109, name: "Spenden (Einnahme)", accountKind: "income" },
  { number: 110, name: "Zuschüsse öffentlich", accountKind: "income" },
  { number: 111, name: "Zuschüsse Dritte / Sponsoren", accountKind: "income" },
  { number: 112, name: "Versicherungserstattungen", accountKind: "income" },
  { number: 113, name: "Zinserträge", accountKind: "income" },

  // Veranstaltungen
  { number: 130, name: "Veranstaltung 1", accountKind: "neutral" },
  { number: 140, name: "Veranstaltung 2", accountKind: "neutral" },
  { number: 150, name: "Veranstaltung 3", accountKind: "neutral" },
  { number: 160, name: "Reise / Ausfahrt - Eigenanteil", accountKind: "income" },
  { number: 170, name: "Reise / Ausfahrt - Kosten", accountKind: "expense" },

  // Ausgaben Vereinsleben
  { number: 200, name: "Ausgaben Vereinsveranstaltungen", accountKind: "expense" },
  { number: 201, name: "Ausgaben Ehrungen / Jubiläen", accountKind: "expense" },
  { number: 202, name: "Ausgaben Mitgliederpflege", accountKind: "expense" },
  { number: 203, name: "Sonstige Ausgaben", accountKind: "expense" },
  { number: 204, name: "Spenden (Ausgabe)", accountKind: "expense" },

  // Verwaltung
  { number: 300, name: "Ausgaben Verwaltung / Büro", accountKind: "expense" },
  { number: 301, name: "Ausgaben Öffentlichkeitsarbeit", accountKind: "expense" },
  { number: 302, name: "Ausgaben Versicherungen", accountKind: "expense" },
  { number: 303, name: "Ausgaben Miete / Raumkosten", accountKind: "expense" },

  // Sonderfälle
  { number: 500, name: "Durchlaufende Posten", accountKind: "neutral" },
  { number: 600, name: "Kontoführungsgebühren", accountKind: "expense" },
  { number: 700, name: "Zinsaufwand", accountKind: "expense" },
  { number: 800, name: "Kassendifferenzen", accountKind: "neutral" },

  // Umbuchungen & Storno
  { number: 997, name: "Umbuchung Sparkonto an/von Konto", accountKind: "transfer" },
  { number: 998, name: "Umbuchung Konto an/von Barkasse", accountKind: "transfer" },
  { number: 999, name: "Storno", accountKind: "cancel" },
];

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTE C — CSV-Import (eigener Kontenrahmen)
//
// Format der CSV-Datei (Semikolon-getrennt, erste Zeile = Header):
//   nummer;bezeichnung;typ
//   100;Übertrag Vorjahr;income
//   103;Beitrag laufendes Jahr;income
//   200;Ausgaben Fest;expense
//
// Erlaubte Werte für typ:
//   income, expense, neutral, transfer, cancel
//
// Regeln:
//   - Nummer muss eindeutig sein (1–9999)
//   - Bezeichnung max. 150 Zeichen
//   - Typ muss einer der erlaubten Werte sein (sonst: neutral als Fallback)
//   - Leerzeilen und Kommentarzeilen (# ...) werden ignoriert
//   - BOM (UTF-8) wird automatisch entfernt
// ─────────────────────────────────────────────────────────────────────────────
export function parseAccountsCsv(csvContent: string): InternalAccountTemplate[] {
  const validKinds = ["income", "expense", "neutral", "transfer", "cancel"];
  const lines = csvContent
    .replace(/^\uFEFF/, "")        // BOM entfernen
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length === 0) return [];

  // Header-Zeile überspringen wenn vorhanden
  const firstLine = lines[0].toLowerCase();
  const startIndex = firstLine.includes("nummer") || firstLine.includes("number") ? 1 : 0;

  const result: InternalAccountTemplate[] = [];
  const seen = new Set<number>();

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(";");
    if (parts.length < 2) continue;

    const number = parseInt(parts[0].trim(), 10);
    if (isNaN(number) || number < 1 || number > 9999) continue;
    if (seen.has(number)) continue;
    seen.add(number);

    const name = parts[1].trim().slice(0, 150);
    if (!name) continue;

    const rawKind = (parts[2] ?? "").trim().toLowerCase();
    const accountKind = validKinds.includes(rawKind)
      ? (rawKind as InternalAccountTemplate["accountKind"])
      : "neutral";

    result.push({ number, name, accountKind });
  }

  return result.sort((a, b) => a.number - b.number);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktion: Konten in DB einfügen (verwendet in Setup-Wizard + API)
// Aufruf: await insertAccounts(db, accounts);
// ─────────────────────────────────────────────────────────────────────────────
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import { internalAccounts } from "@/lib/db/schema";

export async function insertAccounts(
  db: NeonHttpDatabase<typeof schema>,
  accounts: InternalAccountTemplate[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const acc of accounts) {
    try {
      await db.insert(internalAccounts).values({
        number: acc.number,
        name: acc.name,
        accountKind: acc.accountKind,
        isActive: true,
      }).onConflictDoNothing();
      inserted++;
    } catch {
      skipped++;
    }
  }

  return { inserted, skipped };
}
