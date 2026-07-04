import { parseErrorEnvelope } from "./errors.js";
import {
  extractVerificationChallenge,
  VERIFICATION_TOKEN_HEADER,
  type VerificationChallengeHandler,
} from "./verification.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface StapelRequestOptions {
  readonly method?: HttpMethod;
  /** JSON-serialized unless it is a `BodyInit` (FormData, Blob, string…). */
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  /** Appended to the URL; `undefined` values are skipped. */
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly signal?: AbortSignal;
}

export interface StapelClient {
  readonly baseUrl: string;
  request<T>(path: string, options?: StapelRequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<StapelRequestOptions, "method" | "body">): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<StapelRequestOptions, "method" | "body">): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<StapelRequestOptions, "method" | "body">): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<StapelRequestOptions, "method" | "body">): Promise<T>;
  delete<T>(path: string, options?: Omit<StapelRequestOptions, "method" | "body">): Promise<T>;
}

export interface StapelClientOptions {
  /** e.g. `https://api.example.com` or `/api`. */
  readonly baseUrl: string;
  /** Auth seam: current access token (attached as `Authorization: Bearer`). */
  readonly getToken?: () =>
    | string
    | null
    | undefined
    | Promise<string | null | undefined>;
  /**
   * Refresh seam: called once per request on a 401. Return the new access
   * token to retry the request with it; return null/undefined to give up
   * (the 401 is then thrown as `StapelApiError`).
   */
  readonly onAuthRefresh?: () => Promise<string | null | undefined>;
  /**
   * Step-up verification seam: called when a 403 body carries a
   * `verification` challenge. On `{retry: true}` the original request is
   * retried exactly once, with `X-Verification-Token` when a token is given.
   */
  readonly onVerificationChallenge?: VerificationChallengeHandler;
  /** Merged into every request (overridable per request). */
  readonly defaultHeaders?: Record<string, string>;
  /** Injectable fetch (tests, SSR, instrumentation). Default: global fetch. */
  readonly fetch?: typeof globalThis.fetch;
}

function isBodyInit(body: unknown): body is BodyInit {
  return (
    typeof body === "string" ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) ||
    (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) ||
    (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
  );
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: StapelRequestOptions["query"]
): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  let url = `${base}${suffix}`;
  if (query) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const qs = search.toString();
    if (qs.length > 0) url += `?${qs}`;
  }
  return url;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (text.length === 0) return undefined;
  if (contentType.includes("json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Typed fetch wrapper around the Stapel API conventions: JSON in/out, bearer
 * auth with a refresh seam, the `{localizable_error, error, params}` error
 * envelope, and verification-403 interception (see `StapelClientOptions`).
 */
export function createStapelClient(options: StapelClientOptions): StapelClient {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<T>(
    path: string,
    requestOptions: StapelRequestOptions = {}
  ): Promise<T> {
    const method = requestOptions.method ?? "GET";
    const url = buildUrl(options.baseUrl, path, requestOptions.query);

    let overrideToken: string | undefined;
    let verificationToken: string | undefined;
    let triedRefresh = false;
    let triedVerification = false;

    for (;;) {
      const headers = new Headers(options.defaultHeaders);
      if (requestOptions.headers) {
        for (const [key, value] of Object.entries(requestOptions.headers)) {
          headers.set(key, value);
        }
      }
      const token = overrideToken ?? (await options.getToken?.());
      if (token != null && token.length > 0 && !headers.has("authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      if (verificationToken !== undefined) {
        headers.set(VERIFICATION_TOKEN_HEADER, verificationToken);
      }

      let body: BodyInit | undefined;
      if (requestOptions.body !== undefined) {
        if (isBodyInit(requestOptions.body)) {
          body = requestOptions.body;
        } else {
          body = JSON.stringify(requestOptions.body);
          if (!headers.has("content-type")) {
            headers.set("Content-Type", "application/json");
          }
        }
      }

      const requestInit: RequestInit = { method, headers };
      if (body !== undefined) requestInit.body = body;
      if (requestOptions.signal) requestInit.signal = requestOptions.signal;
      const response = await fetchImpl(url, requestInit);

      if (response.ok) {
        return (await parseBody(response)) as T;
      }

      const errorBody = await parseBody(response);

      if (response.status === 401 && options.onAuthRefresh && !triedRefresh) {
        triedRefresh = true;
        const refreshed = await options.onAuthRefresh();
        if (refreshed != null && refreshed.length > 0) {
          overrideToken = refreshed;
          continue;
        }
      }

      if (
        response.status === 403 &&
        options.onVerificationChallenge &&
        !triedVerification
      ) {
        const challenge = extractVerificationChallenge(errorBody);
        if (challenge) {
          triedVerification = true;
          const outcome = await options.onVerificationChallenge(challenge);
          if (outcome.retry) {
            if (outcome.token !== undefined) {
              verificationToken = outcome.token;
            }
            continue;
          }
        }
      }

      throw parseErrorEnvelope(response.status, errorBody);
    }
  }

  return {
    baseUrl: options.baseUrl,
    request,
    get: (path, opts) => request(path, { ...opts, method: "GET" }),
    post: (path, body, opts) =>
      request(path, { ...opts, method: "POST", body }),
    put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
    patch: (path, body, opts) =>
      request(path, { ...opts, method: "PATCH", body }),
    delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
  };
}
