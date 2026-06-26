import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, externalAccounts, fiscalYears } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

function eur(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}
function fmtDate(s: string | null) {
  if (!s) return "–";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

const MARGIN = 50;
const PAGE_W = 595.28;
const COL_W  = PAGE_W - MARGIN * 2;
const FONT_B = "Helvetica-Bold";
const FONT_R = "Helvetica";
const ROW_H  = 18;

const TYPE_LABELS: Record<string, string> = {
  cash: "Barkasse", bank: "Bank", savings: "Sparkonto",
};

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

  const [extAccounts, balanceRows] = await Promise.all([
    db.select().from(externalAccounts)
      .where(eq(externalAccounts.isActive, true))
      .orderBy(asc(externalAccounts.sortOrder)),
    db.select({
      externalAccountId: transactions.externalAccountId,
      net: sql<string>`COALESCE(SUM(CASE WHEN direction='in' THEN amount::numeric ELSE -(amount::numeric) END),0)`,
    })
    .from(transactions)
    .where(eq(transactions.fiscalYearId, fyId))
    .groupBy(transactions.externalAccountId),
  ]);

  const balances: Record<number, number> = {};
  for (const r of balanceRows) balances[r.externalAccountId] = parseFloat(r.net);
  const total = extAccounts.reduce((s, a) => s + (balances[a.id] ?? 0), 0);

  const doc = new PDFDocument({ size: "A4", layout: "portrait", margin: MARGIN, autoFirstPage: true });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   resolve);
    doc.on("error", reject);

    const today = new Date().toLocaleDateString("de-DE");
    let y = MARGIN;

    // Kopf
    doc.font(FONT_B).fontSize(16).fillColor("#000").text(appSettings.clubName, MARGIN, y);
    y += 22;
    doc.font(FONT_R).fontSize(11).fillColor("#555").text(appSettings.clubSubtitle, MARGIN, y);
    y += 22;
    doc.font(FONT_B).fontSize(14).fillColor("#000").text(`Vermögensaufstellung ${fy.label}`, MARGIN, y);
    y += 18;
    doc.font(FONT_R).fontSize(9).fillColor("#666")
      .text(`Buchungsjahr: ${fmtDate(fy.dateFrom)} – ${fmtDate(fy.dateTo)}   |   Stand: ${today}`, MARGIN, y);
    y += 14;
    doc.save().strokeColor("#000").lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore();
    y += 14;

    // Tabellenkopf
    const C = { name: 230, type: 120, bal: 145 };
    doc.save().fillColor("#1e293b").rect(MARGIN, y, COL_W, 18).fill().restore();
    doc.font(FONT_B).fontSize(9).fillColor("#fff");
    doc.text("Konto",   MARGIN + 4,                    y + 4, { width: C.name - 6, align: "left",  lineBreak: false });
    doc.text("Typ",     MARGIN + C.name + 4,            y + 4, { width: C.type - 6, align: "left",  lineBreak: false });
    doc.text("Saldo",   MARGIN + C.name + C.type + 4,  y + 4, { width: C.bal  - 6, align: "right", lineBreak: false });
    y += 18;

    // Kontozeilen
    extAccounts.forEach((a, i) => {
      const bg = i % 2 === 0 ? "#f8fafc" : undefined;
      if (bg) doc.save().fillColor(bg).rect(MARGIN, y, COL_W, ROW_H).fill().restore();
      const bal = balances[a.id] ?? 0;
      doc.font(FONT_R).fontSize(10).fillColor("#000");
      doc.text(a.name, MARGIN + 4, y + 4, { width: C.name - 6, align: "left",  lineBreak: false });
      doc.text(a.accountType ? (TYPE_LABELS[a.accountType] ?? a.accountType) : "–",
        MARGIN + C.name + 4, y + 4, { width: C.type - 6, align: "left", lineBreak: false });
      doc.fillColor(bal >= 0 ? "#166534" : "#991b1b").font(FONT_B)
        .text(eur(bal), MARGIN + C.name + C.type + 4, y + 4, { width: C.bal - 6, align: "right", lineBreak: false });
      doc.save().strokeColor("#e5e7eb").lineWidth(0.5)
        .moveTo(MARGIN, y + ROW_H).lineTo(MARGIN + COL_W, y + ROW_H).stroke().restore();
      y += ROW_H;
    });

    // Summenzeile
    doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
    doc.font(FONT_B).fontSize(10).fillColor("#000");
    doc.text("Gesamtvermögen", MARGIN + 4, y + 4, { width: C.name + C.type - 6, align: "left", lineBreak: false });
    doc.fillColor(total >= 0 ? "#166534" : "#991b1b")
      .text(eur(total), MARGIN + C.name + C.type + 4, y + 4, { width: C.bal - 6, align: "right", lineBreak: false });
    doc.save().strokeColor("#64748b").lineWidth(1)
      .moveTo(MARGIN, y + ROW_H).lineTo(MARGIN + COL_W, y + ROW_H).stroke().restore();
    y += ROW_H + 40;

    // Unterschrift
    doc.save().strokeColor("#000").lineWidth(0.5)
      .moveTo(MARGIN, y).lineTo(MARGIN + 220, y).stroke().restore();
    doc.font(FONT_R).fontSize(8).fillColor("#666")
      .text("Kassenwart / Datum", MARGIN, y + 4);

    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Vermoegen-${fy.label}.pdf"`,
    },
  });
}
