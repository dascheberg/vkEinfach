"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [appName,       setAppName]       = useState("vkEinfach");
  const [clubName,      setClubName]      = useState("");
  const [setupComplete, setSetupComplete] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setAppName(d.appName ?? "vkEinfach");
        setClubName(d.clubName ?? "");
        setSetupComplete(d.setupComplete !== false);
      })
      .catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const isEmail = identifier.includes("@");
    let err;

    if (isEmail) {
      const result = await authClient.signIn.email({ email: identifier, password });
      err = result.error;
    } else {
      const result = await authClient.signIn.username({ username: identifier, password });
      err = result.error;
    }

    if (err) {
      setError("Benutzername/E-Mail oder Passwort falsch.");
      setLoading(false);
      return;
    }

    router.push(setupComplete ? "/dashboard" : "/setup");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="text-xl font-bold text-center mb-2">{appName}</h1>
          {clubName && (
            <p className="text-center text-base text-base-content/60 mb-4">
              {clubName}
            </p>
          )}

          {error && (
            <div className="alert alert-error text-base mb-4">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4" suppressHydrationWarning>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Benutzername oder E-Mail</span>
              </label>
              <input
                type="text"
                className="input input-bordered text-base"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                suppressHydrationWarning
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base">Passwort</span>
              </label>
              <input
                type="password"
                className="input input-bordered text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                suppressHydrationWarning
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary text-base mt-2"
              disabled={loading}
            >
              {loading ? "Anmelden..." : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
