import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import { dayMonthKey, formatDate } from "@/lib/utils/calculations";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

const MARGIN = 50;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const COL_W  = PAGE_W - MARGIN * 2;
const FONT_B = "Helvetica-Bold";
const FONT_R = "Helvetica";
const ROW_H  = 16;

function drawLine(doc: PDFKit.PDFDocument, y: number) {
  doc.save().strokeColor("#e5e7eb").lineWidth(0.5).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore();
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from und to erforderlich" }, { status: 400 });

  const fromKey = dayMonthKey(from);
  const toKey   = dayMonthKey(to);
  const toYear  = parseInt(to.slice(0, 4));

  const [appSettings, rows] = await Promise.all([
    getSettings(),
    db.select({
      lastName:  members.lastName,
      firstName: members.firstName,
      birthDate: members.birthDate,
    })
    .from(members)
    .where(and(
      eq(members.isActive, true),
      isNotNull(members.birthDate),
      sql`(EXTRACT(MONTH FROM ${members.birthDate})::int * 100 + EXTRACT(DAY FROM ${members.birthDate})::int) BETWEEN ${fromKey} AND ${toKey}`,
    ))
    .orderBy(
      sql`EXTRACT(MONTH FROM ${members.birthDate})`,
      sql`EXTRACT(DAY FROM ${members.birthDate})`,
      members.lastName,
    ),
  ]);

  const list = rows.map(m => ({
    ...m,
    age: toYear - parseInt(m.birthDate!.slice(0, 4)),
  }));

  const today = new Date().toLocaleDateString("de-DE");
  const zeitraum = `${formatDate(from)} – ${formatDate(to)}`;

  const doc    = new PDFDocument({ size: "A4", layout: "portrait", margin: MARGIN, autoFirstPage: true });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   resolve);
    doc.on("error", reject);

    let y = MARGIN;

    function checkPageBreak(needed: number) {
      if (y + needed > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
    }

    // Header
    doc.font(FONT_B).fontSize(16).fillColor("#000").text(appSettings.clubName, MARGIN, y); y += 22;
    if (appSettings.clubSubtitle) {
      doc.font(FONT_R).fontSize(10).fillColor("#555").text(appSettings.clubSubtitle, MARGIN, y); y += 18;
    }
    doc.font(FONT_B).fontSize(14).fillColor("#000").text(`Geburtstage im Zeitraum ${zeitraum}`, MARGIN, y); y += 18;
    doc.font(FONT_R).fontSize(9).fillColor("#666").text(`Erstellt: ${today}   |   ${list.length} Mitglieder`, MARGIN, y); y += 14;
    doc.save().strokeColor("#000").lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore(); y += 12;

    // Table header
    const C = { last: 160, first: 130, date: 90, age: 50 };
    doc.save().fillColor("#1e3a5f").rect(MARGIN, y, COL_W, 16).fill().restore();
    doc.font(FONT_B).fontSize(8).fillColor("#fff");
    let x = MARGIN + 4;
    doc.text("Nachname",      x, y + 3, { width: C.last  - 4, lineBreak: false }); x += C.last;
    doc.text("Vorname",       x, y + 3, { width: C.first - 4, lineBreak: false }); x += C.first;
    doc.text("Geburtsdatum",  x, y + 3, { width: C.date  - 4, lineBreak: false }); x += C.date;
    doc.text("Alter wird",    x, y + 3, { width: C.age   - 4, align: "right", lineBreak: false });
    y += 16;

    if (list.length === 0) {
      doc.font(FONT_R).fontSize(10).fillColor("#666").text("Keine Geburtstage im gewählten Zeitraum.", MARGIN + 4, y + 5);
      y += ROW_H;
    } else {
      list.forEach((m, i) => {
        checkPageBreak(ROW_H);
        if (i % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
        doc.font(FONT_R).fontSize(9).fillColor("#000");
        let cx = MARGIN + 4;
        doc.text(m.lastName,           cx, y + 3, { width: C.last  - 4, lineBreak: false }); cx += C.last;
        doc.text(m.firstName,          cx, y + 3, { width: C.first - 4, lineBreak: false }); cx += C.first;
        doc.text(formatDate(m.birthDate), cx, y + 3, { width: C.date - 4, lineBreak: false }); cx += C.date;
        doc.font(FONT_B).fillColor("#166534")
          .text(`${m.age}`, cx, y + 3, { width: C.age - 4, align: "right", lineBreak: false });
        drawLine(doc, y + ROW_H);
        y += ROW_H;
      });
    }

    // Footer
    y += 12;
    checkPageBreak(24);
    doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, 22).fill().restore();
    doc.font(FONT_B).fontSize(10).fillColor("#000")
      .text(`${list.length} Geburtstage im Zeitraum ${zeitraum}`, MARGIN + 6, y + 5, { lineBreak: false });

    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Geburtstage-${from}-bis-${to}.pdf"`,
    },
  });
}
