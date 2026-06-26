import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members, settings as settingsTable } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import { calculateMemberYears } from "@/lib/utils/calculations";
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
function fmtDate(s: string | null | undefined) {
  if (!s) return "–";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [appSettings, openMembers, settingRows] = await Promise.all([
    getSettings(),
    db.select({
      lastName:  members.lastName,
      firstName: members.firstName,
      joinedAt:  members.joinedAt,
      function:  members.function,
    })
    .from(members)
    .where(and(eq(members.isActive, true), eq(members.feePaidCurrentYear, false)))
    .orderBy(asc(members.lastName), asc(members.firstName)),

    db.select({ key: settingsTable.key, value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "member_fee")),
  ]);

  const memberFee   = settingRows[0]?.value ? parseFloat(settingRows[0].value) : null;
  const totalAmount = memberFee !== null ? openMembers.length * memberFee : null;
  const year        = new Date().getFullYear();
  const today       = new Date().toLocaleDateString("de-DE");

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
    doc.font(FONT_B).fontSize(14).fillColor("#000").text(`Offene Beiträge ${year}`, MARGIN, y); y += 18;
    doc.font(FONT_R).fontSize(9).fillColor("#666").text(`Stand: ${today}   |   ${openMembers.length} Mitglieder`, MARGIN, y); y += 14;
    doc.save().strokeColor("#000").lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore(); y += 12;

    // Table header
    const C = { last: 170, first: 130, joined: 90, years: 70, func: 35 };
    doc.save().fillColor("#7f1d1d").rect(MARGIN, y, COL_W, 16).fill().restore();
    doc.font(FONT_B).fontSize(8).fillColor("#fff");
    let x = MARGIN + 4;
    doc.text("Nachname",      x, y + 3, { width: C.last   - 4, lineBreak: false }); x += C.last;
    doc.text("Vorname",       x, y + 3, { width: C.first  - 4, lineBreak: false }); x += C.first;
    doc.text("Eingetreten",   x, y + 3, { width: C.joined - 4, lineBreak: false }); x += C.joined;
    doc.text("Mitgliedsjahre",x, y + 3, { width: C.years  - 4, lineBreak: false }); x += C.years;
    doc.text("Fkt.",          x, y + 3, { width: C.func   - 4, lineBreak: false });
    y += 16;

    openMembers.forEach((m, i) => {
      checkPageBreak(ROW_H);
      if (i % 2 === 0) doc.save().fillColor("#fef2f2").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
      doc.font(FONT_R).fontSize(9).fillColor("#000");
      let cx = MARGIN + 4;
      const yrs = calculateMemberYears(m.joinedAt);
      doc.text(m.lastName,          cx, y + 3, { width: C.last   - 4, lineBreak: false }); cx += C.last;
      doc.text(m.firstName,         cx, y + 3, { width: C.first  - 4, lineBreak: false }); cx += C.first;
      doc.text(fmtDate(m.joinedAt), cx, y + 3, { width: C.joined - 4, lineBreak: false }); cx += C.joined;
      doc.text(yrs !== null ? `${yrs} J.` : "–", cx, y + 3, { width: C.years - 4, lineBreak: false }); cx += C.years;
      doc.text(m.function,          cx, y + 3, { width: C.func   - 4, lineBreak: false });
      drawLine(doc, y + ROW_H);
      y += ROW_H;
    });

    // Footer
    y += 12;
    checkPageBreak(24);
    doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, 22).fill().restore();
    let footer = `${openMembers.length} Mitglieder mit offenem Beitrag ${year}`;
    if (totalAmount !== null) {
      const formatted = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(totalAmount);
      footer += `  |  Gesamtbetrag: ${formatted}`;
    }
    doc.font(FONT_B).fontSize(10).fillColor("#000").text(footer, MARGIN + 6, y + 5, { lineBreak: false });

    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Offene-Beitraege-${year}.pdf"`,
    },
  });
}
