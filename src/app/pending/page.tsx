"use client";

import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PendingPage() {
  const router = useRouter();
  const [appName, setAppName] = useState("vkEinfach");
  const [clubName, setClubName] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setAppName(d.appName ?? "vkEinfach");
        setClubName(d.clubName ?? "");
      })
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-bold mb-2">{appName}</h1>
          {clubName && <p className="text-base text-base-content/60 mb-4">{clubName}</p>}
          <div className="alert alert-warning mb-6 text-base text-left">
            <div>
              <p className="font-medium">Zugang noch nicht freigeschaltet</p>
              <p className="mt-1">Ihr Account wartet auf die Genehmigung durch den Kassenwart.</p>
            </div>
          </div>
          <p className="text-base text-base-content/60 mb-6">
            Bitte wenden Sie sich an den Kassenwart oder Vorstand.
          </p>
          <button className="btn btn-ghost text-base w-full" onClick={handleSignOut}>
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
