import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";

/**
 * Deaktiviert alle Mitglieder, deren Austrittsdatum erreicht ist.
 * Gibt die Anzahl der geänderten Datensätze zurück. Trifft im Regelfall
 * keine Zeile und ist dann ein No-Op.
 *
 * Nur serverseitig verwendbar (DB-Zugriff). Die reine Datumslogik steht
 * in memberStatus.ts.
 */
export async function syncExitedMembers(): Promise<number> {
  const updated = await db
    .update(members)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        isNotNull(members.leftAt),
        lte(members.leftAt, sql`CURRENT_DATE`),
        eq(members.isActive, true),
      ),
    )
    .returning({ id: members.id });

  return updated.length;
}
