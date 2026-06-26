"use client";

import { useState } from "react";
import ExternalAccountsSection from "./ExternalAccountsSection";
import InternalAccountsSection from "./InternalAccountsSection";

interface ExternalAccount {
  id: number;
  name: string;
  accountType: string | null;
  iban: string | null;
  currentBalance: string;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
}

interface InternalAccount {
  id: number;
  number: number;
  name: string;
  accountKind: string | null;
  isActive: boolean;
  notes: string | null;
}

interface Props {
  externalAccounts: ExternalAccount[];
  internalAccounts: InternalAccount[];
  accountRange: { min: number; max: number };
  isAdmin: boolean;
  internalBalances: Record<number, number>;
  externalBalances: Record<number, number>;
}

type Tab = "external" | "internal";

export default function AccountsTabs({
  externalAccounts,
  internalAccounts,
  accountRange,
  isAdmin,
  internalBalances,
  externalBalances,
}: Props) {
  const [tab, setTab] = useState<Tab>("external");

  return (
    <div>
      <div role="tablist" className="tabs tabs-bordered mb-6">
        <button
          type="button"
          role="tab"
          className={`tab text-base ${tab === "external" ? "tab-active" : ""}`}
          onClick={() => setTab("external")}
        >
          Externe Konten
          <span className="ml-2 badge badge-sm">{externalAccounts.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={`tab text-base ${tab === "internal" ? "tab-active" : ""}`}
          onClick={() => setTab("internal")}
        >
          Interne Konten
          <span className="ml-2 badge badge-sm">{internalAccounts.filter((a) => a.isActive).length}</span>
        </button>
      </div>

      {tab === "external" && (
        <ExternalAccountsSection initialAccounts={externalAccounts} isAdmin={isAdmin} balances={externalBalances} />
      )}
      {tab === "internal" && (
        <InternalAccountsSection
          initialAccounts={internalAccounts}
          accountRange={accountRange}
          isAdmin={isAdmin}
          balances={internalBalances}
        />
      )}
    </div>
  );
}
