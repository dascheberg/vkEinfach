import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, externalAccounts, internalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " €";
}
function fmtDate(s: string | null) {
  if (!s) return "–";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

const MARGIN  = 50;
const PAGE_W  = 595.28;  // A4 portrait
const COL_W   = PAGE_W - MARGIN * 2;  // 495.28
const FONT_B  = "Helvetica-Bold";
const FONT_R  = "Helvetica";
const ROW_H   = 16;

// Cols: Nr(40) | Name(260) | Einnahmen(65) | Ausgaben(65) | Saldo(65) = 495
const C = { nr: 40, name: 260, ein: 65, aus: 65, saldo: 65 };

function drawLine(doc: PDFKit.PDFDocument, y: number, color = "#e5e7eb", w = 0.5) {
  doc.save().strokeColor(color).lineWidth(w)
    .moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore();
}

function drawAccountRow(
  doc: PDFKit.PDFDocument,
  nr: string, name: string, inn: number, out: number,
  y: number, opts?: { bold?: boolean; bg?: string }
) {
  const { bold = false, bg } = opts ?? {};
  if (bg) doc.save().fillColor(bg).rect(MARGIN, y, COL_W, ROW_H).fill().restore();
  doc.font(bold ? FONT_B : FONT_R).fontSize(9).fillColor("#000");
  const net = inn - out;
  let x = MARGIN;
  doc.text(nr,  x + 2,   y + 3, { width: C.nr   - 4, align: "left",  lineBreak: false }); x += C.nr;
  doc.text(name, x + 2,  y + 3, { width: C.name  - 4, align: "left",  lineBreak: false }); x += C.name;
  doc.text(inn > 0 ? eur(inn) : "–", x + 2, y + 3, { width: C.ein  - 4, align: "right", lineBreak: false }); x += C.ein;
  doc.text(out > 0 ? eur(out) : "–", x + 2, y + 3, { width: C.aus  - 4, align: "right", lineBreak: false }); x += C.aus;
  doc.fillColor(net >= 0 ? "#166534" : "#991b1b")
     .text(eur(net), x + 2, y + 3, { width: C.saldo - 4, align: "right", lineBreak: false });
  return y + ROW_H;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fyId = parseInt(req.nextUrl.searchParams.get("fyId") ?? "0");
  if (!fyId) return NextResponse.json({ error: "fyId fehlt" }, { status: 400 });

  const [fy] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, fyId));
  if (!fy) return NextResponse.json({ error: "Buchungsjahr nicht gefunden." }, { status: 404 });

  const appSettings = await getSettings();

  const intSummary = await db
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
      eq(transactions.fiscalYearId, fyId)
    ))
    .groupBy(internalAccounts.number, internalAccounts.name, internalAccounts.accountKind)
    .orderBy(asc(internalAccounts.number));

  const [extAccounts, extBalanceRows] = await Promise.all([
    db.select().from(externalAccounts)
      .where(eq(externalAccounts.isActive, true))
      .orderBy(asc(externalAccounts.sortOrder)),
    db.select({
      externalAccountId: transactions.externalAccountId,
      net: sql<string>`COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0)`,
    })
    .from(transactions)
    .where(eq(transactions.fiscalYearId, fyId))
    .groupBy(transactions.externalAccountId),
  ]);

  const extBalances: Record<number, number> = {};
  for (const r of extBalanceRows) {
    extBalances[r.externalAccountId] = parseFloat(r.net);
  }

  const active = intSummary.filter(
    (r) => parseFloat(r.totalIn) > 0 || parseFloat(r.totalOut) > 0
  );
  const totalIn  = active.reduce((s, r) => s + parseFloat(r.totalIn),  0);
  const totalOut = active.reduce((s, r) => s + parseFloat(r.totalOut), 0);
  const saldo    = totalIn - totalOut;
  const extTotal = extAccounts.reduce((s, a) => s + (extBalances[a.id] ?? 0), 0);

  const doc = new PDFDocument({ size: "A4", layout: "portrait", margin: MARGIN, autoFirstPage: true });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   resolve);
    doc.on("error", reject);

    const today = new Date().toLocaleDateString("de-DE");

    // ── Titel ──────────────────────────────────────────────
    doc.font(FONT_B).fontSize(16).fillColor("#000")
      .text(appSettings.clubName, MARGIN, MARGIN);
    doc.font(FONT_R).fontSize(11).fillColor("#444")
      .text(appSettings.clubSubtitle, MARGIN, MARGIN + 22);
    doc.font(FONT_B).fontSize(14).fillColor("#000")
      .text(`Jahresabschluss ${fy.label}`, MARGIN, MARGIN + 44);
    doc.font(FONT_R).fontSize(9).fillColor("#666")
      .text(`Zeitraum: ${fmtDate(fy.dateFrom)} – ${fmtDate(fy.dateTo)}   |   Erstellt: ${today}`,
        MARGIN, MARGIN + 64);

    drawLine(doc, MARGIN + 80, "#000", 1);
    let y = MARGIN + 90;

    // ── Summary-Boxen ──────────────────────────────────────
    const boxW = (COL_W - 8) / 3;
    const boxes = [
      { label: "Einnahmen gesamt", value: eur(totalIn),  color: "#166534", bg: "#dcfce7" },
      { label: "Ausgaben gesamt",  value: eur(totalOut), color: "#991b1b", bg: "#fee2e2" },
      { label: "Saldo",            value: eur(saldo),    color: saldo >= 0 ? "#166534" : "#991b1b", bg: saldo >= 0 ? "#dcfce7" : "#fee2e2" },
    ];
    boxes.forEach((box, i) => {
      const bx = MARGIN + i * (boxW + 4);
      doc.save().fillColor(box.bg).rect(bx, y, boxW, 36).fill().restore();
      doc.font(FONT_R).fontSize(8).fillColor("#666").text(box.label, bx + 6, y + 5, { width: boxW - 10, lineBreak: false });
      doc.font(FONT_B).fontSize(13).fillColor(box.color).text(box.value, bx + 6, y + 17, { width: boxW - 10, align: "right", lineBreak: false });
    });
    y += 48;
    drawLine(doc, y, "#000", 0.8);
    y += 12;

    // ── Kontenübersicht ────────────────────────────────────
    doc.font(FONT_B).fontSize(11).fillColor("#000").text("Kontenübersicht", MARGIN, y);
    y += 18;

    // Tabellenkopf
    doc.save().fillColor("#1e293b").rect(MARGIN, y, COL_W, 16).fill().restore();
    doc.font(FONT_B).fontSize(8).fillColor("#fff");
    let hx = MARGIN;
    [["Nr.", C.nr], ["Konto", C.name], ["Einnahmen", C.ein], ["Ausgaben", C.aus], ["Saldo", C.saldo]].forEach(([t, w]) => {
      const align = (w === C.nr || w === C.name) ? "left" : "right";
      doc.text(String(t), hx + 2, y + 4, { width: Number(w) - 4, align, lineBreak: false });
      hx += Number(w);
    });
    y += 16;

    for (let i = 0; i < active.length; i++) {
      const r = active[i];
      if (y + ROW_H > doc.page.height - MARGIN - 60) {
        doc.addPage();
        y = MARGIN;
      }
      y = drawAccountRow(doc, String(r.number), r.name,
        parseFloat(r.totalIn), parseFloat(r.totalOut), y,
        { bg: i % 2 === 0 ? "#f8fafc" : undefined });
      drawLine(doc, y);
    }

    // Summenzeile
    y = drawAccountRow(doc, "", "Gesamt", totalIn, totalOut, y, { bold: true, bg: "#e2e8f0" });
    drawLine(doc, y, "#64748b", 1);
    y += 20;

    // ── Externe Konten ─────────────────────────────────────
    if (y + 80 > doc.page.height - MARGIN) { doc.addPage(); y = MARGIN; }

    doc.font(FONT_B).fontSize(11).fillColor("#000").text("Externe Konten (aktuelle Salden)", MARGIN, y);
    y += 18;

    const extCols = { name: 250, type: 100, saldo: 145 };
    doc.save().fillColor("#1e293b").rect(MARGIN, y, COL_W, 16).fill().restore();
    doc.font(FONT_B).fontSize(8).fillColor("#fff");
    doc.text("Konto",    MARGIN + 2,                            y + 4, { width: extCols.name  - 4, align: "left",  lineBreak: false });
    doc.text("Typ",      MARGIN + extCols.name + 2,             y + 4, { width: extCols.type  - 4, align: "left",  lineBreak: false });
    doc.text("Saldo",    MARGIN + extCols.name + extCols.type + 2, y + 4, { width: extCols.saldo - 4, align: "right", lineBreak: false });
    y += 16;

    const TYPE_LABELS: Record<string, string> = { cash: "Barkasse", bank: "Bank", savings: "Sparkonto" };
    extAccounts.forEach((a, i) => {
      const bg = i % 2 === 0 ? "#f8fafc" : undefined;
      if (bg) doc.save().fillColor(bg).rect(MARGIN, y, COL_W, ROW_H).fill().restore();
      const bal = extBalances[a.id] ?? 0;
      doc.font(FONT_R).fontSize(9).fillColor("#000");
      doc.text(a.name,  MARGIN + 2, y + 3, { width: extCols.name - 4, align: "left",  lineBreak: false });
      doc.text(a.accountType ? (TYPE_LABELS[a.accountType] ?? a.accountType) : "–",
        MARGIN + extCols.name + 2, y + 3, { width: extCols.type - 4, align: "left", lineBreak: false });
      doc.fillColor(bal >= 0 ? "#166534" : "#991b1b")
        .text(eur(bal), MARGIN + extCols.name + extCols.type + 2, y + 3,
          { width: extCols.saldo - 4, align: "right", lineBreak: false });
      drawLine(doc, y + ROW_H);
      y += ROW_H;
    });

    // Ext. Gesamt
    doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
    doc.font(FONT_B).fontSize(9).fillColor("#000");
    doc.text("Gesamt", MARGIN + 2, y + 3, { width: extCols.name - 4, align: "left", lineBreak: false });
    doc.fillColor(extTotal >= 0 ? "#166534" : "#991b1b")
      .text(eur(extTotal), MARGIN + extCols.name + extCols.type + 2, y + 3,
        { width: extCols.saldo - 4, align: "right", lineBreak: false });
    drawLine(doc, y + ROW_H, "#64748b", 1);
    y += ROW_H + 20;

    // ── Unterschrift ───────────────────────────────────────
    if (y + 80 > doc.page.height - MARGIN) { doc.addPage(); y = MARGIN; }
    doc.font(FONT_R).fontSize(9).fillColor("#000")
      .text("Erstellt von:", MARGIN, y);
    drawLine(doc, y + 40, "#000", 0.5);
    doc.font(FONT_R).fontSize(8).fillColor("#888")
      .text("Kassenwart / Datum", MARGIN, y + 43);

    doc.end();
  });

  const buffer = Buffer.concat(chunks);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Jahresabschluss-${fy.label}.pdf"`,
    },
  });
}
