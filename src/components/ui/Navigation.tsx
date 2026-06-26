"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { useSettings } from "@/context/SettingsContext";

const ROLE_LABELS: Record<string, string> = {
  admin: "Kassenwart",
  board: "Vorstand",
  auditor: "Kassenprüfer",
  member: "Mitglied",
};

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

  const navItems = [
    { href: "/dashboard",     label: "Übersicht",         show: true },
    { href: "/members",       label: "Mitglieder",        show: settings.features.members },
    { href: "/guests",        label: "Gäste",             show: settings.features.guests },
    { href: "/accounts",      label: "Konten",            show: settings.features.accounts },
    { href: "/transactions",  label: "Buchungen",         show: settings.features.transactions },
    { href: "/fiscal-years",  label: "Buchungsjahre",     show: settings.features.transactions },
    { href: "/receipts",      label: "Belege",            show: settings.features.receipts },
    { href: "/travel",        label: "Reisen",            show: settings.features.travel },
    { href: "/travel/surveys", label: "Umfragen",          show: settings.features.travel },
    { href: "/reports",       label: "Auswertungen",      show: settings.features.reports },
    { href: "/settings",      label: "Einstellungen",     show: true },
    { href: "/users",         label: "Benutzer",          show: userRole === "admin" },
  ];

  return (
    <div className="drawer-side z-10">
      <label htmlFor="main-drawer" aria-label="Menü schließen" className="drawer-overlay" />
      <div className="flex flex-col bg-base-200 min-h-screen w-64">
        <div className="p-4 border-b border-base-300">
          <p className="text-xl font-bold">{settings.appName}</p>
          <p className="text-base text-base-content/60">{settings.clubName}</p>
        </div>

        <ul className="menu p-4 flex-1 text-base">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    item.href === "/dashboard"
                      ? pathname === "/dashboard" ? "active" : ""
                      : item.href === "/travel"
                        ? pathname.startsWith("/travel") && !pathname.startsWith("/travel/surveys") ? "active" : ""
                        : pathname.startsWith(item.href) ? "active" : ""
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
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
