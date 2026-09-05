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

/**
 * Where an OAuth round trip comes back to, and WHAT ELSE it carries.
 *
 * The authorize door is a full-page navigation, so the query string is the
 * only channel a browser has for saying anything on the way out — and the one
 * thing a storefront needs to say there is where this sign-up CAME FROM. An
 * advertising click identifier is captured on the landing page, minutes and
 * several navigations before the person presses "continue with Google", and
 * it has to survive the provider round trip to be attached to the account the
 * round trip creates (stapel-auth ≥0.34 reads these back off the state it
 * round-trips and stores them against a registration).
 *
 * Until this existed the builder took a bare `redirect_uri` and nothing else,
 * so a host with attribution to pass had two options, both bad: hand-build the
 * URL (and lose the encoding this module owns) or smuggle the tags INSIDE the
 * `redirect_uri`, where they came back as query parameters of the host's own
 * landing route and had to be scrubbed off before the address was shown.
 *
 * `params` is written verbatim, each value encoded — the keys are the
 * backend's (`click_id`, `click_id_type`, `captured_at`, `utm_source` …), not
 * this module's, because which tags a deployment collects is a deployment
 * fact and a fixed list here would be one more thing to release.
 */
export interface OauthAuthorizeTarget {
  /** Where the provider redirects back to. */
  readonly redirect_uri: string;
  /**
   * Extra query parameters for the authorize door. `redirect_uri` is written
   * from the field above and cannot be overridden here — one address, one
   * owner. An empty value is still written: "" is a value the server can read,
   * and dropping it would be this module editing the host's statement.
   */
  readonly params?: Readonly<Record<string, string>>;
}

export interface AuthUrls {
  /**
   * Server-side OAuth redirect (auth-sa.md §7 option A).
   *
   * A bare string is the redirect URI, exactly as before. An
   * {@link OauthAuthorizeTarget} is the same address plus whatever else the
   * host needs the door to carry — see that type.
   */
  oauthAuthorize(
    provider: string,
    target: string | OauthAuthorizeTarget
  ): string;
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
    oauthAuthorize: (provider, target) => {
      const redirectUri =
        typeof target === "string" ? target : target.redirect_uri;
      // `redirect_uri` stays FIRST and stays this module's: the extra tags are
      // appended after it and cannot displace it, whatever the host puts in
      // `params`.
      const query = new URLSearchParams({ redirect_uri: redirectUri });
      if (typeof target !== "string" && target.params !== undefined) {
        for (const [key, value] of Object.entries(target.params)) {
          if (key === "redirect_uri") continue;
          query.append(key, value);
        }
      }
      // `URLSearchParams` writes a space as `+`; the door is read by a server
      // that parses a query string, where `+` IS a space, so the two agree.
      return `${base}/oauth/${provider}/authorize/?${query.toString()}`;
    },
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
 * starts with `/auth/api/v1/qr/` (the QR scan-flow continuation). Used for
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
    if (!url.pathname.startsWith("/auth/api/v1/qr/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
