import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  pdf:  "application/pdf",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
};

// Converts Windows paths to WSL2 /mnt/<drive>/... when running on Linux
function toServerPath(filePath: string): string {
  if (process.platform !== "win32") {
    const m = filePath.match(/^([A-Za-z]):[\\\/](.+)$/);
    if (m) {
      const drive = m[1].toLowerCase();
      const rest  = m[2].replace(/\\/g, "/");
      return `/mnt/${drive}/${rest}`;
    }
  }
  return filePath;
}

// If filePath is a directory (no filename at the end), append fileName from DB
function resolveFilePath(filePath: string, fileName: string): string {
  const sep = filePath.includes("\\") ? "\\" : "/";
  if (filePath.toLowerCase().endsWith(fileName.toLowerCase())) return filePath;
  const dir = filePath.endsWith(sep) ? filePath : filePath + sep;
  return dir + fileName;
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
  const [receipt] = await db.select().from(receipts).where(eq(receipts.id, parseInt(id)));

  if (!receipt) return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 });

  if (receipt.storageType === "cloud") {
    return NextResponse.json(
      { error: "Cloud-Belege können nicht direkt angezeigt werden." },
      { status: 400 }
    );
  }

  const fullPath   = resolveFilePath(receipt.filePath, receipt.fileName);
  const serverPath = toServerPath(fullPath);

  try {
    const data = await fs.readFile(serverPath);
    const ext  = (receipt.fileType ?? serverPath.split(".").pop() ?? "").toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(receipt.fileName)}"`,
      },
    });
  } catch (err) {
    console.error("[receipts/view] Lesen fehlgeschlagen:", {
      platform:   process.platform,
      storedPath: receipt.filePath,
      fullPath,
      serverPath,
      error:      err instanceof Error ? err.message : err,
    });
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
        <h2>Datei nicht lesbar</h2>
        <table style="border-collapse:collapse;margin-top:1rem">
          <tr><td style="padding:4px 12px 4px 0"><b>Plattform</b></td><td><code>${process.platform}</code></td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Gespeicherter Pfad</b></td><td><code>${receipt.filePath}</code></td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Aufgelöster Pfad</b></td><td><code>${fullPath}</code></td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Server-Pfad</b></td><td><code>${serverPath}</code></td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Fehler</b></td><td><code>${err instanceof Error ? err.message : "Unbekannt"}</code></td></tr>
        </table>
      </body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
