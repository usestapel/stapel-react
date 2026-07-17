/**
 * `<QrDeviceLinkPanel/>` — session_share device-handoff, built entirely on
 * the existing `QrLogin` headless flow (`qrGenerate`/`qrStatus`/`qrReject`):
 * pure UI-shape coverage (trigger → immediate QR, TTL countdown, silent
 * auto-refresh on backend `expired`, fulfilled/rejected/error, cancel) over
 * a data layer already covered by `qrLoginFlow.test.ts`.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createAuthRuntime } from "../../src/model/runtime.js";
import type { AuthRuntime } from "../../src/model/runtime.js";
import { AuthProvider } from "../../src/headless/AuthProvider.js";
import { registerAuthI18n } from "../../src/i18n/keys.js";
import { QrDeviceLinkPanel } from "../../src/default/security/QrDeviceLinkPanel.js";
import { BASE } from "../helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

function wrap(runtime: AuthRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = createI18n({ locale: "en" });
  registerAuthI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <AuthProvider runtime={runtime}>{children}</AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("<QrDeviceLinkPanel/>", () => {
  it("renders idle with a trigger, and does not call /qr/generate/ before it's clicked", async () => {
    let generateCalls = 0;
    server.use(
      http.post(`${BASE}/qr/generate/`, () => {
        generateCalls += 1;
        return HttpResponse.json(
          { key: "k1", type: "session_share", expires_in: 300, scan_url: "https://x/qr/k1/scan/" },
          { status: 201 }
        );
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel />));

    expect(screen.getByText("Sign in on another device")).toBeDefined();
    expect(screen.getByText("Show QR code")).toBeDefined();
    expect(generateCalls).toBe(0);
  });

  /**
   * Owner UX audit 2026-07-17 (point 8): the trigger must open a DIALOG
   * (Modal on desktop, bottom Drawer/"sheet" on phone) — same
   * `useBreakpoint` convention `AuthPanel`'s own alt-method dialog follows —
   * never reveal the QR journey inline below the settings row.
   */
  function setViewportWidth(width: number): void {
    Object.defineProperty(window, "innerWidth", { value: width, writable: true });
    window.dispatchEvent(new Event("resize"));
  }

  it("opens a centred Modal (not an inline reveal) at desktop width", async () => {
    setViewportWidth(1440);
    server.use(
      http.post(`${BASE}/qr/generate/`, () =>
        HttpResponse.json(
          { key: "k1", type: "session_share", expires_in: 300, scan_url: "https://x/qr/k1/scan/" },
          { status: 201 }
        )
      ),
      http.get(`${BASE}/qr/k1/status/`, () => HttpResponse.json({ status: "pending" }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel />));

    expect(document.querySelector(".ant-modal")).toBeNull();
    screen.getByText("Show QR code").click();

    await waitFor(() => expect(document.querySelector(".ant-modal")).not.toBeNull());
    expect(document.querySelector(".ant-drawer")).toBeNull();
    await waitFor(() => expect(screen.getByText("Expires in 5:00")).toBeDefined());
  });

  it("opens a bottom Drawer ('sheet') at phone width — same content, different surface", async () => {
    setViewportWidth(375);
    server.use(
      http.post(`${BASE}/qr/generate/`, () =>
        HttpResponse.json(
          { key: "k1", type: "session_share", expires_in: 300, scan_url: "https://x/qr/k1/scan/" },
          { status: 201 }
        )
      ),
      http.get(`${BASE}/qr/k1/status/`, () => HttpResponse.json({ status: "pending" }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel />));

    screen.getByText("Show QR code").click();

    await waitFor(() => expect(document.querySelector(".ant-drawer")).not.toBeNull());
    expect(document.querySelector(".ant-drawer")?.className).toContain("ant-drawer-bottom");
    expect(document.querySelector(".ant-modal")).toBeNull();
    setViewportWidth(1440); // restore for subsequent tests in this file
  });

  it("clicking the trigger generates a QR immediately (no further click) and shows the countdown", async () => {
    server.use(
      http.post(`${BASE}/qr/generate/`, () =>
        HttpResponse.json(
          { key: "k1", type: "session_share", expires_in: 300, scan_url: "https://x/qr/k1/scan/" },
          { status: 201 }
        )
      ),
      http.get(`${BASE}/qr/k1/status/`, () => HttpResponse.json({ status: "pending" }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel />));

    screen.getByText("Show QR code").click();

    await waitFor(() => expect(screen.getByText("Expires in 5:00")).toBeDefined());
  });

  it("passes session_share + allow_unauthenticated_scanner: true + the given redirectUrl to /qr/generate/", async () => {
    let body: unknown = null;
    server.use(
      http.post(`${BASE}/qr/generate/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { key: "k1", type: "session_share", expires_in: 300, scan_url: "https://x/qr/k1/scan/" },
          { status: 201 }
        );
      }),
      http.get(`${BASE}/qr/k1/status/`, () => HttpResponse.json({ status: "pending" }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel redirectUrl="/call/room-42" />));

    screen.getByText("Show QR code").click();

    await waitFor(() =>
      expect(body).toMatchObject({
        type: "session_share",
        redirect_url: "/call/room-42",
        allow_unauthenticated_scanner: true,
      })
    );
  });

  it("shows the fulfilled state once the backend reports the scan completed", async () => {
    server.use(
      http.post(`${BASE}/qr/generate/`, () =>
        HttpResponse.json(
          { key: "k1", type: "session_share", expires_in: 300, scan_url: "https://x/qr/k1/scan/" },
          { status: 201 }
        )
      ),
      http.get(`${BASE}/qr/k1/status/`, () => HttpResponse.json({ status: "fulfilled" }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel />));

    screen.getByText("Show QR code").click();

    await waitFor(() => expect(screen.getByText("That device is now signed in.")).toBeDefined());
  });

  /**
   * Coordinator deepening (owner UX audit 2026-07-17): red on the pre-fix
   * code (verified — reverting the `hadKeyRef` caption in QrDeviceLinkPanel.tsx
   * makes the middle assertion fail, since nothing distinguishes this
   * transition from the FIRST generate's bare spinner). Covers exactly the
   * two reported symptoms: the backend's `expired` DOES get picked up
   * (polling works) and the panel does NOT hang — a fresh, live QR renders
   * right after, never stuck showing only a spinner.
   */
  it("on 'expired', silently regenerates and lands on a live NEW code — never stuck on the spinner", async () => {
    let generateCalls = 0;
    server.use(
      http.post(`${BASE}/qr/generate/`, () => {
        generateCalls += 1;
        const key = `k${String(generateCalls)}`;
        return HttpResponse.json(
          { key, type: "session_share", expires_in: 300, scan_url: `https://x/qr/${key}/scan/` },
          { status: 201 }
        );
      }),
      http.get(`${BASE}/qr/k1/status/`, () => HttpResponse.json({ status: "expired" })),
      http.get(`${BASE}/qr/k2/status/`, () => HttpResponse.json({ status: "pending" }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel />));

    screen.getByText("Show QR code").click();
    await waitFor(() => expect(screen.getByText("Expires in 5:00")).toBeDefined());

    // The first poll reports `expired` and the panel regenerates on its own —
    // the new key lands: a live QR again, not a spinner stuck forever.
    await waitFor(() => expect(generateCalls).toBe(2));
    await waitFor(() => expect(screen.getByText("Expires in 5:00")).toBeDefined());
    expect(screen.queryByText("That code expired — getting you a new one…")).toBeNull();
  });

  it("shows the rejected state with a retry that regenerates a new key", async () => {
    let generateCalls = 0;
    server.use(
      http.post(`${BASE}/qr/generate/`, () => {
        generateCalls += 1;
        const key = `k${String(generateCalls)}`;
        return HttpResponse.json(
          { key, type: "session_share", expires_in: 300, scan_url: `https://x/qr/${key}/scan/` },
          { status: 201 }
        );
      }),
      http.get(`${BASE}/qr/k1/status/`, () => HttpResponse.json({ status: "rejected" })),
      http.get(`${BASE}/qr/k2/status/`, () => HttpResponse.json({ status: "pending" }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel />));

    screen.getByText("Show QR code").click();
    await waitFor(() => expect(screen.getByText("Sign-in was declined on the other device.")).toBeDefined());

    screen.getByText("Try again").click();
    await waitFor(() => expect(generateCalls).toBe(2));
    await waitFor(() => expect(screen.getByText("Expires in 5:00")).toBeDefined());
  });

  it("shows an error state on a network failure, with a working retry", async () => {
    let generateCalls = 0;
    server.use(
      http.post(`${BASE}/qr/generate/`, () => {
        generateCalls += 1;
        if (generateCalls === 1) return HttpResponse.json({ code: "error.500.internal" }, { status: 500 });
        return HttpResponse.json(
          { key: "k2", type: "session_share", expires_in: 300, scan_url: "https://x/qr/k2/scan/" },
          { status: 201 }
        );
      }),
      http.get(`${BASE}/qr/k2/status/`, () => HttpResponse.json({ status: "pending" }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel />));

    screen.getByText("Show QR code").click();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());

    screen.getByText("Try again").click();
    await waitFor(() => expect(screen.getByText("Expires in 5:00")).toBeDefined());
  });

  it("Cancel calls POST /qr/:key/reject/ and returns to idle", async () => {
    let rejectedKey: string | null = null;
    server.use(
      http.post(`${BASE}/qr/generate/`, () =>
        HttpResponse.json(
          { key: "k1", type: "session_share", expires_in: 300, scan_url: "https://x/qr/k1/scan/" },
          { status: 201 }
        )
      ),
      http.get(`${BASE}/qr/k1/status/`, () => HttpResponse.json({ status: "pending" })),
      http.post(`${BASE}/qr/k1/reject/`, () => {
        rejectedKey = "k1";
        return HttpResponse.json({ status: "ok" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrDeviceLinkPanel />));

    screen.getByText("Show QR code").click();
    await waitFor(() => expect(screen.getByText("Expires in 5:00")).toBeDefined());

    screen.getByText("Cancel").click();

    await waitFor(() => expect(rejectedKey).toBe("k1"));
    await waitFor(() => expect(screen.getByText("Show QR code")).toBeDefined());
  });

  it("custom title/subtitle props override the i18n defaults (generic-placement contract)", () => {
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <QrDeviceLinkPanel title="Continue this call on your phone" subtitle="Scan to join from your phone." />
      )
    );
    expect(screen.getByText("Continue this call on your phone")).toBeDefined();
    expect(screen.getByText("Scan to join from your phone.")).toBeDefined();
  });
});
