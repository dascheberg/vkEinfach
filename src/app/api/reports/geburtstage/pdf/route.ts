import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

function fmtDate(s: string | null | undefined) {
  if (!s) return "–";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

const MARGIN = 50;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const COL_W  = PAGE_W - MARGIN * 2;
const FONT_B = "Helvetica-Bold";
const FONT_R = "Helvetica";
const ROW_H  = 17;
const HEAD_H = 18;

function drawLine(doc: PDFKit.PDFDocument, y: number, color = "#e5e7eb", w = 0.5) {
  doc.save().strokeColor(color).lineWidth(w)
    .moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore();
}

function drawSectionHeader(doc: PDFKit.PDFDocument, y: number, title: string): number {
  doc.save().fillColor("#1e3a5f").rect(MARGIN, y, COL_W, HEAD_H).fill().restore();
  doc.font(FONT_B).fontSize(10).fillColor("#fff")
    .text(title, MARGIN + 6, y + 4, { lineBreak: false });
  return y + HEAD_H;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));

  const appSettings = await getSettings();

  // Runde Geburtstage: Alter im Zieljahr ≥ 70 und durch 5 teilbar
  // Sortiert nach Monat/Tag des Geburtstags
  const birthdayMembers = await db.select({
    lastName:  members.lastName,
    firstName: members.firstName,
    birthDate: members.birthDate,
    age:       sql<number>`(${year} - EXTRACT(YEAR FROM ${members.birthDate})::INT)`,
  })
  .from(members)
  .where(and(
    eq(members.isActive, true),
    isNotNull(members.birthDate),
    sql`${members.birthDate} IS NOT NULL`,
    sql`(${year} - EXTRACT(YEAR FROM ${members.birthDate})::INT) >= 70`,
    sql`(${year} - EXTRACT(YEAR FROM ${members.birthDate})::INT) % 5 = 0`,
  ))
  .orderBy(
    sql`EXTRACT(MONTH FROM ${members.birthDate})`,
    sql`EXTRACT(DAY FROM ${members.birthDate})`,
    members.lastName,
  );

  // Mitgliedsjubiläen: Jahre im Zieljahr ≥ 10 und durch 5 teilbar
  const anniversaryMembers = await db.select({
    lastName:  members.lastName,
    firstName: members.firstName,
    joinedAt:  members.joinedAt,
    years:     sql<number>`(${year} - EXTRACT(YEAR FROM ${members.joinedAt})::INT)`,
  })
  .from(members)
  .where(and(
    eq(members.isActive, true),
    isNotNull(members.joinedAt),
    sql`${members.joinedAt} IS NOT NULL`,
    sql`(${year} - EXTRACT(YEAR FROM ${members.joinedAt})::INT) >= 10`,
    sql`(${year} - EXTRACT(YEAR FROM ${members.joinedAt})::INT) % 5 = 0`,
  ))
  .orderBy(
    sql`EXTRACT(MONTH FROM ${members.joinedAt})`,
    sql`EXTRACT(DAY FROM ${members.joinedAt})`,
    members.lastName,
  );

  const doc = new PDFDocument({ size: "A4", layout: "portrait", margin: MARGIN, autoFirstPage: true });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   resolve);
    doc.on("error", reject);

    const today = new Date().toLocaleDateString("de-DE");
    let y = MARGIN;

    function checkPageBreak(needed: number) {
      if (y + needed > PAGE_H - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
    }

    // Kopf
    doc.font(FONT_B).fontSize(16).fillColor("#000").text(appSettings.clubName, MARGIN, y);
    y += 22;
    doc.font(FONT_R).fontSize(11).fillColor("#555").text(appSettings.clubSubtitle, MARGIN, y);
    y += 22;
    doc.font(FONT_B).fontSize(14).fillColor("#000")
      .text(`Geburtstage und Jubiläen ${year}`, MARGIN, y);
    y += 18;
    doc.font(FONT_R).fontSize(9).fillColor("#666")
      .text(`Erstellt: ${today}`, MARGIN, y);
    y += 12;
    drawLine(doc, y, "#000", 1);
    y += 14;

    // ── Runde Geburtstage ─────────────────────────────────
    checkPageBreak(HEAD_H + ROW_H);
    y = drawSectionHeader(doc, y, `Runde Geburtstage ${year}  (ab 70 Jahre, alle 5 Jahre)`);

    if (birthdayMembers.length === 0) {
      doc.font(FONT_R).fontSize(10).fillColor("#666")
        .text("Keine runden Geburtstage in diesem Jahr.", MARGIN + 4, y + 5);
      y += ROW_H + 8;
    } else {
      // Spalten: Name(200) | Vorname(150) | Geburtsdatum(100) | Alter(45)
      const C = { last: 200, first: 150, date: 110, age: 35 };
      // Tabellenkopf
      doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, 16).fill().restore();
      doc.font(FONT_B).fontSize(8).fillColor("#1e293b");
      doc.text("Nachname",     MARGIN + 4,                             y + 3, { width: C.last  - 6, align: "left",  lineBreak: false });
      doc.text("Vorname",      MARGIN + C.last + 4,                    y + 3, { width: C.first - 6, align: "left",  lineBreak: false });
      doc.text("Geburtsdatum", MARGIN + C.last + C.first + 4,          y + 3, { width: C.date  - 6, align: "left",  lineBreak: false });
      doc.text("Alter",        MARGIN + C.last + C.first + C.date + 4, y + 3, { width: C.age   - 4, align: "right", lineBreak: false });
      y += 16;

      birthdayMembers.forEach((m, i) => {
        checkPageBreak(ROW_H);
        if (i % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
        doc.font(FONT_R).fontSize(10).fillColor("#000");
        doc.text(m.lastName,      MARGIN + 4,                             y + 3, { width: C.last  - 6, align: "left",  lineBreak: false });
        doc.text(m.firstName,     MARGIN + C.last + 4,                    y + 3, { width: C.first - 6, align: "left",  lineBreak: false });
        doc.text(fmtDate(m.birthDate), MARGIN + C.last + C.first + 4,    y + 3, { width: C.date  - 6, align: "left",  lineBreak: false });
        doc.font(FONT_B).fillColor("#166534")
          .text(`${m.age}`, MARGIN + C.last + C.first + C.date + 4, y + 3, { width: C.age - 4, align: "right", lineBreak: false });
        drawLine(doc, y + ROW_H);
        y += ROW_H;
      });
      doc.font(FONT_R).fontSize(9).fillColor("#666")
        .text(`${birthdayMembers.length} Jubilare`, MARGIN + 4, y + 4);
      y += 20;
    }

    // ── Mitgliedsjubiläen ──────────────────────────────────
    checkPageBreak(HEAD_H + ROW_H + 20);
    y += 8;
    y = drawSectionHeader(doc, y, `Mitgliedsjubiläen ${year}  (ab 10 Jahre, alle 5 Jahre)`);

    if (anniversaryMembers.length === 0) {
      doc.font(FONT_R).fontSize(10).fillColor("#666")
        .text("Keine Mitgliedsjubiläen in diesem Jahr.", MARGIN + 4, y + 5);
      y += ROW_H + 8;
    } else {
      // Spalten: Name(200) | Vorname(150) | Mitglied seit(110) | Jahre(35)
      const C = { last: 200, first: 150, date: 110, years: 35 };
      doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, 16).fill().restore();
      doc.font(FONT_B).fontSize(8).fillColor("#1e293b");
      doc.text("Nachname",      MARGIN + 4,                             y + 3, { width: C.last  - 6, align: "left",  lineBreak: false });
      doc.text("Vorname",       MARGIN + C.last + 4,                    y + 3, { width: C.first - 6, align: "left",  lineBreak: false });
      doc.text("Mitglied seit", MARGIN + C.last + C.first + 4,          y + 3, { width: C.date  - 6, align: "left",  lineBreak: false });
      doc.text("Jahre",         MARGIN + C.last + C.first + C.date + 4, y + 3, { width: C.years - 4, align: "right", lineBreak: false });
      y += 16;

      anniversaryMembers.forEach((m, i) => {
        checkPageBreak(ROW_H);
        if (i % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
        doc.font(FONT_R).fontSize(10).fillColor("#000");
        doc.text(m.lastName,      MARGIN + 4,                             y + 3, { width: C.last  - 6, align: "left",  lineBreak: false });
        doc.text(m.firstName,     MARGIN + C.last + 4,                    y + 3, { width: C.first - 6, align: "left",  lineBreak: false });
        doc.text(fmtDate(m.joinedAt), MARGIN + C.last + C.first + 4,     y + 3, { width: C.date  - 6, align: "left",  lineBreak: false });
        doc.font(FONT_B).fillColor("#1e40af")
          .text(`${m.years}`, MARGIN + C.last + C.first + C.date + 4, y + 3, { width: C.years - 4, align: "right", lineBreak: false });
        drawLine(doc, y + ROW_H);
        y += ROW_H;
      });
      doc.font(FONT_R).fontSize(9).fillColor("#666")
        .text(`${anniversaryMembers.length} Jubilare`, MARGIN + 4, y + 4);
      y += 20;
    }

    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Geburtstage-Jubilare-${year}.pdf"`,
    },
  });
}
