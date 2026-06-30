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

  // Passwort vergessen
  const [showForgot,    setShowForgot]    = useState(false);
  const [forgotInput,   setForgotInput]   = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult,  setForgotResult]  = useState<{ ok: boolean; msg: string } | null>(null);

  const isEmail = identifier.includes("@");

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

  async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

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

  function openForgot() {
    setForgotInput(identifier);
    setForgotResult(null);
    setShowForgot(true);
  }

  async function handleForgotSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!forgotInput.trim()) return;
    setForgotLoading(true);
    setForgotResult(null);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotResult({ ok: true, msg: "Der Administrator wurde benachrichtigt und meldet sich bei Ihnen." });
      } else {
        setForgotResult({ ok: false, msg: data.error ?? "Fehler beim Senden. Bitte den Administrator direkt kontaktieren." });
      }
    } catch {
      setForgotResult({ ok: false, msg: "Verbindungsfehler. Bitte den Administrator direkt kontaktieren." });
    }
    setForgotLoading(false);
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

          {!showForgot ? (
            <>
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

              <div className="text-center mt-3">
                <button
                  type="button"
                  className="link link-primary text-base"
                  onClick={openForgot}
                >
                  Passwort vergessen?
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold mb-1">Passwort vergessen</h2>
              <p className="text-base text-base-content/60 mb-4">
                Geben Sie Ihren Benutzernamen oder Ihre E-Mail-Adresse ein.
                Der Administrator wird benachrichtigt und setzt Ihr Passwort zurück.
              </p>

              {forgotResult ? (
                <>
                  <div className={`alert text-base ${forgotResult.ok ? "alert-success" : "alert-error"}`}>
                    {forgotResult.msg}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost text-base mt-4"
                    onClick={() => { setShowForgot(false); setForgotResult(null); }}
                  >
                    ← Zurück zur Anmeldung
                  </button>
                </>
              ) : (
                <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-base">Benutzername oder E-Mail</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered text-base"
                      value={forgotInput}
                      onChange={(e) => setForgotInput(e.target.value)}
                      required
                      autoComplete="username"
                      autoCapitalize="none"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary text-base"
                    disabled={forgotLoading || !forgotInput.trim()}
                  >
                    {forgotLoading ? "Wird gesendet..." : "Anfrage senden"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost text-base"
                    onClick={() => setShowForgot(false)}
                  >
                    ← Zurück zur Anmeldung
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
