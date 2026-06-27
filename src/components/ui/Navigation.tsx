"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { useSettings } from "@/context/SettingsContext";

export const ROLE_LABELS: Record<string, string> = {
  admin:    "Administrator",
  finanzen: "Finanzen",
  vorstand: "Vorstand",
  auditor:  "Kassenprüfer",
  member:   "Mitglied",
};

// Pfade die für eine Rolle aktiv (klickbar) sind.
// Alle anderen werden grau dargestellt.
function getAccessiblePaths(role: string): Set<string> | "all" {
  switch (role) {
    case "admin":
      return "all";
    case "finanzen":
      // Alles außer /settings (kein Schreiben) und /users (nicht sichtbar)
      return new Set([
        "/dashboard", "/members", "/guests", "/accounts", "/transactions",
        "/fiscal-years", "/receipts", "/travel", "/travel/surveys",
        "/reports",
      ]);
    case "vorstand":
      // Mitglieder lesen + Reisen/Umfragen voll; Buchungen/Konten/Belege/Buchungsjahre nur lesen (grau)
      return new Set([
        "/dashboard", "/members", "/travel", "/travel/surveys", "/reports",
      ]);
    case "auditor":
      // Alles lesen — alle Links aktiv (read-only wird von den Seiten selbst erzwungen)
      return new Set([
        "/dashboard", "/members", "/guests", "/accounts", "/transactions",
        "/fiscal-years", "/receipts", "/travel", "/travel/surveys", "/reports",
      ]);
    case "member":
      return new Set(["/dashboard", "/travel/surveys"]);
    default:
      return new Set(["/dashboard"]);
  }
}

interface Props {
  userName: string;
  userRole: string;
}

export default function Navigation({ userName, userRole }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  const accessiblePaths = getAccessiblePaths(userRole);

  const navItems = [
    { href: "/dashboard",      label: "Übersicht",      featureOn: true },
    { href: "/members",        label: "Mitglieder",     featureOn: settings.features.members },
    { href: "/guests",         label: "Gäste",          featureOn: settings.features.guests },
    { href: "/accounts",       label: "Konten",         featureOn: settings.features.accounts },
    { href: "/transactions",   label: "Buchungen",      featureOn: settings.features.transactions },
    { href: "/fiscal-years",   label: "Buchungsjahre",  featureOn: settings.features.transactions },
    { href: "/receipts",       label: "Belege",         featureOn: settings.features.receipts },
    { href: "/travel",         label: "Reisen",         featureOn: settings.features.travel },
    { href: "/travel/surveys", label: "Umfragen",       featureOn: settings.features.travel },
    { href: "/reports",        label: "Auswertungen",   featureOn: settings.features.reports },
    { href: "/settings",       label: "Einstellungen",  featureOn: true },
    // Benutzer nur für admin
    ...(userRole === "admin" ? [{ href: "/users", label: "Benutzer", featureOn: true }] : []),
    // Profil für alle
    { href: "/profile",        label: "Mein Profil",    featureOn: true },
  ];

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/travel") return pathname.startsWith("/travel") && !pathname.startsWith("/travel/surveys");
    return pathname.startsWith(href);
  }

  function isAccessible(href: string, featureOn: boolean): boolean {
    if (!featureOn) return false;
    if (accessiblePaths === "all") return true;
    return accessiblePaths.has(href);
  }

  return (
    <div className="drawer-side z-10">
      <label htmlFor="main-drawer" aria-label="Menü schließen" className="drawer-overlay" />
      <div className="flex flex-col bg-base-200 min-h-screen w-64">
        <div className="p-4 border-b border-base-300">
          <p className="text-xl font-bold">{settings.appName}</p>
          <p className="text-base text-base-content/60">{settings.clubName}</p>
        </div>

        <ul className="menu p-4 flex-1 text-base">
          {navItems.map((item) => {
            const accessible = isAccessible(item.href, item.featureOn);
            if (accessible) {
              return (
                <li key={item.href}>
                  <Link href={item.href} className={isActive(item.href) ? "active" : ""}>
                    {item.label}
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <span className="opacity-40 cursor-not-allowed text-base-content">
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="p-4 border-t border-base-300">
          <p className="text-base font-medium truncate">{userName}</p>
          <p className="text-base text-base-content/60">{ROLE_LABELS[userRole] ?? userRole}</p>
          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm mt-2 text-base w-full justify-start"
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
