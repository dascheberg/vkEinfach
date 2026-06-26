import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export type FeatureFlags = {
  members: boolean;
  guests: boolean;
  accounts: boolean;
  transactions: boolean;
  travel: boolean;
  reports: boolean;
  receipts: boolean;
};

export type AppSettings = {
  appName: string;
  clubName: string;
  clubSubtitle: string;
  receiptDefaultPath: string;
  setupComplete: boolean;
  features: FeatureFlags;
  internalAccountRange: { min: number; max: number };
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    appName:            map["app_name"]             ?? "vkEinfach",
    clubName:           map["club_name"]            ?? "Mein Verein",
    clubSubtitle:       map["club_subtitle"]        ?? "Vereinskasse",
    receiptDefaultPath: map["receipt_default_path"] ?? "",
    setupComplete:      map["setup_complete"] === "true",
    internalAccountRange: {
      min: parseInt(map["internal_accounts_min"] ?? "100"),
      max: parseInt(map["internal_accounts_max"] ?? "999"),
    },
    features: {
      members:      map["module_members"]      !== "false",
      guests:       map["module_guests"]       !== "false",
      accounts:     map["module_accounts"]     !== "false",
      transactions: map["module_transactions"] !== "false",
      travel:       map["module_travel"]       !== "false",
      reports:      map["module_reports"]      !== "false",
      receipts:     map["module_receipts"]     !== "false",
    },
  };
}

export async function updateSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}
