import { describe, expect, it } from "vitest";
import {
  StapelApiError,
  TRANSPORT_ERROR_CODE,
  errorCode,
  errorCodePredicate,
  errorStatus,
  hasErrorCode,
  isErrorEnvelope,
  isStapelApiError,
  parseErrorEnvelope,
  toStapelApiError,
} from "../src/errors.js";

/**
 * The RAW envelope, exactly as a second transport rethrows it: the parsed
 * response BODY. Written as a literal here only because it IS the wire format
 * (see recordings_ext/errors.py) — never as a hand-shaped `{status: 404}`,
 * which is the assumption this whole section exists to break.
 */
const RAW_404 = {
  localizable_error: "error.404.meeting_intelligence_not_found",
  error: "No intelligence has been extracted for this recording",
  params: {},
};

describe("parseErrorEnvelope", () => {
  it("parses the full Stapel envelope", () => {
    const error = parseErrorEnvelope(400, {
      localizable_error: "auth.otp.invalid",
      error: "Invalid one-time code",
      params: { attempts_left: 2 },
    });
    expect(error).toBeInstanceOf(StapelApiError);
    expect(error.code).toBe("auth.otp.invalid");
    expect(error.message).toBe("Invalid one-time code");
    expect(error.params).toEqual({ attempts_left: 2 });
    expect(error.status).toBe(400);
  });

  it("falls back to stapel.http.<status> when localizable_error is absent", () => {
    const error = parseErrorEnvelope(500, { error: "boom" });
    expect(error.code).toBe("stapel.http.500");
    expect(error.message).toBe("boom");
    expect(error.params).toEqual({});
  });

  it("uses the code as message when error text is absent", () => {
    const error = parseErrorEnvelope(422, {
      localizable_error: "billing.plan.unknown",
    });
    expect(error.message).toBe("billing.plan.unknown");
  });

  it("tolerates non-envelope bodies", () => {
    const text = parseErrorEnvelope(502, "Bad Gateway");
    expect(text.code).toBe("stapel.http.502");
    expect(text.status).toBe(502);
    expect(text.body).toBe("Bad Gateway");

    const empty = parseErrorEnvelope(404, undefined);
    expect(empty.code).toBe("stapel.http.404");
  });

  it("keeps the raw body for diagnostics", () => {
    const body = { localizable_error: "x.y", extra: { nested: true } };
    expect(parseErrorEnvelope(400, body).body).toBe(body);
  });

  it("carries the envelope's language tag when present", () => {
    const error = parseErrorEnvelope(400, {
      localizable_error: "auth.otp.invalid",
      error: "Code invalide",
      language: "fr",
    });
    expect(error.language).toBe("fr");
  });

  it("language is undefined when the backend doesn't send one (rollout in progress)", () => {
    const error = parseErrorEnvelope(400, { error: "boom" });
    expect(error.language).toBeUndefined();
  });
});

describe("one dialect — guards and folding", () => {
  it("isStapelApiError narrows only core's typed error", () => {
    expect(isStapelApiError(parseErrorEnvelope(404, RAW_404))).toBe(true);
    // The exact shape that made `(e as {status?: number}).status === 404`
    // dead code in production.
    expect(isStapelApiError(RAW_404)).toBe(false);
    expect(isStapelApiError(new Error("boom"))).toBe(false);
    expect(isStapelApiError(null)).toBe(false);
  });

  it("isErrorEnvelope recognises the raw dialect, and only it", () => {
    expect(isErrorEnvelope(RAW_404)).toBe(true);
    expect(isErrorEnvelope({ error: "just a message" })).toBe(false);
    expect(isErrorEnvelope([RAW_404])).toBe(false);
    expect(isErrorEnvelope("error.404.x")).toBe(false);
  });

  it("errorCode reads the same key from both dialects", () => {
    expect(errorCode(RAW_404)).toBe("error.404.meeting_intelligence_not_found");
    expect(errorCode(parseErrorEnvelope(404, RAW_404))).toBe(
      "error.404.meeting_intelligence_not_found"
    );
    expect(errorCode(new Error("network"))).toBeUndefined();
  });

  it("errorStatus recovers a status the raw envelope never carries as a field", () => {
    expect(RAW_404).not.toHaveProperty("status");
    expect(errorStatus(RAW_404)).toBe(404);
    expect(errorStatus(parseErrorEnvelope(404, RAW_404))).toBe(404);
    expect(errorStatus({ localizable_error: "stapel.http.503" })).toBe(503);
    // A transport that DOES attach a status is trusted over the code.
    expect(errorStatus({ status: 409, localizable_error: "error.404.x" })).toBe(409);
  });

  it("errorStatus says `undefined` when the value truly carries no status", () => {
    // A module-scoped code has no status segment — "no information", which a
    // caller must never read as "not a 4xx".
    expect(errorStatus({ localizable_error: "auth.otp.invalid" })).toBeUndefined();
    expect(errorStatus(new Error("Failed to fetch"))).toBeUndefined();
    expect(errorStatus(undefined)).toBeUndefined();
  });

  it("hasErrorCode / errorCodePredicate discriminate two DIFFERENT 404s", () => {
    const featureOff = { localizable_error: "error.404.feature_disabled", error: "off" };
    const isAbsent = errorCodePredicate(
      "error.404.meeting_intelligence_not_found"
    );
    const isFeatureDisabled = errorCodePredicate("error.404.feature_disabled");

    expect(isAbsent(RAW_404)).toBe(true);
    expect(isAbsent(featureOff)).toBe(false);
    expect(isFeatureDisabled(featureOff)).toBe(true);
    // …and the same predicates hold once the transport starts wrapping.
    expect(isAbsent(parseErrorEnvelope(404, RAW_404))).toBe(true);
    expect(hasErrorCode(RAW_404, "error.404.feature_disabled")).toBe(false);
    expect(
      hasErrorCode(RAW_404, "error.404.feature_disabled", RAW_404.localizable_error)
    ).toBe(true);
  });

  it("toStapelApiError folds the raw envelope into the typed dialect", () => {
    const wrapped = toStapelApiError(RAW_404, 404);
    expect(wrapped).toBeInstanceOf(StapelApiError);
    expect(wrapped.code).toBe("error.404.meeting_intelligence_not_found");
    expect(wrapped.status).toBe(404);
    expect(wrapped.body).toBe(RAW_404);
  });

  it("toStapelApiError is identity on an already-typed error", () => {
    const original = parseErrorEnvelope(404, RAW_404);
    expect(toStapelApiError(original, 500)).toBe(original);
  });

  it("toStapelApiError keeps a transport fault honest (no invented status)", () => {
    const failed = toStapelApiError(new TypeError("Failed to fetch"));
    expect(failed.code).toBe(TRANSPORT_ERROR_CODE);
    expect(failed.status).toBe(0);
    expect(failed.message).toBe("Failed to fetch");
  });

  it("toStapelApiError uses the response status when the body has none", () => {
    const wrapped = toStapelApiError({ error: "Bad request" }, 400);
    expect(wrapped.status).toBe(400);
    expect(wrapped.code).toBe("stapel.http.400");
    expect(wrapped.message).toBe("Bad request");
  });
});
