import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { previewMemberRow } from "@/lib/utils/importMembers";
import { previewUserRow } from "@/lib/utils/importUsers";
import { previewAccountRow } from "@/lib/utils/importAccounts";
import { previewTransactionRow } from "@/lib/utils/importTransactions";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { type, rows } = body as { type: string; rows: Record<string, string>[] };

  if (!type || !Array.isArray(rows)) {
    return NextResponse.json({ error: "type und rows erforderlich" }, { status: 400 });
  }

  const previewRows = rows.slice(0, 10);

  switch (type) {
    case "members":
      return NextResponse.json({
        preview: previewRows.map((r) => previewMemberRow(r)),
        totalRows: rows.length,
      });

    case "users":
      return NextResponse.json({
        preview: previewRows.map((r) => previewUserRow(r)),
        totalRows: rows.length,
      });

    case "internalAccounts":
      return NextResponse.json({
        preview: previewRows.map((r) => previewAccountRow(r)),
        totalRows: rows.length,
      });

    case "transactions":
      return NextResponse.json({
        preview: previewRows.map((r) => previewTransactionRow(r)),
        totalRows: rows.length,
      });

    default:
      return NextResponse.json({ error: "Unbekannter Import-Typ" }, { status: 400 });
  }
}
