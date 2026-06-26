import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { receipts, transactions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("transactionId");

    if (transactionId) {
      const rows = await db
        .select()
        .from(receipts)
        .where(eq(receipts.transactionId, parseInt(transactionId)))
        .orderBy(desc(receipts.uploadedAt));
      return NextResponse.json(rows);
    }

    // Alle Belege mit Buchungsinformationen (für Übersichtsseite)
    const rows = await db
      .select({
        id:            receipts.id,
        transactionId: receipts.transactionId,
        receiptNumber: transactions.receiptNumber,
        bookingDate:   transactions.bookingDate,
        fileName:      receipts.fileName,
        filePath:      receipts.filePath,
        fileType:      receipts.fileType,
        storageType:   receipts.storageType,
        fileSize:      receipts.fileSize,
        notes:         receipts.notes,
        uploadedAt:    receipts.uploadedAt,
      })
      .from(receipts)
      .leftJoin(transactions, eq(receipts.transactionId, transactions.id))
      .orderBy(desc(receipts.uploadedAt));

    return NextResponse.json(rows);
  } catch (e) {
    console.error("GET /api/receipts:", e);
    return NextResponse.json({ error: "Datenbankfehler." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { transactionId, fileName, filePath, fileType, storageType, notes } = body;

    if (!transactionId || !fileName || !filePath) {
      return NextResponse.json({ error: "Pflichtfelder fehlen." }, { status: 400 });
    }

    const [row] = await db
      .insert(receipts)
      .values({
        transactionId: parseInt(String(transactionId)),
        fileName:      String(fileName).trim(),
        filePath:      String(filePath).trim(),
        fileType:      fileType  || null,
        storageType:   storageType || "local",
        uploadedBy:    1,
        notes:         notes || null,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    console.error("POST /api/receipts:", e);
    return NextResponse.json({ error: "Datenbankfehler beim Speichern." }, { status: 500 });
  }
}
