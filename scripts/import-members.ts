import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { members } from "../src/lib/db/schema";

// .env.local laden
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// DD.MM.YYYY → YYYY-MM-DD
function parseDate(str: string): string | null {
  const m = str?.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// Jahr (z.B. 2017) → YYYY-01-01
function parseYear(str: string): string | null {
  const year = parseInt(str?.trim() ?? "");
  if (!year || year < 1950 || year > 2030) return null;
  return `${year}-01-01`;
}

// MM.YYYY oder DD.MM.YYYY oder DD.MM.YYYY → YYYY-MM-DD
function parseLeftAt(str: string): string | null {
  if (!str?.trim()) return null;
  const monthYear = str.trim().match(/^(\d{1,2})\.(\d{4})$/);
  if (monthYear) return `${monthYear[2]}-${monthYear[1].padStart(2, "0")}-01`;
  return parseDate(str);
}

async function run() {
  const csvPath = resolve(process.cwd(), "scripts/ml_scs.csv");
  const raw = readFileSync(csvPath, "utf-8").replace(/^﻿/, ""); // BOM entfernen

  // Nur Zeilen die mit einer Zahl beginnen (überspringt die Kopfzeile)
  const dataLines = raw.split(/\r?\n/).filter((line) => /^\d+;/.test(line));

  console.log(`Gefundene Datensätze: ${dataLines.length}\n`);

  let imported = 0;
  let errors = 0;

  for (const line of dataLines) {
    const c = line.split(";");

    const nr = c[0];
    const lastName = c[1]?.trim() ?? "";
    const firstName = c[2]?.trim() ?? "";

    if (!lastName || !firstName) {
      console.warn(`⚠  Nr ${nr}: Kein Name — übersprungen`);
      continue;
    }

    const row = {
      lastName,
      firstName,
      street:              c[3]?.trim() || null,
      zip:                 c[4]?.trim() || null,
      city:                c[5]?.trim() || null,
      phoneLandline:       c[6]?.trim().replace(/,$/, "") || null,
      phoneMobile:         c[7]?.trim() || null,
      birthDate:           parseDate(c[8] ?? ""),
      joinedAt:            parseYear(c[9] ?? ""),
      feePaidCurrentYear:  c[10]?.trim() === "x",
      isActive:            c[15]?.trim().toUpperCase() === "JA",
      leftAt:              parseLeftAt(c[16] ?? ""),
      email:               c[18]?.trim() || null,
      function:            "M",
      deceased:            false,
      feeNotes:            null as string | null,
      notes:               null as string | null,
    };

    try {
      await db.insert(members).values(row);
      const status = row.isActive ? "aktiv" : "inaktiv";
      console.log(`✓  ${nr.padStart(2)}: ${lastName}, ${firstName} (${status})`);
      imported++;
    } catch (e) {
      console.error(`✗  ${nr}: ${lastName}, ${firstName} — ${(e as Error).message}`);
      errors++;
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Importiert: ${imported}  |  Fehler: ${errors}`);
}

run().catch(console.error);
