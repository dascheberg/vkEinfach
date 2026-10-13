/**
 * Austritts-Logik für Mitglieder — reine Funktionen, ohne DB-Zugriff.
 * Dadurch auch in Client-Komponenten verwendbar.
 * Die DB-Operation liegt in memberStatus.server.ts.
 */

/** Datum als ISO-Tag (JJJJ-MM-TT) in lokaler Zeit, ohne Zeitzone-Verschiebung. */
function toIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Ist der Austritt bereits wirksam? Vergleich rein auf Tagesebene:
 * leftAt <= heute. Ein Austritt "zum 31.12.2026" ist bis einschließlich
 * 30.12.2026 noch nicht wirksam.
 */
export function isExitReached(
  leftAt: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!leftAt) return false;
  return leftAt.slice(0, 10) <= toIsoDay(today);
}

/**
 * Soll-Zustand von isActive beim Speichern eines Mitglieds.
 * Erreichtes Austrittsdatum erzwingt inaktiv; sonst gilt die Eingabe.
 * Ein gelöschtes Austrittsdatum reaktiviert NICHT automatisch — damit
 * manuelle Deaktivierungen (z.B. verstorben) nicht überschrieben werden.
 */
export function resolveIsActive(
  leftAt: string | null | undefined,
  requestedIsActive: boolean,
): boolean {
  if (isExitReached(leftAt)) return false;
  return requestedIsActive;
}
