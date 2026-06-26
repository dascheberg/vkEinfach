import { NextResponse } from "next/server";
import { getSettings, updateSetting } from "@/lib/utils/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getSettings();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { key, value } = await req.json();
    await updateSetting(key, value);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
