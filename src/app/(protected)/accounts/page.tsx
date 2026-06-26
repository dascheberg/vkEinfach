import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { externalAccounts, internalAccounts, transactions, fiscalYears } from "@/lib/db/schema";
import { getSettings } from "@/lib/utils/settings";
import { asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import AccountsTabs from "@/modules/accounts/components/AccountsTabs";

export default async function AccountsPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  // Active fiscal year for balance display (falls back to most recent)
  const allFiscalYears = await db.select().from(fiscalYears).orderBy(asc(fiscalYears.dateFrom));
  const activeFY = allFiscalYears.find((fy) => fy.isActive) ?? allFiscalYears[allFiscalYears.length - 1];
  const balanceFyId = activeFY?.id;

  const [external, internal, appSettings, intBalanceRows, extBalanceRows] = await Promise.all([
    db.select().from(externalAccounts)
      .orderBy(asc(externalAccounts.sortOrder), asc(externalAccounts.id)),

    db.select().from(internalAccounts)
      .orderBy(asc(internalAccounts.number)),

    getSettings(),

    // Nettosaldo je internem Konto im aktiven Buchungsjahr
    db.select({
      internalAccountId: transactions.internalAccountId,
      net: sql<string>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0)`,
    })
    .from(transactions)
    .where(balanceFyId ? eq(transactions.fiscalYearId, balanceFyId) : sql`false`)
    .groupBy(transactions.internalAccountId),

    // Nettosaldo je externem Konto im aktiven Buchungsjahr
    db.select({
      externalAccountId: transactions.externalAccountId,
      net: sql<string>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0)`,
    })
    .from(transactions)
    .where(balanceFyId ? eq(transactions.fiscalYearId, balanceFyId) : sql`false`)
    .groupBy(transactions.externalAccountId),
  ]);

  const internalBalances: Record<number, number> = {};
  for (const row of intBalanceRows) {
    internalBalances[row.internalAccountId] = parseFloat(row.net);
  }

  const externalBalances: Record<number, number> = {};
  for (const row of extBalanceRows) {
    externalBalances[row.externalAccountId] = parseFloat(row.net);
  }

  const isAdmin = role === "admin";

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Konten</h1>
      <AccountsTabs
        externalAccounts={external}
        internalAccounts={internal}
        accountRange={appSettings.internalAccountRange}
        isAdmin={isAdmin}
        internalBalances={internalBalances}
        externalBalances={externalBalances}
      />
    </div>
  );
}
