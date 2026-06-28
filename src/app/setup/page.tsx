import { getSettings } from "@/lib/utils/settings";
import { db } from "@/lib/db";
import { user, fiscalYears } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import SetupWizard from "@/components/ui/SetupWizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const appSettings = await getSettings();
  if (appSettings.setupComplete) redirect("/login");

  const [adminUsers, allFiscalYears] = await Promise.all([
    db.select({ id: user.id }).from(user).where(eq(user.role, "admin")),
    db.select({ id: fiscalYears.id }).from(fiscalYears),
  ]);

  const clubConfigured =
    appSettings.clubName !== "" &&
    appSettings.clubName !== "Mein Verein";

  let initialStep = 1;
  if (clubConfigured && adminUsers.length > 0) {
    initialStep = allFiscalYears.length > 0 ? 3 : 2;
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <SetupWizard initialStep={initialStep} />
    </div>
  );
}
