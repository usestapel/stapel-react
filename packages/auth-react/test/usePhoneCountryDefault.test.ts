/**
 * `usePhoneCountryDefault` (owner directive point 6): an IP→country phone
 * prefix helper that must be OFF by default (privacy + an external
 * dependency) and a one-line opt-in. Covers: disabled/no-endpoint no-ops,
 * a resolved lookup mapping to a dial code, a host's dial-code override, and
 * a failed lookup surfacing as `error` rather than throwing.
 */
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePhoneCountryDefault } from "../src/model/usePhoneCountryDefault.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("usePhoneCountryDefault", () => {
  it("defaults to disabled — no fetch, no state change", () => {
    const fetchImpl = vi.fn();
    const { result } = renderHook(() =>
      usePhoneCountryDefault({ fetchImpl: fetchImpl as unknown as typeof fetch })
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      countryCode: null,
      dialCode: null,
      isLoading: false,
      error: null,
    });
  });

  it("enabled without an endpoint still no-ops (endpoint is required to actually fetch)", () => {
    const fetchImpl = vi.fn();
    renderHook(() =>
      usePhoneCountryDefault({ enabled: true, fetchImpl: fetchImpl as unknown as typeof fetch })
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolves a country and maps it to its built-in dial code", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ country: "de" }));
    const { result } = renderHook(() =>
      usePhoneCountryDefault({
        enabled: true,
        endpoint: "/geo/country",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    );
    await waitFor(() => expect(result.current.countryCode).toBe("DE"));
    expect(result.current.dialCode).toBe("+49");
    expect(result.current.isLoading).toBe(false);
    expect(fetchImpl).toHaveBeenCalledWith("/geo/country");
  });

  it("a host's dialCodes table overrides the built-in default", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ country: "US" }));
    const { result } = renderHook(() =>
      usePhoneCountryDefault({
        enabled: true,
        endpoint: "/geo/country",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        dialCodes: { US: "+1-custom" },
      })
    );
    await waitFor(() => expect(result.current.dialCode).toBe("+1-custom"));
  });

  it("surfaces a failed lookup as `error`, never throws", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const { result } = renderHook(() =>
      usePhoneCountryDefault({
        enabled: true,
        endpoint: "/geo/country",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.countryCode).toBeNull();
  });

  it("an unrecognised country code resolves with a null dialCode", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ country: "XX" }));
    const { result } = renderHook(() =>
      usePhoneCountryDefault({
        enabled: true,
        endpoint: "/geo/country",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    );
    await waitFor(() => expect(result.current.countryCode).toBe("XX"));
    expect(result.current.dialCode).toBeNull();
  });
});
