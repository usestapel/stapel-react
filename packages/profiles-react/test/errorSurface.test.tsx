/**
 * The two defects an owner hit on a live sandbox behind a backend 500
 * (2026-08-09), regressed here at the level they actually failed: what the
 * BROWSER computes, and what a HUMAN reads.
 *
 * 1. THEME. `ProfileSettings` used to default `mode` to `"light"`, so on a
 *    dark deployment its own `<ConfigProvider>` handed antd a LIGHT algorithm
 *    while `@stapel/tokens-antd` read `colorText` LIVE off the host's DARK
 *    `tokens.css`. antd v6 emits its resolved theme as real CSS custom
 *    properties, so the mix is measurable, and it measured:
 *    `--ant-color-error-bg: #fff2f0` (near-white) under
 *    `--ant-color-text: #f4f5f7` (near-white) — a contrast ratio of 1.03:1,
 *    the "unreadable unless you select it with the cursor" the report
 *    described. The assertion below is the WCAG ratio between the two
 *    properties the Alert's own rules reference, in BOTH themes — not a
 *    snapshot of a hex, which would go green again the moment the mix
 *    returned in a different pair of colours.
 *
 * 2. DIALECT. The Alert rendered `mutation.error.message`, which for a
 *    response carrying no error envelope (a Django 500 under `DEBUG=False`
 *    returns HTML) is `parseErrorEnvelope`'s internal
 *    `"Request failed with status 500"` — the HTTP client's own diagnostic,
 *    in English, on a Russian UI. The wire is mocked with exactly that: a
 *    bodiless 500, no `localizable_error` to map.
 *
 * 3. REGISTER. The copy that replaced it ended in a bare `" (500)"`, and the
 *    owner rejected the parenthesis on sight: a product writes a human
 *    sentence, it does not read a protocol number out to a person. The status is still the only
 *    correlation handle the fleet has, so it did not get deleted — it moved
 *    out of the sentence and into the Alert's DESCRIPTION, muted and small.
 *    Both halves are asserted below at the level a person meets them: the
 *    message must carry no digits at all, and the technical detail must still
 *    be on screen.
 */
// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import {
  I18nProvider,
  StapelConfigProvider,
  createI18n,
  createStapelClient,
} from "@stapel/core";
import { colors } from "@stapel/tokens";
import { createProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import { registerProfilesI18nRu } from "../src/i18n/ru.js";
import { ProfileSettings } from "../src/default/index.js";

const BASE = "https://profiles.stapel.test/profiles/api/v1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  document.documentElement.removeAttribute("data-theme");
  for (const style of Array.from(document.head.querySelectorAll("style"))) {
    style.remove();
  }
});
afterAll(() => server.close());

const MY_PROFILE = {
  user_id: "b3f1c0de-0000-4000-8000-000000000001",
  avatar_source: "file",
  avatar: "avatar/ada",
  display_name: "Ada Lovelace",
  theme: "system",
  app_language: { code: "ru", name: "Russian", flag: "/flags/ru.svg" },
  initial_setup_passed: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

/**
 * jsdom's CSS engine resolves neither custom properties nor a `[data-theme]`
 * rule through `getComputedStyle` (a long-standing jsdom limitation, not a
 * real-browser one — `tokens-antd`'s own live-CSS suite documents the same
 * gap), so the host's generated `tokens.css` is stood in for by stubbing the
 * ONE call the bridge makes. Values are `@stapel/tokens`' own compiled
 * defaults for the mode, standing in for a host that regenerated them.
 */
function installHostTokens(mode: "light" | "dark"): void {
  document.documentElement.setAttribute("data-theme", mode);
  const real = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
    if (element !== document.documentElement) return real(element, pseudo);
    return {
      getPropertyValue: (property: string): string => {
        const roleName = property.replace(/^--stapel-/, "");
        const pair = (colors as Record<string, { light: string; dark: string }>)[roleName];
        return pair ? pair[mode] : "";
      },
    } as unknown as CSSStyleDeclaration;
  }) as typeof window.getComputedStyle;
}

/** Every `--ant-<name>: <value>` antd emitted into the document, last wins. */
function antdCssVars(): Record<string, string> {
  const css = Array.from(document.head.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n");
  const found: Record<string, string> = {};
  for (const match of css.matchAll(/(--ant-[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/g)) {
    found[match[1] ?? ""] = (match[2] ?? "").trim();
  }
  return found;
}

/** sRGB relative luminance (WCAG 2.1). Hex only — antd emits hex for these. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const channels = [0, 2, 4].map((offset) => {
    const srgb = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0)
  );
}

/**
 * The half of the alert a PERSON reads — antd's `message` slot, i.e. the alert
 * minus the muted technical detail. Asserting on `alert.textContent` would
 * conflate the two and let `"…(500)"` back into the copy unnoticed.
 */
function sentenceOf(alert: HTMLElement): string {
  // antd v6 names the slot `-title` once a description is present, v5 `-message`.
  const message = alert.querySelector(".ant-alert-title, .ant-alert-message");
  expect(message, "antd rendered no message slot").not.toBeNull();
  return message?.textContent ?? "";
}

function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function wrap(children: ReactNode, locale: string): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale });
  registerProfilesI18n(i18n);
  registerProfilesI18nRu(i18n);
  const runtime = createProfilesRuntime({ baseUrl: BASE });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <StapelConfigProvider
          config={{ client: createStapelClient({ baseUrl: "https://unused.stapel.test" }) }}
        >
          <ProfilesProvider runtime={runtime}>{children}</ProfilesProvider>
        </StapelConfigProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/**
 * The sandbox failure on the wire: `GET /me` succeeds, the field manifest is
 * empty, and the PATCH the theme picker fires comes back 500 with an HTML
 * body — no envelope, no `localizable_error`, nothing to map.
 */
function serveBodiless500(): void {
  const html = (): HttpResponse =>
    HttpResponse.text("<!doctype html><html><body><h1>Server Error (500)</h1></body></html>", {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  server.use(
    http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
    http.get(`${BASE}/me/`, () => HttpResponse.json(MY_PROFILE)),
    http.get(`${BASE}/field-manifest`, () => HttpResponse.json([])),
    http.get(`${BASE}/field-manifest/`, () => HttpResponse.json([])),
    http.patch(`${BASE}/me`, html),
    http.patch(`${BASE}/me/`, html)
  );
}

async function renderAlertOnFailedSave(mode: "light" | "dark", locale: string): Promise<void> {
  installHostTokens(mode);
  serveBodiless500();
  render(wrap(<ProfileSettings showLanguage={false} showNotifications={false} />, locale));
  await screen.findByTestId("profile-settings");
  // The hard-core theme row's Segmented commits reactively — one click is the
  // whole "save", exactly as the owner's screen behaved.
  fireEvent.click(await screen.findByText(locale === "ru" ? "Тёмная" : "Dark"));
  await screen.findByRole("alert");
}

describe("ProfileSettings error surface — the alert a 500 puts on screen", () => {
  it.each(["dark", "light"] as const)(
    "renders readable on the %s theme with no `mode` prop from the host",
    async (mode) => {
      await renderAlertOnFailedSave(mode, "en");

      const vars = antdCssVars();
      // The two properties the Alert's own generated rules reference:
      // `.ant-alert-error{background:var(--ant-color-error-bg)}` and
      // `.ant-alert{color:var(--ant-color-text)}`.
      const background = vars["--ant-color-error-bg"];
      const text = vars["--ant-color-text"];
      expect(background, "antd emitted no --ant-color-error-bg").toBeDefined();
      expect(text, "antd emitted no --ant-color-text").toBeDefined();

      const ratio = contrastRatio(background ?? "", text ?? "");
      expect(
        ratio,
        `alert text ${String(text)} on ${String(background)} is ${ratio.toFixed(2)}:1 in ${mode} mode`
      ).toBeGreaterThanOrEqual(4.5);

      // …and the theme is not merely readable but the HOST's: the card the
      // alert sits in must be the same mode's surface, not the other one's.
      expect(vars["--ant-color-bg-container"]).toBe(colors["surface-raised"][mode]);
    }
  );

  it("never shows the transport's own message — a bodiless 500 gets localized copy", async () => {
    await renderAlertOnFailedSave("dark", "ru");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("Request failed with status");
    // Not the raw i18n key either — core's own floor covers the codes core
    // itself mints (`stapel.http.500`), so no host wiring is required.
    expect(alert.textContent).not.toContain("stapel.http");
    expect(sentenceOf(alert)).toContain("На нашей стороне произошла ошибка");
  });

  it("keeps English copy on an English UI", async () => {
    await renderAlertOnFailedSave("dark", "en");

    const alert = await screen.findByRole("alert");
    expect(sentenceOf(alert)).toContain("Something went wrong on our side");
    expect(alert.textContent).not.toContain("Request failed with status");
  });

  it.each(["ru", "en"] as const)(
    "reads the %s sentence to a person with no protocol number in it",
    async (locale) => {
      await renderAlertOnFailedSave("dark", locale);

      // The owner's rejection, at the level he met it: whatever the sentence
      // says, it contains no digits — not `(500)`, not a bare `500`, not a
      // leftover `{status}` placeholder.
      const sentence = sentenceOf(await screen.findByRole("alert"));
      expect(sentence, "the human sentence reads a protocol number to a user").not.toMatch(
        /\d|\{status\}/
      );
    }
  );

  it.each(["ru", "en"] as const)(
    "still puts the status on screen as a separate technical detail (%s)",
    async (locale) => {
      await renderAlertOnFailedSave("dark", locale);
      const alert = await screen.findByRole("alert");

      // Not deleted, just demoted: the ONLY correlation handle the fleet has
      // (no Stapel backend emits a request id) is still quotable to support,
      // in its own element rather than inside the copy.
      const detail = alert.querySelector(".ant-alert-description");
      expect(detail, "no secondary detail element rendered").not.toBeNull();
      expect(detail?.textContent).toContain("HTTP 500");
      // …and reachable by simply reading the alert, in either language.
      expect(alert.textContent).toContain("500");
    }
  );

  it.each(["dark", "light"] as const)(
    "renders the technical detail muted but still legible on the %s theme",
    async (mode) => {
      await renderAlertOnFailedSave(mode, "ru");
      const vars = antdCssVars();

      // Muted: secondary, not the message's own colour.
      const secondary = vars["--ant-color-text-secondary"];
      const primary = vars["--ant-color-text"];
      expect(secondary).toBeDefined();
      expect(secondary).not.toBe(primary);

      // Still legible: WCAG AA for small text against the alert's own
      // background — "muted" must not become defect #1 in a second colour.
      const ratio = contrastRatio(vars["--ant-color-error-bg"] ?? "", secondary ?? "");
      expect(
        ratio,
        `detail ${String(secondary)} on ${String(vars["--ant-color-error-bg"])} is ${ratio.toFixed(2)}:1 in ${mode} mode`
      ).toBeGreaterThanOrEqual(4.5);
    }
  );
});
