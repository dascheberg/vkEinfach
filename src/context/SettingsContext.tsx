"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AppSettings } from "@/lib/utils/settings";

const defaultSettings: AppSettings = {
  appName: "vkEinfach",
  clubName: "Mein Verein",
  clubSubtitle: "Vereinskasse",
  receiptDefaultPath: "",
  setupComplete: true,
  internalAccountRange: { min: 100, max: 999 },
  features: {
    members: true,
    guests: true,
    accounts: true,
    transactions: true,
    travel: true,
    reports: true,
    receipts: true,
  },
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPassword: "",
  smtpFrom: "",
  smtpFromName: "vkEinfach",
  smtpConfigured: false,
};

const SettingsContext = createContext<{
  settings: AppSettings;
  reload: () => void;
}>({
  settings: defaultSettings,
  reload: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  async function load() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {}
  }

  useEffect(() => { load(); }, []);

  return (
    <SettingsContext.Provider value={{ settings, reload: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
