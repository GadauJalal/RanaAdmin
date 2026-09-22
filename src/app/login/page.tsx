"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Icon } from "@/components/ui/Icon";
import { IS_PROTOTYPE_DATA } from "@/lib/api";
import { hasSession, setTokens } from "@/lib/api/session";
import { BRAND_MARK_SVG } from "@/lib/brand";
import { useWorkspace } from "@/providers/workspace-provider";

import "./login.css";

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

/** Decorative energy flow behind the aside copy. CSS drives the motion. */
function AsideFlow() {
  return (
    <svg className="login-flow" viewBox="0 0 640 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path className="flow-track" d="M-40 640C120 590 230 720 380 630S620 520 700 560" />
      <path className="flow-current" d="M-40 640C120 590 230 720 380 630S620 520 700 560" />
      <path className="flow-track" d="M-40 740C160 690 300 840 500 730S660 660 700 690" />
      <path className="flow-current ember" d="M-40 740C160 690 300 840 500 730S660 660 700 690" />
      <path className="flow-track" d="M120-20C170 180 40 320 170 470S250 780 190 940" />
      <path className="flow-current slow" d="M120-20C170 180 40 320 170 470S250 780 190 940" />
      <path className="flow-track" d="M700 110C540 150 500 300 560 420S700 580 620 940" />
      <path className="flow-current slow" d="M700 110C540 150 500 300 560 420S700 580 620 940" />
      <circle className="flow-halo" cx="170" cy="470" r="9" />
      <circle className="flow-node" cx="170" cy="470" r="2.6" />
      <circle className="flow-halo ember" cx="500" cy="730" r="9" />
      <circle className="flow-node ember" cx="500" cy="730" r="2.6" />
      <circle className="flow-halo late" cx="560" cy="420" r="9" />
      <circle className="flow-node" cx="560" cy="420" r="2.6" />
      <circle className="flow-halo late" cx="380" cy="630" r="9" />
      <circle className="flow-node" cx="380" cy="630" r="2.6" />
    </svg>
  );
}

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
    <main className="login-screen">
      <section className="login-aside">
        <div className="auth-aside-visual" aria-hidden="true" />
        <AsideFlow />

        <div className="login-brand">
          <span
            className="login-brand-symbol"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: BRAND_MARK_SVG }}
          />
          <span className="brand-word">
            RANA<b>54</b>
          </span>
          <span className="brand-tag">Network operations</span>
        </div>

        <div className="login-aside-copy">
          <span className="eyebrow">Rana54 platform staff</span>
          <h1>One operational picture across every Rana54 account.</h1>
          <p>
            Enterprises, sites, field work and devices in a single workspace, with every
            elevated action recorded against the person who took it.
          </p>
        </div>

        <ul className="login-points">
          <li>
            <Icon name="enterprise" />
            <span>Enterprise onboarding and site approval</span>
          </li>
          <li>
            <Icon name="field" />
            <span>Field delivery, gateway identity and acceptance</span>
          </li>
          <li>
            <Icon name="shield" />
            <span>Every change carries a reason and an audit trail</span>
          </li>
        </ul>

        <p className="login-foot-note">
          Privileged workspace. Elevated actions require a reason, support access is read
          only, time limited and audited.
        </p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <header className="login-head">
            <span className="eyebrow">Control center</span>
            <h2>Sign in</h2>
            <p>Use your Rana54 platform administrator account.</p>
          </header>

          <form className="login-form" onSubmit={submit} noValidate>
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
            <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
