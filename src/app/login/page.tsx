"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Icon } from "@/components/ui/Icon";
import { IS_PROTOTYPE_DATA } from "@/lib/api";
import { hasSession, setTokens } from "@/lib/api/session";
import { useWorkspace } from "@/providers/workspace-provider";

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

/**
 * Operator sign-in against the real backend (live mode only). Demo mode has
 * no sign-in, so it sends the visitor straight to the workspace.
 */
export default function LoginPage() {
  const router = useRouter();
  const { reload } = useWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (IS_PROTOTYPE_DATA || hasSession()) router.replace("/overview");
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        cache: "no-store"
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : "That email and password did not match an active account."
        );
        setBusy(false);
        return;
      }
      const pair = (await response.json()) as { accessToken: string; refreshToken: string };
      setTokens(pair);
      await reload();
      router.replace("/overview");
    } catch {
      setError("The Rana54 backend could not be reached.");
      setBusy(false);
    }
  }

  return (
    <div className="boot-screen">
      <form className="login-card" onSubmit={submit} noValidate>
        <span className="brand-word">
          RANA<b>54</b>
        </span>
        <h1>Sign in to Network Operations</h1>
        <p>Use your Rana54 platform administrator account.</p>
        {error ? (
          <p className="login-error" role="alert">
            <Icon name="alert" /> {error}
          </p>
        ) : null}
        <div className="field full">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </div>
        <div className="field full">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
