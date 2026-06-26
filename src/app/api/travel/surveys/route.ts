import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { surveys, surveyOptions, surveyVotes } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { asc, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await db
    .select({
      id: surveys.id,
      title: surveys.title,
      status: surveys.status,
      closesAt: surveys.closesAt,
      createdAt: surveys.createdAt,
      voteCount: sql<number>`(SELECT COUNT(*) FROM survey_votes sv WHERE sv.survey_id = surveys.id)`,
    })
    .from(surveys)
    .orderBy(desc(surveys.createdAt));

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "Titel erforderlich" }, { status: 400 });
  if (!body.options || body.options.length < 2) {
    return NextResponse.json({ error: "Mindestens 2 Optionen erforderlich" }, { status: 400 });
  }

  const [survey] = await db
    .insert(surveys)
    .values({ title: body.title.trim(), closesAt: body.closesAt || null })
    .returning();

  for (let i = 0; i < body.options.length; i++) {
    const text = body.options[i]?.trim();
    if (text) {
      await db.insert(surveyOptions).values({ surveyId: survey.id, optionText: text, sortOrder: i });
    }
  }

  const options = await db
    .select()
    .from(surveyOptions)
    .where(eq(surveyOptions.surveyId, survey.id))
    .orderBy(asc(surveyOptions.sortOrder));

  return NextResponse.json({ ...survey, options }, { status: 201 });
}
