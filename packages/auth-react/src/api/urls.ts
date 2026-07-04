/**
 * URL builders for the **browser-redirect** auth endpoints (auth-sa.md §7/§8/
 * §15/§18). These must never be called with `fetch` — they are full-page
 * navigations. Callers do `window.location.assign(authUrls(...).xyz)`.
 *
 * Plus the two open-redirect defence helpers of auth-sa.md §19.2. Every new
 * `?somewhere=` parameter that ends up in `location.href`/`navigate()` must
 * pass through one of these rather than trust raw input.
 */

function trimBase(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export interface AuthUrls {
  /** Server-side OAuth redirect (auth-sa.md §7 option A). */
  oauthAuthorize(provider: string, redirectUri: string): string;
  /** Enterprise SSO login redirect (auth-sa.md §18.1 step 2). */
  ssoLogin(orgSlug: string): string;
  /** The URL embedded in a QR image — opened by the scanner's browser only. */
  qrScan(key: string): string;
  /** SP metadata URL surfaced to a customer's IT admin (auth-sa.md §18.4). */
  ssoSamlMetadata(orgSlug: string): string;
}

/** Build the browser-redirect URLs against a client base URL (e.g. `/auth/api`). */
export function authUrls(baseUrl: string): AuthUrls {
  const base = trimBase(baseUrl);
  return {
    oauthAuthorize: (provider, redirectUri) =>
      `${base}/oauth/${provider}/authorize/?redirect_uri=${encodeURIComponent(
        redirectUri
      )}`,
    ssoLogin: (orgSlug) => `${base}/sso/${orgSlug}/login/`,
    qrScan: (key) => `${base}/qr/${key}/scan/`,
    ssoSamlMetadata: (orgSlug) => `${base}/sso/${orgSlug}/saml/metadata/`,
  };
}

/**
 * `redirect_url` for magic-link / QR generation must be a **relative** path
 * starting with a single `/` (auth-sa.md §8/§15 — open-redirect defence).
 * Returns the path unchanged when valid, else `null`.
 */
export function validRedirectUrl(raw: string): string | null {
  if (raw.length === 0) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

/**
 * auth-sa.md §19.2 `safeNextPath`: accept a relative path (single leading `/`,
 * not `//`) or a same-origin absolute URL reduced to `pathname+search+hash`.
 * Anything cross-origin / unrecognised returns `null`; callers fall back to a
 * safe default (e.g. `/app`).
 */
export function safeNextPath(
  raw: string | null | undefined,
  origin?: string
): string | null {
  if (raw == null || raw.length === 0) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  const selfOrigin =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : undefined);
  if (selfOrigin === undefined) return null;
  try {
    const url = new URL(raw, selfOrigin);
    if (url.origin !== selfOrigin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * auth-sa.md §19.2 `safeScanRedirect`: accept only same-origin URLs whose path
 * starts with `/auth/api/qr/` (the QR scan-flow continuation). Used for
 * `?redirect=` on `/sign-in`.
 */
export function safeScanRedirect(
  raw: string | null | undefined,
  origin?: string
): string | null {
  if (raw == null || raw.length === 0) return null;
  const selfOrigin =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : undefined);
  if (selfOrigin === undefined) return null;
  try {
    const url = new URL(raw, selfOrigin);
    if (url.origin !== selfOrigin) return null;
    if (!url.pathname.startsWith("/auth/api/qr/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
