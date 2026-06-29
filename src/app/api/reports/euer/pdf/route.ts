import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, internalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

const MARGIN = 50;
const PAGE_W = 595.28;
const COL_W  = PAGE_W - MARGIN * 2;
const FONT_B = "Helvetica-Bold";
const FONT_R = "Helvetica";

function drawHLine(doc: PDFKit.PDFDocument, y: number, x0 = MARGIN, x1 = MARGIN + COL_W, color = "#e5e7eb", w = 0.5) {
  doc.save().strokeColor(color).lineWidth(w).moveTo(x0, y).lineTo(x1, y).stroke().restore();
}

function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fyId = req.nextUrl.searchParams.get("fyId");
  if (!fyId) return NextResponse.json({ error: "fyId fehlt" }, { status: 400 });

  const [appSettings, fyRows] = await Promise.all([
    getSettings(),
    db.select().from(fiscalYears).where(eq(fiscalYears.id, parseInt(fyId))).limit(1),
  ]);
  const fy = fyRows[0];
  if (!fy) return NextResponse.json({ error: "Buchungsjahr nicht gefunden" }, { status: 404 });

  const rows = await db
    .select({
      number:      internalAccounts.number,
      name:        internalAccounts.name,
      accountKind: internalAccounts.accountKind,
      totalIn:  sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='in'  THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
      totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.direction}='out' THEN ${transactions.amount}::numeric ELSE 0 END),0)`,
    })
    .from(internalAccounts)
    .leftJoin(transactions, and(
      eq(transactions.internalAccountId, internalAccounts.id),
      eq(transactions.fiscalYearId, fy.id),
    ))
    .where(inArray(internalAccounts.accountKind, ["income", "expense", "neutral"]))
    .groupBy(internalAccounts.number, internalAccounts.name, internalAccounts.accountKind)
    .orderBy(asc(internalAccounts.number));

  const incomeRows = rows
    .filter(r => (r.accountKind === "income" || r.accountKind === "neutral") && parseFloat(r.totalIn) > 0)
    .map(r => ({ number: r.number, name: r.name, total: parseFloat(r.totalIn) }));
  const expenseRows = rows
    .filter(r => (r.accountKind === "expense" || r.accountKind === "neutral") && parseFloat(r.totalOut) > 0)
    .map(r => ({ number: r.number, name: r.name, total: parseFloat(r.totalOut) }));
  const totalIncome  = incomeRows.reduce((s, r) => s + r.total, 0);
  const totalExpense = expenseRows.reduce((s, r) => s + r.total, 0);
  const surplus      = totalIncome - totalExpense;

  const doc    = new PDFDocument({ size: "A4", layout: "portrait", margin: MARGIN, autoFirstPage: true });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   resolve);
    doc.on("error", reject);

    const today  = new Date().toLocaleDateString("de-DE");
    let y = MARGIN;

    // Header
    doc.font(FONT_B).fontSize(16).fillColor("#000").text(appSettings.clubName, MARGIN, y); y += 22;
    if (appSettings.clubSubtitle) {
      doc.font(FONT_R).fontSize(10).fillColor("#555").text(appSettings.clubSubtitle, MARGIN, y); y += 18;
    }
    doc.font(FONT_B).fontSize(14).fillColor("#000").text(`EÜR — Einnahmen-Überschuss-Rechnung ${fy.label}`, MARGIN, y); y += 18;
    doc.font(FONT_R).fontSize(9).fillColor("#666").text(`Erstellt: ${today}`, MARGIN, y); y += 14;
    drawHLine(doc, y, MARGIN, MARGIN + COL_W, "#000", 1); y += 14;

    // Two-column layout
    const halfW  = (COL_W - 10) / 2;
    const leftX  = MARGIN;
    const rightX = MARGIN + halfW + 10;
    const numW   = 30;
    const amtW   = 80;
    const nameW  = halfW - numW - amtW - 6;
    const ROW_H  = 14;

    // Column headers
    doc.save().fillColor("#166534").rect(leftX,  y, halfW, 16).fill().restore();
    doc.save().fillColor("#991b1b").rect(rightX, y, halfW, 16).fill().restore();
    doc.font(FONT_B).fontSize(9).fillColor("#fff");
    doc.text("EINNAHMEN", leftX  + 4, y + 3, { lineBreak: false });
    doc.text("AUSGABEN",  rightX + 4, y + 3, { lineBreak: false });
    y += 16;

    // Draw rows for one column at given x, starting at startY, returns final Y
    function drawColumn(rows2: { number: number; name: string; total: number }[], x: number, startY: number) {
      let cy = startY;
      rows2.forEach((r, i) => {
        if (i % 2 === 0) doc.save().fillColor("#f8fafc").rect(x, cy, halfW, ROW_H).fill().restore();
        doc.font(FONT_R).fontSize(8.5).fillColor("#000");
        doc.text(String(r.number), x + 2,            cy + 2, { width: numW - 2, align: "right",  lineBreak: false });
        doc.text(r.name,           x + numW + 4,     cy + 2, { width: nameW,    align: "left",   lineBreak: false });
        doc.text(eur(r.total),     x + numW + nameW + 4, cy + 2, { width: amtW - 2, align: "right", lineBreak: false });
        drawHLine(doc, cy + ROW_H, x, x + halfW);
        cy += ROW_H;
      });
      return cy;
    }

    const startY  = y;
    const leftEnd = drawColumn(incomeRows,  leftX,  startY);
    /* rightX column drawn independently at same startY */
    const rightEnd = drawColumn(expenseRows, rightX, startY);

    y = Math.max(leftEnd, rightEnd) + 6;

    // Totals row
    doc.save().fillColor("#dcfce7").rect(leftX, y, halfW, 16).fill().restore();
    doc.font(FONT_B).fontSize(9).fillColor("#166534");
    doc.text("Summe Einnahmen", leftX + 4,          y + 3, { width: numW + nameW - 2, lineBreak: false });
    doc.text(eur(totalIncome),  leftX + numW + nameW + 4, y + 3, { width: amtW - 2, align: "right", lineBreak: false });

    doc.save().fillColor("#fee2e2").rect(rightX, y, halfW, 16).fill().restore();
    doc.font(FONT_B).fontSize(9).fillColor("#991b1b");
    doc.text("Summe Ausgaben",  rightX + 4,           y + 3, { width: numW + nameW - 2, lineBreak: false });
    doc.text(eur(totalExpense), rightX + numW + nameW + 4, y + 3, { width: amtW - 2, align: "right", lineBreak: false });

    y += 22;
    drawHLine(doc, y, MARGIN, MARGIN + COL_W, "#000", 1); y += 10;

    // Surplus / deficit
    const surplusColor = surplus >= 0 ? "#166534" : "#991b1b";
    doc.save().fillColor(surplusColor).rect(MARGIN, y, COL_W, 22).fill().restore();
    doc.font(FONT_B).fontSize(11).fillColor("#fff");
    doc.text(`${surplus >= 0 ? "Überschuss" : "Fehlbetrag"} ${fy.label}`, MARGIN + 6, y + 5, { lineBreak: false });
    doc.text(eur(Math.abs(surplus)), MARGIN + 6, y + 5, { width: COL_W - 12, align: "right", lineBreak: false });
    y += 36;

    // Signature
    y += 20;
    drawHLine(doc, y, MARGIN, MARGIN + 220, "#555", 0.5); y += 5;
    doc.font(FONT_R).fontSize(9).fillColor("#555").text("Datum, Unterschrift Kassenwart", MARGIN, y);

    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="EUeR-${fy.label}.pdf"`,
    },
  });
}
