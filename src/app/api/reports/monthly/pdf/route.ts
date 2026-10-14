import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, externalAccounts, internalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, and, asc, gte, lte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

// A4 landscape: 841.89 × 595.28 pt
const MARGIN = 50;
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const COL_W  = PAGE_W - MARGIN * 2;  // 741.89
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

  const sp    = req.nextUrl.searchParams;
  const fyId  = sp.get("fyId");
  const clamp = (n: number) => Math.min(Math.max(n, 1), 12);

  const rawFrom = parseInt(sp.get("month") ?? String(new Date().getMonth() + 1));
  const rawTo   = sp.get("monthEnd") ? parseInt(sp.get("monthEnd")!) : rawFrom;
  // Vertauschte Eingabe (Bis vor Von) wird stillschweigend getauscht
  const monthFromNo = clamp(Math.min(rawFrom || 1, rawTo || 1));
  const monthToNo   = clamp(Math.max(rawFrom || 1, rawTo || 1));
  const isRange     = monthFromNo !== monthToNo;

  if (!fyId) return NextResponse.json({ error: "fyId fehlt" }, { status: 400 });

  const [appSettings, fyRows] = await Promise.all([
    getSettings(),
    db.select().from(fiscalYears).where(eq(fiscalYears.id, parseInt(fyId))).limit(1),
  ]);
  const fy = fyRows[0];
  if (!fy) return NextResponse.json({ error: "Buchungsjahr nicht gefunden" }, { status: 404 });

  const fyYear    = parseInt(fy.label) || new Date().getFullYear();
  const rangeFrom = `${fyYear}-${String(monthFromNo).padStart(2, "0")}-01`;
  const lastDay   = new Date(fyYear, monthToNo, 0).getDate();
  const rangeTo   = `${fyYear}-${String(monthToNo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const periodLabel = isRange
    ? `${MONTH_NAMES[monthFromNo - 1]} – ${MONTH_NAMES[monthToNo - 1]}`
    : MONTH_NAMES[monthFromNo - 1];

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
      gte(transactions.bookingDate, rangeFrom),
      lte(transactions.bookingDate, rangeTo),
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
    .where(and(eq(transactions.fiscalYearId, fy.id), lte(transactions.bookingDate, rangeTo)))
    .groupBy(transactions.externalAccountId),
  ]);

  const extBalances: Record<number, number> = {};
  for (const r of extBalanceRows) extBalances[r.externalAccountId] = parseFloat(r.net);

  const totalIncome  = monthEntries.filter(e => e.direction === "in" ).reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalExpense = monthEntries.filter(e => e.direction === "out").reduce((s, e) => s + parseFloat(e.amount), 0);
  const surplus      = totalIncome - totalExpense;
  const totalBalance = allExtAccounts.reduce((s, a) => s + (extBalances[a.id] ?? 0), 0);

  // Monatsweise Aufschlüsselung — nur sinnvoll bei mehr als einem Monat
  const monthlyBreakdown = isRange
    ? Array.from({ length: monthToNo - monthFromNo + 1 }, (_, i) => {
        const m    = monthFromNo + i;
        const rows = monthEntries.filter(e => parseInt(e.bookingDate.slice(5, 7)) === m);
        const inc  = rows.filter(e => e.direction === "in" ).reduce((s, e) => s + parseFloat(e.amount), 0);
        const exp  = rows.filter(e => e.direction === "out").reduce((s, e) => s + parseFloat(e.amount), 0);
        return { name: MONTH_NAMES[m - 1], count: rows.length, income: inc, expense: exp, surplus: inc - exp };
      })
    : [];

  const doc    = new PDFDocument({ size: "A4", layout: "landscape", margin: MARGIN, autoFirstPage: true });
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
      .text(`Monatsbericht ${periodLabel} ${fyYear}`, MARGIN, y); y += 18;
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

    // Monatsübersicht (nur bei Zeitraum über mehrere Monate)
    if (monthlyBreakdown.length > 0) {
      doc.font(FONT_B).fontSize(10).fillColor("#000").text("Monatsübersicht", MARGIN, y); y += 14;

      const M = { name: 120, count: 80, income: 110, expense: 110, surplus: 110 };
      const mTotalW = M.name + M.count + M.income + M.expense + M.surplus;

      doc.save().fillColor("#1e3a5f").rect(MARGIN, y, mTotalW, 14).fill().restore();
      doc.font(FONT_B).fontSize(7.5).fillColor("#fff");
      let mx = MARGIN + 2;
      doc.text("Monat",     mx, y + 2, { width: M.name    - 2, lineBreak: false }); mx += M.name;
      doc.text("Buchungen", mx, y + 2, { width: M.count   - 2, align: "right", lineBreak: false }); mx += M.count;
      doc.text("Einnahmen", mx, y + 2, { width: M.income  - 2, align: "right", lineBreak: false }); mx += M.income;
      doc.text("Ausgaben",  mx, y + 2, { width: M.expense - 2, align: "right", lineBreak: false }); mx += M.expense;
      doc.text("Saldo",     mx, y + 2, { width: M.surplus - 2, align: "right", lineBreak: false });
      y += 14;

      monthlyBreakdown.forEach((m, i) => {
        checkPageBreak(ROW_H);
        if (i % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, mTotalW, ROW_H).fill().restore();
        doc.font(FONT_R).fontSize(8).fillColor("#000");
        let cx = MARGIN + 2;
        doc.text(m.name,          cx, y + 2, { width: M.name    - 2, lineBreak: false }); cx += M.name;
        doc.text(String(m.count), cx, y + 2, { width: M.count   - 2, align: "right", lineBreak: false }); cx += M.count;
        doc.fillColor("#166534").text(eur(m.income),  cx, y + 2, { width: M.income  - 2, align: "right", lineBreak: false }); cx += M.income;
        doc.fillColor("#991b1b").text(eur(m.expense), cx, y + 2, { width: M.expense - 2, align: "right", lineBreak: false }); cx += M.expense;
        doc.fillColor(m.surplus < 0 ? "#991b1b" : "#166534")
          .text(eur(m.surplus), cx, y + 2, { width: M.surplus - 2, align: "right", lineBreak: false });
        drawLine(doc, y + ROW_H);
        y += ROW_H;
      });

      checkPageBreak(18);
      doc.save().fillColor("#e2e8f0").rect(MARGIN, y, mTotalW, 16).fill().restore();
      doc.font(FONT_B).fontSize(9).fillColor("#000");
      let gx = MARGIN + 2;
      doc.text("Gesamt",                      gx, y + 3, { width: M.name  - 2, lineBreak: false }); gx += M.name;
      doc.text(String(monthEntries.length),   gx, y + 3, { width: M.count - 2, align: "right", lineBreak: false }); gx += M.count;
      doc.fillColor("#166534").text(eur(totalIncome),  gx, y + 3, { width: M.income  - 2, align: "right", lineBreak: false }); gx += M.income;
      doc.fillColor("#991b1b").text(eur(totalExpense), gx, y + 3, { width: M.expense - 2, align: "right", lineBreak: false }); gx += M.expense;
      doc.fillColor(surplus < 0 ? "#991b1b" : "#166534")
        .text(eur(surplus), gx, y + 3, { width: M.surplus - 2, align: "right", lineBreak: false });
      y += 24;
    }

    // External account balances
    if (allExtAccounts.length > 0) {
      checkPageBreak(ROW_H * 2);
      doc.font(FONT_B).fontSize(10).fillColor("#000").text(`Kontostand je Kasse am ${fmtDate(rangeTo)}`, MARGIN, y); y += 14;
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
    checkPageBreak(ROW_H * 3);
    // Summe: 60+80+411+40+75+75 = 741
    const C = { date: 60, bn: 80, desc: 411, kto: 40, income: 75, expense: 75 };
    doc.font(FONT_B).fontSize(10).fillColor("#000")
      .text(`Buchungen ${periodLabel} (${monthEntries.length})`, MARGIN, y); y += 12;

    // Table header
    function drawTableHeader() {
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
    }
    drawTableHeader();

    monthEntries.forEach((e, i) => {
      if (y + ROW_H > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; drawTableHeader(); }
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
      "Content-Disposition": `inline; filename="Monatsbericht-${fyYear}-${String(monthFromNo).padStart(2, "0")}${isRange ? `-bis-${String(monthToNo).padStart(2, "0")}` : ""}.pdf"`,
    },
  });
}
