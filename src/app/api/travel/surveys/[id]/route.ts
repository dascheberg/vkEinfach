import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { surveys, surveyOptions, surveyVotes, members } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, asc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRole(session: Awaited<ReturnType<typeof auth.api.getSession>>): string {
  return (session?.user as { role?: string })?.role ?? "member";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const surveyId = parseInt(id);

  const [survey] = await db.select().from(surveys).where(eq(surveys.id, surveyId));
  if (!survey) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const options = await db
    .select({
      id: surveyOptions.id,
      optionText: surveyOptions.optionText,
      sortOrder: surveyOptions.sortOrder,
      voteCount: sql<number>`(SELECT COUNT(*) FROM survey_votes sv WHERE sv.option_id = survey_options.id)`,
    })
    .from(surveyOptions)
    .where(eq(surveyOptions.surveyId, surveyId))
    .orderBy(asc(surveyOptions.sortOrder));

  // Find member_id for current user (to check if already voted)
  const userEmail = session.user.email;
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, userEmail));

  let myVoteOptionId: number | null = null;
  if (member) {
    const [myVote] = await db
      .select({ optionId: surveyVotes.optionId })
      .from(surveyVotes)
      .where(and(eq(surveyVotes.memberId, member.id), eq(surveyVotes.surveyId, surveyId)));
    myVoteOptionId = myVote?.optionId ?? null;
  }

  return NextResponse.json({ ...survey, options, myVoteOptionId, canVote: !!member });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getRole(session) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const [updated] = await db
    .update(surveys)
    .set({ status: body.status })
    .where(eq(surveys.id, parseInt(id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(updated);
}
