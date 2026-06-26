import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) === "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [member] = await db.select().from(members).where(eq(members.id, parseInt(id)));
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(member);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const [member] = await db
    .update(members)
    .set({
      lastName: body.lastName,
      firstName: body.firstName,
      street: body.street || null,
      zip: body.zip || null,
      city: body.city || null,
      birthDate: body.birthDate || null,
      phoneLandline: body.phoneLandline || null,
      phoneMobile: body.phoneMobile || null,
      email: body.email || null,
      function: body.function || "M",
      joinedAt: body.joinedAt || null,
      leftAt: body.leftAt || null,
      deceased: body.deceased ?? false,
      isActive: body.isActive ?? true,
      feePaidCurrentYear: body.feePaidCurrentYear ?? false,
      feeNotes: body.feeNotes || null,
      notes: body.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(members.id, parseInt(id)))
    .returning();

  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const [member] = await db
    .update(members)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(members.id, parseInt(id)))
    .returning();

  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(member);
}
