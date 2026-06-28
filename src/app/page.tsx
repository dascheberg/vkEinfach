import { getSettings } from "@/lib/utils/settings";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSettings();
  if (!settings.setupComplete) redirect("/setup");
  redirect("/login");
}
