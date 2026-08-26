export function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function isRoundBirthday(age: number | null): boolean {
  if (age === null) return false;
  return age >= 80 && age % 5 === 0;
}

export function calculateMemberYears(joinedAt: string | null | undefined): number | null {
  if (!joinedAt) return null;
  const today = new Date();
  const joined = new Date(joinedAt);
  let years = today.getFullYear() - joined.getFullYear();
  const m = today.getMonth() - joined.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < joined.getDate())) years--;
  return years;
}

export function isMemberAnniversary(years: number | null): boolean {
  if (years === null) return false;
  return years >= 10 && years % 5 === 0;
}

export function dayMonthKey(dateStr: string): number {
  const [, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return m * 100 + d;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "–";
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3) return "–";
  const [y, m, d] = parts;
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}
