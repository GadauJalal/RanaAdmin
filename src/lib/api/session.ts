/**
 * Browser-side auth session.
 *
 * Holds the access token, refresh token, and the caller's organisation id in
 * localStorage so a reload keeps the user signed in. Everything here is
 * browser-only and guarded for SSR; on the server these read as "no session".
 *
 * Live auth is opt-in via `NEXT_PUBLIC_REQUIRE_AUTH`. When it is off (the demo
 * default) the app never shows a login screen and the mock API serves data
 * without a token.
 */

const ACCESS_KEY = "rana54.accessToken";
const REFRESH_KEY = "rana54.refreshToken";
const ORG_KEY = "rana54.orgId";

/** True when the app should require a real signed-in session. */
export const AUTH_REQUIRED = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "1";

function read(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: string | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // A private-mode or storage-disabled browser degrades to an in-memory
    // session for this tab; nothing to do here.
  }
}

export function getAccessToken(): string | undefined {
  return read(ACCESS_KEY);
}

export function getRefreshToken(): string | undefined {
  return read(REFRESH_KEY);
}

export function getOrgId(): string | undefined {
  return read(ORG_KEY);
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Store a fresh token pair (from login, activate, accept-invite or refresh). */
export function setTokens(tokens: TokenPair): void {
  write(ACCESS_KEY, tokens.accessToken);
  write(REFRESH_KEY, tokens.refreshToken);
}

/** Remember the caller's organisation id so org-scoped calls can send it. */
export function setOrgId(orgId: string | undefined): void {
  write(ORG_KEY, orgId);
}

/** True when an access token is present. */
export function hasSession(): boolean {
  return Boolean(getAccessToken());
}

/** Clear everything - used on logout and on an unrecoverable 401. */
export function clearSession(): void {
  write(ACCESS_KEY, undefined);
  write(REFRESH_KEY, undefined);
  write(ORG_KEY, undefined);
}

/**
 * Send the user to the login screen after their session ends. Kept here so the
 * http client can call it without importing Next's router into non-component
 * code. A full navigation (not a client push) guarantees all in-memory state is
 * dropped along with the cleared tokens.
 */
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  const from = encodeURIComponent(`${pathname}${search}`);
  const target = `/login?from=${from}`;
  if (window.location.pathname !== "/login") window.location.assign(target);
}
