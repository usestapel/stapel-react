import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createI18n } from "../src/i18n.js";
import { I18nProvider } from "../src/i18n.js";
import { useFormatFlowError } from "../src/flows/useFormatFlowError.js";
import type { FlowError } from "../src/flows/flowError.js";

function wrapperFor(locale: string, bundles: Record<string, Record<string, string>>) {
  const i18n = createI18n({ locale, bundles });
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return <I18nProvider i18n={i18n}>{props.children}</I18nProvider>;
  };
}

describe("useFormatFlowError", () => {
  it("resolves a bundle template for the current locale", () => {
    const { result } = renderHook(() => useFormatFlowError(), {
      wrapper: wrapperFor("en", { en: { "auth.otp.invalid": "Wrong code" } }),
    });
    const error: FlowError = {
      code: "auth.otp.invalid",
      params: {},
      status: 400,
      message: undefined,
      language: undefined,
    };
    expect(result.current(error)).toBe("Wrong code");
  });

  it("falls back to the backend message when the language matches the CURRENT locale", () => {
    const { result } = renderHook(() => useFormatFlowError(), {
      wrapper: wrapperFor("fr", {}),
    });
    const error: FlowError = {
      code: "auth.otp.invalid",
      params: {},
      status: 400,
      message: "Code invalide",
      language: "fr",
    };
    expect(result.current(error)).toBe("Code invalide");
  });

  it("falls back to the raw code when nothing matches", () => {
    const { result } = renderHook(() => useFormatFlowError(), {
      wrapper: wrapperFor("en", {}),
    });
    const error: FlowError = {
      code: "auth.otp.invalid",
      params: {},
      status: 400,
      message: "Code invalide",
      language: "fr",
    };
    expect(result.current(error)).toBe("auth.otp.invalid");
  });
});
