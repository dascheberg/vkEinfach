import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { importMembers } from "@/lib/utils/importMembers";
import { importUsers } from "@/lib/utils/importUsers";
import { importAccounts } from "@/lib/utils/importAccounts";
import { importTransactions } from "@/lib/utils/importTransactions";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { type, rows, fiscalYearId } = body as {
    type: string;
    rows: Record<string, string>[];
    fiscalYearId?: number;
  };

  if (!type || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "type und rows erforderlich" }, { status: 400 });
  }

  try {
    switch (type) {
      case "members":
        return NextResponse.json(await importMembers(rows));

      case "users":
        return NextResponse.json(await importUsers(rows));

      case "internalAccounts":
        return NextResponse.json(await importAccounts(rows));

      case "transactions": {
        if (!fiscalYearId) {
          return NextResponse.json({ error: "fiscalYearId erforderlich für Buchungsimport" }, { status: 400 });
        }
        const userId = parseInt((session.user as { id?: string })?.id ?? "1") || 1;
        return NextResponse.json(
          await importTransactions(rows, userId, fiscalYearId)
        );
      }

      default:
        return NextResponse.json({ error: "Unbekannter Import-Typ" }, { status: 400 });
    }
  } catch (e) {
    console.error("POST /api/import/execute:", e);
    return NextResponse.json({ error: "Interner Fehler beim Import" }, { status: 500 });
  }
}
