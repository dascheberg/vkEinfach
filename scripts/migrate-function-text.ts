import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

// .env.local manuell laden (dotenv nicht installiert)
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim();
  process.env[key] = val;
}

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  await sql`ALTER TABLE "members" ALTER COLUMN "function" TYPE TEXT`;
  console.log("Migration erfolgreich: function ist jetzt TEXT");
}

run().catch((e) => {
  console.error("Fehler:", e);
  process.exit(1);
});
