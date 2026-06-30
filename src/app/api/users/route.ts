import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      function: user.userFunction,
      banned: user.banned,
      approved: user.approved,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.name));

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, email, username: uname, password, role: newRole, function: newFunction, approved: approve } = body;

  if (!name || !password) {
    return NextResponse.json({ error: "Name und Passwort sind erforderlich" }, { status: 400 });
  }
  if (!email && !uname) {
    return NextResponse.json({ error: "E-Mail oder Benutzername erforderlich" }, { status: 400 });
  }

  // Use placeholder email for username-only users
  const effectiveEmail = email?.trim() || `${uname}@intern.local`;

  try {
    await auth.api.signUpEmail({
      body: { name, email: effectiveEmail, password },
    });
  } catch {
    return NextResponse.json({ error: "E-Mail bereits vergeben oder ungültig" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    role: newRole ?? "member",
    userFunction: newFunction ?? "M",
    approved: approve === true,
  };
  if (uname?.trim()) updates.username = uname.trim().toLowerCase();

  await db.update(user).set(updates).where(eq(user.email, effectiveEmail));

  const [newUser] = await db
    .select({ id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, function: user.userFunction, banned: user.banned, approved: user.approved, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.email, effectiveEmail));

  return NextResponse.json(newUser, { status: 201 });
}
