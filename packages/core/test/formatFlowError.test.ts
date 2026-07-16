/**
 * `formatFlowError` closes the gap flagged by the owner: `toFlowError`
 * documents "the frontend renders `t(code, params)`", but nothing actually
 * supplied that `t` — hosts wrote `bundle[code] ?? code` and a missing key
 * surfaced as a raw, unformatted code to the user. Covers the three-step
 * fallback chain: bundle template (interpolated) → backend message
 * (locale-gated) → raw code.
 */
import { describe, expect, it } from "vitest";
import { formatFlowError } from "../src/flows/flowError.js";
import type { FlowError } from "../src/flows/flowError.js";
import { toFlowError } from "../src/flows/flowError.js";
import { parseErrorEnvelope } from "../src/errors.js";

function err(overrides: Partial<FlowError> = {}): FlowError {
  return {
    code: "auth.otp.invalid",
    params: {},
    status: 400,
    message: undefined,
    language: undefined,
    ...overrides,
  };
}

describe("formatFlowError", () => {
  it("uses the bundle template and interpolates {param}s", () => {
    const bundle = { "auth.otp.invalid": "Code wrong, {attempts_left} left" };
    const text = formatFlowError(
      err({ params: { attempts_left: 2 } }),
      bundle
    );
    expect(text).toBe("Code wrong, 2 left");
  });

  it("falls back to the backend message when its language matches the host locale", () => {
    const text = formatFlowError(
      err({ message: "Code invalide", language: "fr" }),
      {}, // no bundle entry for this code
      { locale: "fr" }
    );
    expect(text).toBe("Code invalide");
  });

  it("does NOT use the backend message when the language doesn't match the host locale", () => {
    const text = formatFlowError(
      err({ message: "Code invalide", language: "fr" }),
      {},
      { locale: "en" }
    );
    expect(text).toBe("auth.otp.invalid");
  });

  it("does NOT use the backend message when no language was sent at all", () => {
    const text = formatFlowError(
      err({ message: "Some message" }),
      {},
      { locale: "en" }
    );
    expect(text).toBe("auth.otp.invalid");
  });

  it("does NOT use the backend message when the host passed no locale", () => {
    const text = formatFlowError(err({ message: "Code invalide", language: "fr" }), {});
    expect(text).toBe("auth.otp.invalid");
  });

  it("falls back to the raw code as the last resort", () => {
    expect(formatFlowError(err(), {})).toBe("auth.otp.invalid");
  });

  it("a bundle entry always wins over the backend message, even when locale matches", () => {
    const text = formatFlowError(
      err({ message: "Backend text", language: "en" }),
      { "auth.otp.invalid": "Bundle text" },
      { locale: "en" }
    );
    expect(text).toBe("Bundle text");
  });

  it("end-to-end with toFlowError: a real StapelApiError round-trips language + message", () => {
    const apiError = parseErrorEnvelope(400, {
      localizable_error: "auth.otp.invalid",
      error: "Code invalide",
      language: "fr",
    });
    const flowError = toFlowError(apiError);
    expect(formatFlowError(flowError, {}, { locale: "fr" })).toBe("Code invalide");
    expect(formatFlowError(flowError, {}, { locale: "en" })).toBe("auth.otp.invalid");
  });

  it("a non-StapelApiError fault carries no message/language and formats to the fallback code", () => {
    const flowError = toFlowError(new Error("boom"), "stapel.error.unknown");
    expect(flowError.message).toBeUndefined();
    expect(flowError.language).toBeUndefined();
    expect(formatFlowError(flowError, {}, { locale: "en" })).toBe("stapel.error.unknown");
  });
});
