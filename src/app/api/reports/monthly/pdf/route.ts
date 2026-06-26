import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, externalAccounts, internalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, and, asc, gte, lte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

const MARGIN = 50;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const COL_W  = PAGE_W - MARGIN * 2;
const FONT_B = "Helvetica-Bold";
const FONT_R = "Helvetica";
const ROW_H  = 14;

const MONTH_NAMES = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

function drawLine(doc: PDFKit.PDFDocument, y: number) {
  doc.save().strokeColor("#e5e7eb").lineWidth(0.5).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore();
}
function fmtDate(s: string | null) {
  if (!s) return "–";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp       = req.nextUrl.searchParams;
  const fyId     = sp.get("fyId");
  const month    = parseInt(sp.get("month") ?? String(new Date().getMonth() + 1));
  const safeMonth = Math.min(Math.max(month, 1), 12);

  if (!fyId) return NextResponse.json({ error: "fyId fehlt" }, { status: 400 });

  const [appSettings, fyRows] = await Promise.all([
    getSettings(),
    db.select().from(fiscalYears).where(eq(fiscalYears.id, parseInt(fyId))).limit(1),
  ]);
  const fy = fyRows[0];
  if (!fy) return NextResponse.json({ error: "Buchungsjahr nicht gefunden" }, { status: 404 });

  const fyYear    = parseInt(fy.label) || new Date().getFullYear();
  const monthFrom = `${fyYear}-${String(safeMonth).padStart(2, "0")}-01`;
  const lastDay   = new Date(fyYear, safeMonth, 0).getDate();
  const monthTo   = `${fyYear}-${String(safeMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [monthEntries, allExtAccounts, extBalanceRows] = await Promise.all([
    db.select({
      id:            transactions.id,
      bookingDate:   transactions.bookingDate,
      receiptNumber: transactions.receiptNumber,
      description:   transactions.description,
      direction:     transactions.direction,
      amount:        transactions.amount,
      intNumber:     internalAccounts.number,
    })
    .from(transactions)
    .leftJoin(internalAccounts, eq(transactions.internalAccountId, internalAccounts.id))
    .where(and(
      eq(transactions.fiscalYearId, fy.id),
      gte(transactions.bookingDate, monthFrom),
      lte(transactions.bookingDate, monthTo),
    ))
    .orderBy(asc(transactions.bookingDate), asc(transactions.receiptNumber)),

    db.select({ id: externalAccounts.id, name: externalAccounts.name })
      .from(externalAccounts)
      .where(eq(externalAccounts.isActive, true))
      .orderBy(asc(externalAccounts.sortOrder)),

    db.select({
      externalAccountId: transactions.externalAccountId,
      net: sql<string>`COALESCE(SUM(CASE WHEN direction='in' THEN amount::numeric ELSE -amount::numeric END),0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.fiscalYearId, fy.id), lte(transactions.bookingDate, monthTo)))
    .groupBy(transactions.externalAccountId),
  ]);

  const extBalances: Record<number, number> = {};
  for (const r of extBalanceRows) extBalances[r.externalAccountId] = parseFloat(r.net);

  const totalIncome  = monthEntries.filter(e => e.direction === "in" ).reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalExpense = monthEntries.filter(e => e.direction === "out").reduce((s, e) => s + parseFloat(e.amount), 0);
  const surplus      = totalIncome - totalExpense;
  const totalBalance = allExtAccounts.reduce((s, a) => s + (extBalances[a.id] ?? 0), 0);

  const doc    = new PDFDocument({ size: "A4", layout: "portrait", margin: MARGIN, autoFirstPage: true });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   resolve);
    doc.on("error", reject);

    const today = new Date().toLocaleDateString("de-DE");
    let y = MARGIN;

    function checkPageBreak(needed: number) {
      if (y + needed > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
    }

    // Header
    doc.font(FONT_B).fontSize(16).fillColor("#000").text(appSettings.clubName, MARGIN, y); y += 22;
    if (appSettings.clubSubtitle) {
      doc.font(FONT_R).fontSize(10).fillColor("#555").text(appSettings.clubSubtitle, MARGIN, y); y += 18;
    }
    doc.font(FONT_B).fontSize(14).fillColor("#000")
      .text(`Monatsbericht ${MONTH_NAMES[safeMonth - 1]} ${fyYear}`, MARGIN, y); y += 18;
    doc.font(FONT_R).fontSize(9).fillColor("#666").text(`Erstellt: ${today}`, MARGIN, y); y += 14;
    doc.save().strokeColor("#000").lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore(); y += 12;

    // Summary
    const sumW = (COL_W - 10) / 3;
    const labels = ["Einnahmen", "Ausgaben", surplus >= 0 ? "Überschuss" : "Fehlbetrag"];
    const values = [eur(totalIncome), eur(totalExpense), eur(Math.abs(surplus))];
    const colors = ["#166534", "#991b1b", surplus >= 0 ? "#166534" : "#991b1b"];
    for (let i = 0; i < 3; i++) {
      const sx = MARGIN + i * (sumW + 5);
      doc.save().fillColor("#f1f5f9").rect(sx, y, sumW, 34).fill().restore();
      doc.font(FONT_R).fontSize(8).fillColor("#555").text(labels[i], sx + 4, y + 4, { lineBreak: false });
      doc.font(FONT_B).fontSize(11).fillColor(colors[i]).text(values[i], sx + 4, y + 16, { lineBreak: false });
    }
    y += 42;

    // External account balances
    if (allExtAccounts.length > 0) {
      doc.font(FONT_B).fontSize(10).fillColor("#000").text(`Kontostand je Kasse am ${fmtDate(monthTo)}`, MARGIN, y); y += 14;
      allExtAccounts.forEach((a, i) => {
        checkPageBreak(ROW_H);
        const bal = extBalances[a.id] ?? 0;
        if (i % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
        doc.font(FONT_R).fontSize(9).fillColor("#000").text(a.name, MARGIN + 4, y + 2, { width: COL_W - 90, lineBreak: false });
        doc.fillColor(bal < 0 ? "#991b1b" : "#000").text(eur(bal), MARGIN + 4, y + 2, { width: COL_W - 8, align: "right", lineBreak: false });
        drawLine(doc, y + ROW_H);
        y += ROW_H;
      });
      // Total
      doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, 16).fill().restore();
      doc.font(FONT_B).fontSize(9).fillColor("#000").text("Summe", MARGIN + 4, y + 3, { width: COL_W - 90, lineBreak: false });
      doc.fillColor(totalBalance < 0 ? "#991b1b" : "#166534")
        .text(eur(totalBalance), MARGIN + 4, y + 3, { width: COL_W - 8, align: "right", lineBreak: false });
      y += 20;
    }

    y += 6;
    // Transaction list
    const C = { date: 60, bn: 80, desc: 285, kto: 40, income: 75, expense: 75 };
    doc.font(FONT_B).fontSize(10).fillColor("#000")
      .text(`Buchungen ${MONTH_NAMES[safeMonth - 1]} (${monthEntries.length})`, MARGIN, y); y += 12;

    // Table header
    doc.save().fillColor("#1e3a5f").rect(MARGIN, y, COL_W, 14).fill().restore();
    doc.font(FONT_B).fontSize(7.5).fillColor("#fff");
    let x = MARGIN + 2;
    doc.text("Datum",      x, y + 2, { width: C.date    - 2, lineBreak: false }); x += C.date;
    doc.text("Beleg-Nr.",  x, y + 2, { width: C.bn      - 2, lineBreak: false }); x += C.bn;
    doc.text("Beschreibung",x, y + 2, { width: C.desc   - 2, lineBreak: false }); x += C.desc;
    doc.text("Kto.",       x, y + 2, { width: C.kto     - 2, align: "right", lineBreak: false }); x += C.kto;
    doc.text("Einnahme",   x, y + 2, { width: C.income  - 2, align: "right", lineBreak: false }); x += C.income;
    doc.text("Ausgabe",    x, y + 2, { width: C.expense - 2, align: "right", lineBreak: false });
    y += 14;

    monthEntries.forEach((e, i) => {
      checkPageBreak(ROW_H);
      if (i % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
      doc.font(FONT_R).fontSize(8).fillColor("#000");
      let cx = MARGIN + 2;
      doc.text(fmtDate(e.bookingDate),  cx, y + 2, { width: C.date    - 2, lineBreak: false }); cx += C.date;
      doc.text(e.receiptNumber ?? "–",  cx, y + 2, { width: C.bn      - 2, lineBreak: false }); cx += C.bn;
      doc.text(e.description ?? "–",   cx, y + 2, { width: C.desc    - 2, lineBreak: false }); cx += C.desc;
      doc.text(e.intNumber !== null ? String(e.intNumber) : "–", cx, y + 2, { width: C.kto - 2, align: "right", lineBreak: false }); cx += C.kto;
      doc.text(e.direction === "in"  ? eur(parseFloat(e.amount)) : "–", cx, y + 2, { width: C.income  - 2, align: "right", lineBreak: false }); cx += C.income;
      doc.text(e.direction === "out" ? eur(parseFloat(e.amount)) : "–", cx, y + 2, { width: C.expense - 2, align: "right", lineBreak: false });
      drawLine(doc, y + ROW_H);
      y += ROW_H;
    });

    // Totals
    checkPageBreak(18);
    doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, 16).fill().restore();
    doc.font(FONT_B).fontSize(9).fillColor("#000");
    let tx = MARGIN + 2 + C.date + C.bn + C.desc + C.kto;
    doc.text("Summe", MARGIN + 4, y + 3, { lineBreak: false });
    doc.fillColor("#166534").text(eur(totalIncome),  tx, y + 3, { width: C.income  - 2, align: "right", lineBreak: false }); tx += C.income;
    doc.fillColor("#991b1b").text(eur(totalExpense), tx, y + 3, { width: C.expense - 2, align: "right", lineBreak: false });

    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Monatsbericht-${fyYear}-${String(safeMonth).padStart(2, "0")}.pdf"`,
    },
  });
}
