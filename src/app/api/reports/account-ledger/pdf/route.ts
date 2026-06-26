import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, internalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

// Landscape A4
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN  = 40;
const COL_W   = PAGE_W - MARGIN * 2;
const FONT_B  = "Helvetica-Bold";
const FONT_R  = "Helvetica";
const ROW_H   = 14;

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
  const intId = sp.get("intId");
  const fyId  = sp.get("fyId");
  if (!intId || !fyId) return NextResponse.json({ error: "intId und fyId erforderlich" }, { status: 400 });

  const [appSettings, intRows, fyRows] = await Promise.all([
    getSettings(),
    db.select().from(internalAccounts).where(eq(internalAccounts.id, parseInt(intId))).limit(1),
    db.select().from(fiscalYears).where(eq(fiscalYears.id, parseInt(fyId))).limit(1),
  ]);
  const intAcc = intRows[0];
  const fy     = fyRows[0];
  if (!intAcc || !fy) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const entries = await db
    .select({
      id:            transactions.id,
      bookingDate:   transactions.bookingDate,
      receiptNumber: transactions.receiptNumber,
      description:   transactions.description,
      direction:     transactions.direction,
      amount:        transactions.amount,
    })
    .from(transactions)
    .where(and(eq(transactions.fiscalYearId, fy.id), eq(transactions.internalAccountId, intAcc.id)))
    .orderBy(asc(transactions.bookingDate), asc(transactions.receiptNumber));

  let runningBalance = 0;
  const rows = entries.map(e => {
    const amt  = parseFloat(e.amount);
    runningBalance += e.direction === "in" ? amt : -amt;
    return {
      ...e,
      income:  e.direction === "in"  ? amt : null,
      expense: e.direction === "out" ? amt : null,
      runningBalance,
      isStorno: e.receiptNumber?.includes("-ST-") ?? false,
    };
  });
  const totalIncome  = rows.reduce((s, r) => s + (r.income  ?? 0), 0);
  const totalExpense = rows.reduce((s, r) => s + (r.expense ?? 0), 0);

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

    function drawTableHeader() {
      doc.save().fillColor("#1e3a5f").rect(MARGIN, y, COL_W, 16).fill().restore();
      doc.font(FONT_B).fontSize(8).fillColor("#fff");
      let x = MARGIN + 2;
      doc.text("Datum",       x, y + 3, { width: C.date  - 2, lineBreak: false }); x += C.date;
      doc.text("Beleg-Nr.",   x, y + 3, { width: C.bn    - 2, lineBreak: false }); x += C.bn;
      doc.text("Beschreibung",x, y + 3, { width: C.desc  - 2, lineBreak: false }); x += C.desc;
      doc.text("Einnahme",    x, y + 3, { width: C.income- 2, align: "right", lineBreak: false }); x += C.income;
      doc.text("Ausgabe",     x, y + 3, { width: C.expense-2, align: "right", lineBreak: false }); x += C.expense;
      doc.text("Saldo",       x, y + 3, { width: C.saldo - 2, align: "right", lineBreak: false });
      y += 16;
    }

    // Column widths (landscape, COL_W ≈ 761)
    const C = { date: 62, bn: 80, desc: 380, income: 80, expense: 80, saldo: 79 };

    // Header
    doc.font(FONT_B).fontSize(14).fillColor("#000").text(appSettings.clubName, MARGIN, y); y += 20;
    doc.font(FONT_B).fontSize(11).fillColor("#000")
      .text(`Kontenblatt: ${intAcc.number} — ${intAcc.name}  |  ${fy.label}`, MARGIN, y); y += 16;
    doc.font(FONT_R).fontSize(9).fillColor("#666").text(`Erstellt: ${today}   |   ${entries.length} Buchungen`, MARGIN, y); y += 12;
    doc.save().strokeColor("#000").lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore(); y += 10;

    drawTableHeader();

    rows.forEach((r, i) => {
      checkPageBreak(ROW_H + 4);
      if (y === MARGIN) drawTableHeader();
      if (i % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
      if (r.isStorno)  doc.save().fillColor("#fef9c3").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
      doc.font(FONT_R).fontSize(8).fillColor(r.isStorno ? "#92400e" : "#000");
      let x = MARGIN + 2;
      doc.text(fmtDate(r.bookingDate),   x, y + 2, { width: C.date   - 2, lineBreak: false }); x += C.date;
      doc.text(r.receiptNumber ?? "–",   x, y + 2, { width: C.bn     - 2, lineBreak: false }); x += C.bn;
      const desc = (r.description ?? "–") + (r.isStorno ? " (storniert)" : "");
      doc.text(desc,                     x, y + 2, { width: C.desc   - 2, lineBreak: false }); x += C.desc;
      doc.text(r.income  !== null ? eur(r.income)  : "–", x, y + 2, { width: C.income  - 2, align: "right", lineBreak: false }); x += C.income;
      doc.text(r.expense !== null ? eur(r.expense) : "–", x, y + 2, { width: C.expense - 2, align: "right", lineBreak: false }); x += C.expense;
      doc.fillColor(r.runningBalance < 0 ? "#991b1b" : "#000");
      doc.text(eur(r.runningBalance), x, y + 2, { width: C.saldo - 2, align: "right", lineBreak: false });
      drawLine(doc, y + ROW_H);
      y += ROW_H;
    });

    // Footer row
    y += 4;
    checkPageBreak(18);
    doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, 18).fill().restore();
    doc.font(FONT_B).fontSize(8.5).fillColor("#000");
    let x = MARGIN + 2;
    x += C.date + C.bn;
    doc.text("Summe", x, y + 4, { width: C.desc - 2, lineBreak: false }); x += C.desc;
    doc.text(eur(totalIncome),  x, y + 4, { width: C.income  - 2, align: "right", lineBreak: false }); x += C.income;
    doc.text(eur(totalExpense), x, y + 4, { width: C.expense - 2, align: "right", lineBreak: false }); x += C.expense;
    const finalBal = totalIncome - totalExpense;
    doc.fillColor(finalBal < 0 ? "#991b1b" : "#166534");
    doc.text(eur(finalBal), x, y + 4, { width: C.saldo - 2, align: "right", lineBreak: false });

    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Kontenblatt-${intAcc.number}-${fy.label}.pdf"`,
    },
  });
}
