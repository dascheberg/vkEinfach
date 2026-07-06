import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { travels, travelParticipants, members, guests } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { getSettings } from "@/lib/utils/settings";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

function fmtDate(d: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const travelId = parseInt(id);

  const [travel] = await db.select().from(travels).where(eq(travels.id, travelId));
  if (!travel) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const rows = await db
    .select({
      isRegistered: travelParticipants.isRegistered,
      isPaid: travelParticipants.isPaid,
      memberId: travelParticipants.memberId,
      memberLastName: members.lastName,
      memberFirstName: members.firstName,
      guestLastName: guests.lastName,
      guestFirstName: guests.firstName,
    })
    .from(travelParticipants)
    .leftJoin(members, eq(travelParticipants.memberId, members.id))
    .leftJoin(guests, eq(travelParticipants.guestId, guests.id))
    .where(eq(travelParticipants.travelId, travelId))
    .orderBy(asc(members.lastName), asc(guests.lastName));

  const participants = rows.map((r) => ({
    isRegistered: r.isRegistered,
    isPaid: r.isPaid,
    type: r.memberId ? "Mitglied" : "Gast",
    lastName: (r.memberId ? r.memberLastName : r.guestLastName) ?? "",
    firstName: (r.memberId ? r.memberFirstName : r.guestFirstName) ?? "",
  }));

  const paid = participants.filter((p) => p.isPaid);
  const unpaid = participants.filter((p) => !p.isPaid);

  const appSettings = await getSettings();
  const dateRange = travel.dateFrom
    ? travel.dateTo && travel.dateTo !== travel.dateFrom
      ? `${fmtDate(travel.dateFrom)} – ${fmtDate(travel.dateTo)}`
      : fmtDate(travel.dateFrom)
    : "–";

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
    doc.font(FONT_B).fontSize(14).fillColor("#000").text(`Teilnehmerliste: ${travel.name}`, MARGIN, y);
    y += 18;
    doc.font(FONT_R).fontSize(9).fillColor("#666")
      .text(`Zeitraum: ${dateRange}   |   Erstellt: ${today}   |   Teilnehmer: ${participants.length}`, MARGIN, y);
    y += 12;
    doc.save().strokeColor("#000").lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore();
    y += 14;

    // Spalten: Nr(28) | Nachname(165) | Vorname(135) | Typ(90) | Angemeldet(77)
    const C = { nr: 28, last: 165, first: 135, type: 90, reg: 77 };

    function drawTableHeader(bgColor: string) {
      doc.save().fillColor(bgColor).rect(MARGIN, y, COL_W, 16).fill().restore();
      doc.font(FONT_B).fontSize(8).fillColor("#fff");
      let x = MARGIN + 4;
      doc.text("Nr.",         x, y + 3, { width: C.nr    - 4, align: "right", lineBreak: false }); x += C.nr;
      doc.text("Nachname",    x, y + 3, { width: C.last  - 4, align: "left",  lineBreak: false }); x += C.last;
      doc.text("Vorname",     x, y + 3, { width: C.first - 4, align: "left",  lineBreak: false }); x += C.first;
      doc.text("Typ",         x, y + 3, { width: C.type  - 4, align: "left",  lineBreak: false }); x += C.type;
      doc.text("Angemeldet",  x, y + 3, { width: C.reg   - 4, align: "left",  lineBreak: false });
      y += 16;
    }

    function drawParticipantRow(p: typeof participants[number], idx: number) {
      checkPageBreak(ROW_H);
      if (idx % 2 === 0) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
      doc.font(FONT_R).fontSize(9).fillColor("#000");
      let x = MARGIN + 4;
      doc.text(String(idx + 1), x, y + 3, { width: C.nr    - 4, align: "right", lineBreak: false }); x += C.nr;
      doc.text(p.lastName,      x, y + 3, { width: C.last  - 4, align: "left",  lineBreak: false }); x += C.last;
      doc.text(p.firstName,     x, y + 3, { width: C.first - 4, align: "left",  lineBreak: false }); x += C.first;
      doc.text(p.type,          x, y + 3, { width: C.type  - 4, align: "left",  lineBreak: false }); x += C.type;
      doc.text(p.isRegistered ? "Ja" : "Nein", x, y + 3, { width: C.reg - 4, align: "left", lineBreak: false });
      drawLine(doc, y + ROW_H);
      y += ROW_H;
    }

    // ── Noch nicht bezahlt ───────────────────────────────
    checkPageBreak(18 + 16 + ROW_H);
    doc.save().fillColor("#991b1b").rect(MARGIN, y, COL_W, 18).fill().restore();
    doc.font(FONT_B).fontSize(10).fillColor("#fff")
      .text(`Noch nicht bezahlt  (${unpaid.length} Personen)`, MARGIN + 6, y + 4, { lineBreak: false });
    y += 18;
    drawTableHeader("#7f1d1d");
    unpaid.forEach((p, i) => drawParticipantRow(p, i));
    if (unpaid.length === 0) {
      doc.font(FONT_R).fontSize(10).fillColor("#666").text("Alle Teilnehmer haben bezahlt.", MARGIN + 4, y + 4);
      y += ROW_H;
    }
    y += 12;

    // ── Bezahlt ──────────────────────────────────────────
    checkPageBreak(18 + 16 + ROW_H);
    doc.save().fillColor("#166534").rect(MARGIN, y, COL_W, 18).fill().restore();
    doc.font(FONT_B).fontSize(10).fillColor("#fff")
      .text(`Bezahlt  (${paid.length} Personen)`, MARGIN + 6, y + 4, { lineBreak: false });
    y += 18;
    drawTableHeader("#14532d");
    paid.forEach((p, i) => drawParticipantRow(p, i));
    y += 12;

    // Gesamtzeile
    checkPageBreak(24);
    doc.save().fillColor("#e2e8f0").rect(MARGIN, y, COL_W, 22).fill().restore();
    doc.font(FONT_B).fontSize(10).fillColor("#000")
      .text(`Gesamt: ${participants.length} Teilnehmer  |  Bezahlt: ${paid.length}  |  Offen: ${unpaid.length}`,
        MARGIN + 6, y + 5, { lineBreak: false });
    drawLine(doc, y + 22, "#64748b", 1);

    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Teilnehmerliste-${travel.name.replace(/[^\w\-]+/g, "_")}.pdf"`,
    },
  });
}
