import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members, guests } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { asc, or, ilike } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const [memberResults, guestResults] = await Promise.all([
    db
      .select({ id: members.id, lastName: members.lastName, firstName: members.firstName, function: members.function })
      .from(members)
      .where(or(ilike(members.lastName, `%${q}%`), ilike(members.firstName, `%${q}%`)))
      .orderBy(asc(members.lastName))
      .limit(10),

    db
      .select({ id: guests.id, lastName: guests.lastName, firstName: guests.firstName })
      .from(guests)
      .where(or(ilike(guests.lastName, `%${q}%`), ilike(guests.firstName, `%${q}%`)))
      .orderBy(asc(guests.lastName))
      .limit(10),
  ]);

  const results = [
    ...memberResults.map((m) => ({ type: "member" as const, id: m.id, lastName: m.lastName, firstName: m.firstName, detail: m.function })),
    ...guestResults.map((g) => ({ type: "guest" as const, id: g.id, lastName: g.lastName, firstName: g.firstName, detail: "Gast" })),
  ].sort((a, b) => a.lastName.localeCompare(b.lastName, "de"));

  return NextResponse.json(results);
}
