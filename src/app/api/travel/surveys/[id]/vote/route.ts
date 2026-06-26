import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { surveys, surveyOptions, surveyVotes, members } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const surveyId = parseInt(id);
  const body = await req.json();

  if (!body.optionId) return NextResponse.json({ error: "optionId erforderlich" }, { status: 400 });

  // Survey must be open
  const [survey] = await db.select().from(surveys).where(eq(surveys.id, surveyId));
  if (!survey) return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  if (survey.status !== "open") return NextResponse.json({ error: "Umfrage ist geschlossen" }, { status: 400 });

  // Option must belong to this survey
  const [option] = await db
    .select()
    .from(surveyOptions)
    .where(and(eq(surveyOptions.id, parseInt(body.optionId)), eq(surveyOptions.surveyId, surveyId)));
  if (!option) return NextResponse.json({ error: "Option nicht gefunden" }, { status: 404 });

  // User must have a member record
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, session.user.email));
  if (!member) {
    return NextResponse.json({ error: "Nur Mitglieder können abstimmen" }, { status: 403 });
  }

  // No duplicate vote
  const [existing] = await db
    .select({ id: surveyVotes.id })
    .from(surveyVotes)
    .where(and(eq(surveyVotes.surveyId, surveyId), eq(surveyVotes.memberId, member.id)));
  if (existing) {
    return NextResponse.json({ error: "Bereits abgestimmt" }, { status: 409 });
  }

  const [vote] = await db
    .insert(surveyVotes)
    .values({ surveyId, optionId: parseInt(body.optionId), memberId: member.id })
    .returning();

  return NextResponse.json(vote, { status: 201 });
}
