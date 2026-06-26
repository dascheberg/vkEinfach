import { requireAuth } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") redirect("/dashboard");

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Benutzer</h1>
      <UsersClient currentUserId={session.user.id} />
    </div>
  );
}
