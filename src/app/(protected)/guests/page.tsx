import { requireAuth } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import GuestsClient from "./GuestsClient";

export default async function GuestsPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Gäste</h1>
      <GuestsClient isAdmin={role === "admin"} />
    </div>
  );
}
