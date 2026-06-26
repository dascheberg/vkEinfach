import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
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
const ROW_H  = 16;

function drawLine(doc: PDFKit.PDFDocument, y: number, color = "#e5e7eb", w = 0.5) {
  doc.save().strokeColor(color).lineWidth(w)
    .moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore();
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const appSettings = await getSettings();
  const year = new Date().getFullYear();

  const allMembers = await db.select({
    lastName:           members.lastName,
    firstName:          members.firstName,
    birthDate:          members.birthDate,
    joinedAt:           members.joinedAt,
    feePaidCurrentYear: members.feePaidCurrentYear,
  })
  .from(members)
  .where(eq(members.isActive, true))
  .orderBy(asc(members.lastName), asc(members.firstName));

  const paid   = allMembers.filter((m) => m.feePaidCurrentYear);
  const unpaid = allMembers.filter((m) => !m.feePaidCurrentYear);

  const doc = new PDFDocument({ size: "A4", layout: "portrait", margin: MARGIN, autoFirstPage: true });
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

    // Kopf
    doc.font(FONT_B).fontSize(16).fillColor("#000").text(appSettings.clubName, MARGIN, y);
    y += 22;
    doc.font(FONT_R).fontSize(11).fillColor("#555").text(appSettings.clubSubtitle, MARGIN, y);
    y += 22;
    doc.font(FONT_B).fontSize(14).fillColor("#000").text(`Beitragsstand ${year}`, MARGIN, y);
    y += 18;
    doc.font(FONT_R).fontSize(9).fillColor("#666")
      .text(`Erstellt: ${today}   |   Aktive Mitglieder: ${allMembers.length}`, MARGIN, y);
    y += 12;
    doc.save().strokeColor("#000").lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore();
    y += 14;

    // Spalten: Nr(28) | Nachname(160) | Vorname(130) | Geburtstag(90) | Beitritt(90)
    const C = { nr: 28, last: 165, first: 135, birth: 90, joined: 77 };

    function drawTableHeader(bgColor: string) {
      doc.save().fillColor(bgColor).rect(MARGIN, y, COL_W, 16).fill().restore();
      doc.font(FONT_B).fontSize(8).fillColor("#fff");
      let x = MARGIN + 4;
      doc.text("Nr.",        x, y + 3, { width: C.nr    - 4, align: "right", lineBreak: false }); x += C.nr;
      doc.text("Nachname",   x, y + 3, { width: C.last  - 4, align: "left",  lineBreak: false }); x += C.last;
      doc.text("Vorname",    x, y + 3, { width: C.first - 4, align: "left",  lineBreak: false }); x += C.first;
      doc.text("Geburtstag", x, y + 3, { width: C.birth - 4, align: "left",  lineBreak: false }); x += C.birth;
      doc.text("Beitritt",   x, y + 3, { width: C.joined- 4, align: "left",  lineBreak: false });
      y += 16;
    }

    function drawMemberRow(m: typeof allMembers[number], idx: number) {
      checkPageBreak(ROW_H);
      if (idx % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
      doc.font(FONT_R).fontSize(9).fillColor("#000");
      let x = MARGIN + 4;
      doc.text(String(idx + 1), x, y + 3, { width: C.nr    - 4, align: "right", lineBreak: false }); x += C.nr;
      doc.text(m.lastName,      x, y + 3, { width: C.last  - 4, align: "left",  lineBreak: false }); x += C.last;
      doc.text(m.firstName,     x, y + 3, { width: C.first - 4, align: "left",  lineBreak: false }); x += C.first;
      doc.text(fmtDate(m.birthDate), x, y + 3, { width: C.birth - 4, align: "left", lineBreak: false }); x += C.birth;
      doc.text(fmtDate(m.joinedAt),  x, y + 3, { width: C.joined- 4, align: "left", lineBreak: false });
      drawLine(doc, y + ROW_H);
      y += ROW_H;
    }

    // ── Beitrag noch offen ───────────────────────────────
    checkPageBreak(18 + 16 + ROW_H);
    doc.save().fillColor("#991b1b").rect(MARGIN, y, COL_W, 18).fill().restore();
    doc.font(FONT_B).fontSize(10).fillColor("#fff")
      .text(`Beitrag noch offen  (${unpaid.length} Mitglieder)`, MARGIN + 6, y + 4, { lineBreak: false });
    y += 18;
    drawTableHeader("#7f1d1d");
    unpaid.forEach((m, i) => drawMemberRow(m, i));
    if (unpaid.length === 0) {
      doc.font(FONT_R).fontSize(10).fillColor("#666").text("Alle Beiträge bezahlt.", MARGIN + 4, y + 4);
      y += ROW_H;
    }
    y += 12;

    // ── Beitrag bezahlt ──────────────────────────────────
    checkPageBreak(18 + 16 + ROW_H);
    doc.save().fillColor("#166534").rect(MARGIN, y, COL_W, 18).fill().restore();
    doc.font(FONT_B).fontSize(10).fillColor("#fff")
      .text(`Beitrag bezahlt  (${paid.length} Mitglieder)`, MARGIN + 6, y + 4, { lineBreak: false });
    y += 18;
    drawTableHeader("#14532d");
    paid.forEach((m, i) => drawMemberRow(m, i));
    y += 12;

    // Gesamtzeile
    checkPageBreak(24);
    doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, 22).fill().restore();
    doc.font(FONT_B).fontSize(10).fillColor("#000")
      .text(`Gesamt: ${allMembers.length} aktive Mitglieder  |  Bezahlt: ${paid.length}  |  Offen: ${unpaid.length}`,
        MARGIN + 6, y + 5, { lineBreak: false });
    drawLine(doc, y + 22, "#64748b", 1);

    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Beitragsstand-${year}.pdf"`,
    },
  });
}
