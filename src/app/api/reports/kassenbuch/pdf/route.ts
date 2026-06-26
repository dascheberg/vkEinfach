import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, externalAccounts, internalAccounts, members, fiscalYears } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " €";
}
function eurSigned(v: number) {
  const abs = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
  return (v >= 0 ? "+ " : "– ") + abs + " €";
}
function fmtDate(s: string | null) {
  if (!s) return "–";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

const MONTH_NAMES_DE = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

// A4 landscape: 841.89 × 595.28 pt
const PAGE_W = 841.89;
const MARGIN  = 40;
const COL_W   = PAGE_W - MARGIN * 2;  // 761.89

// 7 transaction columns — kum. Saldo entfernt, Ext. auf 3 Zeichen abgekürzt
// Summe: 72+58+214+48+174+98+98 = 762
const COLS = [
  { label: "Beleg-Nr.",    w: 72,  align: "left"  },
  { label: "Datum",        w: 58,  align: "left"  },
  { label: "Beschreibung", w: 214, align: "left"  },
  { label: "Ext.",         w: 48,  align: "left"  },
  { label: "Int. Konto",   w: 174, align: "left"  },
  { label: "Einnahme",     w: 98,  align: "right" },
  { label: "Ausgabe",      w: 98,  align: "right" },
] as const;

const ROW_H  = 14;
const HEAD_H = 18;
const FONT_B = "Helvetica-Bold";
const FONT_R = "Helvetica";

function drawRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  y: number,
  opts?: { bold?: boolean; bg?: string; size?: number }
) {
  const { bold = false, bg, size = 8 } = opts ?? {};
  const h = bold ? HEAD_H : ROW_H;
  if (bg) doc.save().fillColor(bg).rect(MARGIN, y, COL_W, h).fill().restore();
  doc.font(bold ? FONT_B : FONT_R).fontSize(size).fillColor("#000000");
  let x = MARGIN;
  for (let i = 0; i < COLS.length; i++) {
    const col = COLS[i];
    doc.text(cells[i] ?? "", x + 2, y + (h - size) / 2, {
      width: col.w - 4, align: col.align as "left" | "right", lineBreak: false,
    });
    x += col.w;
  }
  doc.save().strokeColor("#e5e7eb").lineWidth(0.5)
    .moveTo(MARGIN, y + h).lineTo(MARGIN + COL_W, y + h).stroke().restore();
}

function drawHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.save().fillColor("#1a1a2e").rect(MARGIN, y, COL_W, HEAD_H).fill().restore();
  doc.save().fillColor("#ffffff").font(FONT_B).fontSize(9);
  let x = MARGIN;
  for (const col of COLS) {
    doc.text(col.label, x + 2, y + (HEAD_H - 9) / 2, {
      width: col.w - 4, align: col.align as "left" | "right", lineBreak: false,
    });
    x += col.w;
  }
  doc.restore();
}

// ── Monatsabschluss ────────────────────────────────────────────────────────
// Part B Spaltenbreiten: Name(260) + Veränderung(200) + Saldo(302) = 762
const B = { name: 260, change: 200, saldo: 302 };
const MC_TITLE_H  = 18;
const MC_A_ROW_H  = 15;   // Part A: Einnahmen / Ausgaben / Gewinn
const MC_B_HDR_H  = 16;   // Part B: Kopfzeile
const MC_B_ROW_H  = 14;   // Part B: Kontozeile
const MC_B_TOT_H  = 15;   // Part B: Summenzeile

function estimateMCHeight(numAccts: number) {
  return MC_TITLE_H
    + (MC_A_ROW_H * 3 + 10)   // Part A inkl. Padding
    + 6                         // Abstand
    + MC_B_HDR_H
    + numAccts * MC_B_ROW_H
    + MC_B_TOT_H
    + 8;                        // Abstand unten
}

function drawMonthlyClosing(
  doc: PDFKit.PDFDocument,
  startY: number,
  monthLabel: string,
  monthIn: number,
  monthOut: number,
  extAccts: Array<{ id: number; name: string }>,
  prevBals: Record<number, number>,
  curBals: Record<number, number>
): number {
  let y = startY;
  const pnl = monthIn - monthOut;

  // Titelleiste
  doc.save().fillColor("#1e3a5f").rect(MARGIN, y, COL_W, MC_TITLE_H).fill().restore();
  doc.font(FONT_B).fontSize(9).fillColor("#fff")
    .text(`Monatsabschluss  ${monthLabel}`, MARGIN + 6, y + 5, { lineBreak: false });
  y += MC_TITLE_H;

  // Part A: Einnahmen / Ausgaben / Gewinn-Verlust
  const aH = MC_A_ROW_H * 3 + 10;
  doc.save().fillColor("#f0f9ff").rect(MARGIN, y, COL_W, aH).fill().restore();
  const aRows = [
    { label: "Einnahmen:",         value: monthIn,         color: "#166534" },
    { label: "Ausgaben:",          value: monthOut,        color: "#991b1b" },
    { label: "Gewinn / Verlust:",  value: pnl,             color: pnl >= 0 ? "#166534" : "#991b1b" },
  ];
  let ay = y + 5;
  for (const row of aRows) {
    doc.font(FONT_R).fontSize(8).fillColor("#374151")
      .text(row.label, MARGIN + 6, ay, { width: 200, lineBreak: false });
    doc.font(FONT_B).fontSize(8).fillColor(row.color)
      .text(eur(row.value), MARGIN + 220, ay, { width: 150, align: "right", lineBreak: false });
    ay += MC_A_ROW_H;
  }
  y += aH + 6;

  // Part B: Saldenentwicklung je externem Konto
  const prevTotal = extAccts.reduce((s, a) => s + (prevBals[a.id] ?? 0), 0);

  // Kopfzeile: "Summe" | Vormonatssaldo | "Salden"
  doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, MC_B_HDR_H).fill().restore();
  doc.font(FONT_B).fontSize(8).fillColor("#1e293b");
  doc.text("Summe",
    MARGIN + 2, y + 4, { width: B.name - 4, align: "left", lineBreak: false });
  doc.text(eur(prevTotal),
    MARGIN + B.name + 2, y + 4, { width: B.change - 4, align: "right", lineBreak: false });
  doc.text("Salden",
    MARGIN + B.name + B.change + 2, y + 4, { width: B.saldo - 4, align: "left", lineBreak: false });
  y += MC_B_HDR_H;

  // Kontozeilen
  let totalChange = 0;
  let totalEnd    = 0;
  for (let i = 0; i < extAccts.length; i++) {
    const a      = extAccts[i];
    const cur    = curBals[a.id]  ?? 0;
    const prev   = prevBals[a.id] ?? 0;
    const change = cur - prev;
    totalChange += change;
    totalEnd    += cur;

    if (i % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, MC_B_ROW_H).fill().restore();
    doc.font(FONT_R).fontSize(8).fillColor("#000");
    doc.text(a.name, MARGIN + 2, y + 3, { width: B.name - 4, align: "left", lineBreak: false });
    doc.fillColor(change >= 0 ? "#166534" : "#991b1b")
      .font(FONT_B).text(eurSigned(change),
        MARGIN + B.name + 2, y + 3, { width: B.change - 4, align: "right", lineBreak: false });
    doc.fillColor(cur >= 0 ? "#166534" : "#991b1b")
      .text(eur(cur),
        MARGIN + B.name + B.change + 2, y + 3, { width: B.saldo - 4, align: "right", lineBreak: false });
    doc.save().strokeColor("#e5e7eb").lineWidth(0.5)
      .moveTo(MARGIN, y + MC_B_ROW_H).lineTo(MARGIN + COL_W, y + MC_B_ROW_H).stroke().restore();
    y += MC_B_ROW_H;
  }

  // Summenzeile
  doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, MC_B_TOT_H).fill().restore();
  doc.font(FONT_B).fontSize(8).fillColor("#000");
  doc.text("Summe aller Konten",
    MARGIN + 2, y + 3, { width: B.name - 4, align: "left", lineBreak: false });
  doc.fillColor(totalChange >= 0 ? "#166534" : "#991b1b")
    .text(eurSigned(totalChange),
      MARGIN + B.name + 2, y + 3, { width: B.change - 4, align: "right", lineBreak: false });
  doc.fillColor(totalEnd >= 0 ? "#166534" : "#991b1b")
    .text(eur(totalEnd),
      MARGIN + B.name + B.change + 2, y + 3, { width: B.saldo - 4, align: "right", lineBreak: false });
  doc.save().strokeColor("#64748b").lineWidth(1)
    .moveTo(MARGIN, y + MC_B_TOT_H).lineTo(MARGIN + COL_W, y + MC_B_TOT_H).stroke().restore();
  y += MC_B_TOT_H + 8;

  return y;
}

// ── GET ────────────────────────────────────────────────────────────────────
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

  const [rows, extAccts] = await Promise.all([
    db.select({
        receiptNumber:     transactions.receiptNumber,
        bookingDate:       transactions.bookingDate,
        description:       transactions.description,
        direction:         transactions.direction,
        amount:            transactions.amount,
        externalAccountId: transactions.externalAccountId,
        extAccountName:    externalAccounts.name,
        intAccountNumber:  internalAccounts.number,
        intAccountName:    internalAccounts.name,
        memberLastName:    members.lastName,
        memberFirstName:   members.firstName,
      })
      .from(transactions)
      .innerJoin(externalAccounts, eq(transactions.externalAccountId, externalAccounts.id))
      .innerJoin(internalAccounts, eq(transactions.internalAccountId, internalAccounts.id))
      .leftJoin(members, eq(transactions.memberId, members.id))
      .where(eq(transactions.fiscalYearId, fyId))
      .orderBy(asc(transactions.bookingDate), asc(transactions.receiptNumber)),

    db.select({ id: externalAccounts.id, name: externalAccounts.name })
      .from(externalAccounts)
      .where(eq(externalAccounts.isActive, true))
      .orderBy(asc(externalAccounts.sortOrder)),
  ]);

  // Buchungen nach Monat gruppieren (Rows sind bereits nach Datum sortiert)
  type MonthGroup = { key: string; label: string; rows: typeof rows };
  const monthGroups: MonthGroup[] = [];
  for (const row of rows) {
    const key  = row.bookingDate.substring(0, 7); // "YYYY-MM"
    const last = monthGroups[monthGroups.length - 1];
    if (!last || last.key !== key) {
      const [yr, mo] = key.split("-");
      monthGroups.push({ key, label: `${MONTH_NAMES_DE[parseInt(mo) - 1]} ${yr}`, rows: [] });
    }
    monthGroups[monthGroups.length - 1].rows.push(row);
  }

  // PDF generieren
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: MARGIN, autoFirstPage: true });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   resolve);
    doc.on("error", reject);

    const today = new Date().toLocaleDateString("de-DE");
    let pageNum = 1;

    function addPageHeader(): number {
      const y0 = MARGIN;
      doc.font(FONT_B).fontSize(13).fillColor("#000")
        .text(`${appSettings.clubName} — Kassenbuch ${fy.label}`, MARGIN, y0);
      doc.font(FONT_R).fontSize(8).fillColor("#666")
        .text(
          `Erstellt: ${today}   |   Zeitraum: ${fmtDate(fy.dateFrom)} – ${fmtDate(fy.dateTo)}   |   Seite ${pageNum}`,
          MARGIN, y0 + 16, { width: COL_W, align: "right" }
        );
      doc.save().strokeColor("#000").lineWidth(0.8)
        .moveTo(MARGIN, y0 + 28).lineTo(MARGIN + COL_W, y0 + 28).stroke().restore();
      drawHeader(doc, y0 + 34);
      return y0 + 34 + HEAD_H + 2;
    }

    let y = addPageHeader();

    // Laufende Salden je externem Konto (Start = 0, aufkumuliert im Buchungsjahr)
    const runningBals: Record<number, number> = {};
    for (const a of extAccts) runningBals[a.id] = 0;

    let totalIn  = 0;
    let totalOut = 0;
    let rowIdx   = 0;   // für Zeilenstreifen über Monatsgrenzen hinweg

    for (const group of monthGroups) {
      // Salden zu Monatsbeginn sichern
      const prevBals: Record<number, number> = { ...runningBals };
      let monthIn  = 0;
      let monthOut = 0;

      for (const row of group.rows) {
        if (y + ROW_H > doc.page.height - MARGIN - 30) {
          doc.addPage();
          pageNum++;
          y = addPageHeader();
          rowIdx = 0;
        }

        const amount = parseFloat(row.amount);
        const isIn   = row.direction === "in";
        if (isIn) { monthIn += amount; totalIn  += amount; runningBals[row.externalAccountId] += amount; }
        else       { monthOut += amount; totalOut += amount; runningBals[row.externalAccountId] -= amount; }

        const desc = [
          row.description ?? "",
          row.memberLastName ? `${row.memberLastName}, ${row.memberFirstName}` : "",
        ].filter(Boolean).join(" / ").substring(0, 55);

        drawRow(doc, [
          row.receiptNumber ?? "–",
          fmtDate(row.bookingDate),
          desc || "–",
          (row.extAccountName ?? "").substring(0, 3),
          `${row.intAccountNumber} ${row.intAccountName}`,
          isIn  ? eur(amount) : "",
          !isIn ? eur(amount) : "",
        ], y, { bg: rowIdx % 2 === 0 ? "#f9fafb" : undefined });
        y += ROW_H;
        rowIdx++;
      }

      // Monatsabschluss
      const mcH = estimateMCHeight(extAccts.length);
      if (y + mcH > doc.page.height - MARGIN) {
        doc.addPage();
        pageNum++;
        y = addPageHeader();
        rowIdx = 0;
      }
      y = drawMonthlyClosing(doc, y, group.label, monthIn, monthOut, extAccts, prevBals, runningBals);

      // Seitenumbruch nach jedem Monatsabschluss (außer nach dem letzten)
      if (group !== monthGroups[monthGroups.length - 1]) {
        doc.addPage();
        pageNum++;
        y = addPageHeader();
      }
      rowIdx = 0;
    }

    // Jahressumme
    if (y + ROW_H + 10 > doc.page.height - MARGIN - 30) {
      doc.addPage(); pageNum++; y = addPageHeader();
    }
    drawRow(doc, [
      "", "", "Jahressummen", "", "",
      eur(totalIn), eur(totalOut),
    ], y, { bold: true, bg: "#e5e7eb" });

    doc.end();
  });

  const buffer = Buffer.concat(chunks);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Kassenbuch-${fy.label}.pdf"`,
    },
  });
}
