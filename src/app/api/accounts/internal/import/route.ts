import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { internalAccounts } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { DEFAULT_INTERNAL_ACCOUNTS } from "@/lib/data/internalAccountsDefault";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await db.select({ number: internalAccounts.number }).from(internalAccounts);
  const existingNumbers = new Set(existing.map((r) => r.number));

  const toInsert = DEFAULT_INTERNAL_ACCOUNTS.filter((a) => !existingNumbers.has(a.number));
  const skipped = DEFAULT_INTERNAL_ACCOUNTS.length - toInsert.length;

  if (toInsert.length > 0) {
    await db.insert(internalAccounts).values(
      toInsert.map((a) => ({
        number: a.number,
        name: a.name,
        accountKind: a.accountKind,
        isActive: true,
      }))
    );
  }

  return NextResponse.json({ inserted: toInsert.length, skipped });
}
