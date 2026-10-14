import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, and, or, ilike, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/lib/utils/settings";
import { syncExitedMembers } from "@/lib/utils/memberStatus.server";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

function fmtDate(s: string | null | undefined) {
  if (!s) return "–";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

// A4 landscape: 841.89 × 595.28 pt
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 40;
const COL_W  = PAGE_W - MARGIN * 2;   // 761.89

// Summe der Spaltenbreiten: 760 — passt in COL_W (761.89)
const COLS = [
  { label: "Nr.",           w: 26,  align: "right" },
  { label: "Nachname",      w: 100, align: "left"  },
  { label: "Vorname",       w: 86,  align: "left"  },
  { label: "Straße",        w: 112, align: "left"  },
  { label: "PLZ",           w: 38,  align: "left"  },
  { label: "Ort",           w: 86,  align: "left"  },
  { label: "Telefon",       w: 80,  align: "left"  },
  { label: "Mobil",         w: 80,  align: "left"  },
  { label: "Geburtstag",    w: 56,  align: "left"  },
  { label: "Mitglied seit", w: 56,  align: "left"  },
  { label: "Fkt.",          w: 40,  align: "left"  },
] as const;

const ROW_H  = 14;
const HEAD_H = 18;
const FONT_B = "Helvetica-Bold";
const FONT_R = "Helvetica";

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.save().fillColor("#1a1a2e").rect(MARGIN, y, COL_W, HEAD_H).fill().restore();
  doc.save().fillColor("#ffffff").font(FONT_B).fontSize(8);
  let x = MARGIN;
  for (const col of COLS) {
    doc.text(col.label, x + 2, y + (HEAD_H - 8) / 2, {
      width: col.w - 4, align: col.align as "left" | "right", lineBreak: false,
    });
    x += col.w;
  }
  doc.restore();
  return y + HEAD_H;
}

function drawRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  y: number,
  opts?: { zebra?: boolean; muted?: boolean }
) {
  const { zebra = false, muted = false } = opts ?? {};
  if (zebra) doc.save().fillColor("#f8fafc").rect(MARGIN, y, COL_W, ROW_H).fill().restore();
  doc.font(FONT_R).fontSize(8).fillColor(muted ? "#94a3b8" : "#000000");
  let x = MARGIN;
  for (let i = 0; i < COLS.length; i++) {
    const col = COLS[i];
    doc.text(cells[i] ?? "", x + 2, y + (ROW_H - 8) / 2, {
      width: col.w - 4, align: col.align as "left" | "right", lineBreak: false,
    });
    x += col.w;
  }
  doc.save().strokeColor("#e5e7eb").lineWidth(0.5)
    .moveTo(MARGIN, y + ROW_H).lineTo(MARGIN + COL_W, y + ROW_H).stroke().restore();
  return y + ROW_H;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role ?? "member";
  if (role === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Austritte, deren Datum erreicht ist, vor dem Laden abgleichen — wie auf /members
  await syncExitedMembers();

  const appSettings = await getSettings();

  // Filter identisch zur Mitgliederseite
  const sp = req.nextUrl.searchParams;
  const search       = sp.get("search") ?? "";
  const showInactive = sp.get("active") === "false";
  const feePaid      = sp.get("feePaid") ?? "all";

  const conditions = [];
  if (!showInactive) conditions.push(eq(members.isActive, true));
  if (feePaid === "true")  conditions.push(eq(members.feePaidCurrentYear, true));
  if (feePaid === "false") conditions.push(eq(members.feePaidCurrentYear, false));

  const nameFilter = search
    ? or(ilike(members.lastName, `%${search}%`), ilike(members.firstName, `%${search}%`))
    : null;

  const where =
    nameFilter && conditions.length > 0
      ? and(...conditions, nameFilter)
      : nameFilter
      ? nameFilter
      : conditions.length > 0
      ? and(...conditions)
      : undefined;

  const list = await db
    .select({
      lastName:      members.lastName,
      firstName:     members.firstName,
      street:        members.street,
      zip:           members.zip,
      city:          members.city,
      phoneLandline: members.phoneLandline,
      phoneMobile:   members.phoneMobile,
      birthDate:     members.birthDate,
      joinedAt:      members.joinedAt,
      function:      members.function,
      isActive:      members.isActive,
    })
    .from(members)
    .where(where)
    .orderBy(asc(members.lastName), asc(members.firstName));

  // Filterhinweis fuer den Kopf — nur wenn vom Standard abgewichen wurde
  const filterParts: string[] = [];
  if (search)       filterParts.push(`Suche: „${search}“`);
  if (showInactive) filterParts.push("inkl. ausgetretener/inaktiver Mitglieder");
  if (feePaid === "true")  filterParts.push("nur Beitrag bezahlt");
  if (feePaid === "false") filterParts.push("nur Beitrag offen");

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: MARGIN, autoFirstPage: true });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   resolve);
    doc.on("error", reject);

    const today = new Date().toLocaleDateString("de-DE");
    let pageNum = 1;

    function drawPageHeader(): number {
      let y = MARGIN;
      doc.font(FONT_B).fontSize(15).fillColor("#000").text(appSettings.clubName, MARGIN, y, { lineBreak: false });
      y += 20;
      if (appSettings.clubSubtitle) {
        doc.font(FONT_R).fontSize(10).fillColor("#555").text(appSettings.clubSubtitle, MARGIN, y, { lineBreak: false });
        y += 16;
      }
      doc.font(FONT_B).fontSize(13).fillColor("#000").text("Mitgliederliste", MARGIN, y, { lineBreak: false });
      y += 17;
      doc.font(FONT_R).fontSize(8).fillColor("#666")
        .text(`Erstellt: ${today}   |   ${list.length} Mitglieder`, MARGIN, y, { lineBreak: false });
      y += 11;
      if (filterParts.length > 0) {
        doc.font(FONT_R).fontSize(8).fillColor("#666")
          .text(`Filter: ${filterParts.join(" · ")}`, MARGIN, y, { lineBreak: false });
        y += 11;
      }
      doc.save().strokeColor("#000").lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + COL_W, y).stroke().restore();
      y += 10;
      return drawTableHeader(doc, y);
    }

    function drawPageFooter() {
      doc.font(FONT_R).fontSize(8).fillColor("#999")
        .text(`Seite ${pageNum}`, MARGIN, PAGE_H - MARGIN + 6, { width: COL_W, align: "right", lineBreak: false });
    }

    let y = drawPageHeader();

    if (list.length === 0) {
      doc.font(FONT_R).fontSize(10).fillColor("#666")
        .text("Keine Mitglieder gefunden.", MARGIN + 4, y + 6, { lineBreak: false });
    }

    list.forEach((m, i) => {
      if (y + ROW_H > PAGE_H - MARGIN - 20) {
        drawPageFooter();
        doc.addPage();
        pageNum++;
        y = drawPageHeader();
      }
      y = drawRow(doc, [
        String(i + 1),
        m.lastName,
        m.firstName,
        m.street ?? "–",
        m.zip ?? "–",
        m.city ?? "–",
        m.phoneLandline ?? "–",
        m.phoneMobile ?? "–",
        fmtDate(m.birthDate),
        fmtDate(m.joinedAt),
        m.function,
      ], y, { zebra: i % 2 === 0, muted: !m.isActive });
    });

    drawPageFooter();
    doc.end();
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Mitgliederliste-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
