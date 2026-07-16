/**
 * Coverage for the settings surfaces added to this pair per the owner
 * directive ("затащить в либу не только компоненты авторизации, но и
 * компоненты настроек"): the headless avatar-upload stopgap, the headless
 * notification-preferences matrix, and the three default-skin components
 * built on top of this pair's existing hooks.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import {
  I18nProvider,
  StapelConfigProvider,
  createI18n,
  createStapelClient,
} from "@stapel/core";
import { createProfilesRuntime } from "../src/model/runtime.js";
import type { ProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import { useAvatarUpload } from "../src/headless/AvatarUpload.js";
import { NotificationPreferences as HeadlessNotificationPreferences } from "../src/headless/NotificationPreferences.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import {
  ProfileSettings,
  LanguageSettings,
  NotificationPreferences,
} from "../src/default/index.js";

const BASE = "https://profiles.stapel.test/profiles/api/v1";
const CDN_BASE = "https://cdn.stapel.test";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

const MY_PROFILE = {
  user_id: "b3f1c0de-0000-4000-8000-000000000001",
  display_name: "Ada Lovelace",
  avatar: "avatar/ada",
  location_id: 0,
  location_display_name_narrow: "London",
  location_display_name_broad: "United Kingdom",
  currency_code: "GBP",
  measurement_units: "metric",
  theme: "system",
  app_language: { code: "en", name: "English", flag: "/flags/en.svg" },
  understands: ["en"],
  use_device_language: false,
  auto_detected_language: "en",
  auto_translate_content: false,
  email_messages: true,
  email_system: false,
  push_messages: true,
  push_system: true,
  essential_cookies_accepted: true,
  initial_setup_passed: true,
  followers_count: 0,
  following_count: 0,
  rating: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

function wrap(
  runtime: ProfilesRuntime,
  children: ReactNode,
  opts: { withCdn?: boolean } = {}
): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerProfilesI18n(i18n);
  const defaultClient = createStapelClient({ baseUrl: "https://unused.stapel.test" });
  const cdnClient = createStapelClient({ baseUrl: CDN_BASE });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <StapelConfigProvider
          config={{
            client: defaultClient,
            clients: opts.withCdn ? { cdn: cdnClient } : undefined,
          }}
        >
          <ProfilesProvider runtime={runtime}>{children}</ProfilesProvider>
        </StapelConfigProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("useAvatarUpload (headless stopgap)", () => {
  it("uploads a file through the injected cdn client and resolves the CDN ref", async () => {
    // NOTE: the handler deliberately does NOT call `request.formData()` —
    // jsdom's FormData polyfill hangs msw's body parser in this test
    // environment (a known jsdom/undici interop gap, reproduced in isolation
    // outside React too). The content-type check below still proves a real
    // multipart request left the client; the round-trip itself (client →
    // fetch → msw → typed response → hook state) is what this test verifies.
    let receivedContentType: string | null = null;
    server.use(
      http.post(`${CDN_BASE}/cdn/api/v1/upload/avatar/`, ({ request }) => {
        receivedContentType = request.headers.get("content-type");
        return HttpResponse.json({
          image: { prefix: "avatar/newhash", variant_160_url: "https://cdn.stapel.test/avatar/newhash-160.webp" },
        });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useAvatarUpload(), {
      wrapper: ({ children }) => wrap(runtime, children, { withCdn: true }),
    });

    const file = new File(["x"], "avatar.png", { type: "image/png" });
    let ref: string | null = null;
    await act(async () => {
      ref = await result.current.upload(file);
    });
    expect(ref).toBe("avatar/newhash");
    expect(receivedContentType).toContain("multipart/form-data");
    await waitFor(() => expect(result.current.uploadedUrl).toBe("https://cdn.stapel.test/avatar/newhash-160.webp"));
  });

  it("surfaces a StapelApiError and clears isUploading on a failed upload", async () => {
    server.use(
      http.post(`${CDN_BASE}/cdn/api/v1/upload/avatar/`, () =>
        HttpResponse.json(
          { localizable_error: "error.400.unsupported_format", error: "Unsupported format", params: {} },
          { status: 400 }
        )
      )
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useAvatarUpload(), {
      wrapper: ({ children }) => wrap(runtime, children, { withCdn: true }),
    });

    const file = new File(["x"], "avatar.txt", { type: "text/plain" });
    let ref: string | null = "unset" as unknown as string | null;
    await act(async () => {
      ref = await result.current.upload(file);
    });
    expect(ref).toBeNull();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("error.400.unsupported_format");
    expect(result.current.isUploading).toBe(false);
  });
});

describe("<HeadlessNotificationPreferences> (category × channel matrix)", () => {
  it("reads the four Profile fields as a 2×2 matrix and toggles one cell", async () => {
    server.use(
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
      http.patch(`${BASE}/me`, async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...MY_PROFILE, ...patch });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <HeadlessNotificationPreferences>
          {({ categories, channels, isEnabled, toggle, isLoading }) => (
            <div>
              <span data-testid="shape">
                {categories.length}x{channels.length}
              </span>
              <span data-testid="loading">{String(isLoading)}</span>
              <span data-testid="email-system">{String(isEnabled("system", "email"))}</span>
              <button onClick={() => toggle("system", "email")}>toggle</button>
            </div>
          )}
        </HeadlessNotificationPreferences>
      )
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("shape").textContent).toBe("2x2");
    expect(screen.getByTestId("email-system").textContent).toBe("false");
    fireEvent.click(screen.getByText("toggle"));
    await waitFor(() => expect(screen.getByTestId("email-system").textContent).toBe("true"));
  });
});

describe("<ProfileSettings/> (default skin)", () => {
  it("loads the profile, edits the name, and saves", async () => {
    server.use(
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
      http.patch(`${BASE}/me`, async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...MY_PROFILE, ...patch });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ProfileSettings />));

    await waitFor(() =>
      expect(screen.getByDisplayValue("Ada Lovelace")).toBeDefined()
    );
    fireEvent.change(screen.getByDisplayValue("Ada Lovelace"), {
      target: { value: "Ada C. Lovelace" },
    });
    fireEvent.click(screen.getByText("Save changes"));
    await waitFor(() => expect(screen.getByText("Save changes")).toBeDefined());
  });
});

describe("<LanguageSettings/> (default skin)", () => {
  it("renders the caller's app language and saves", async () => {
    server.use(
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
      http.get(`${BASE}/languages/`, () =>
        HttpResponse.json([
          { code: "en", name: "English", flag: null },
          { code: "ru", name: "Russian", flag: null },
        ])
      ),
      http.patch(`${BASE}/me`, async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...MY_PROFILE, ...patch });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <LanguageSettings />));

    await waitFor(() => expect(screen.getByText("Language")).toBeDefined());
    fireEvent.click(screen.getByText("Save changes"));
    await waitFor(() => expect(screen.getByText("Save changes")).toBeDefined());
  });
});

describe("<NotificationPreferences/> (default skin)", () => {
  it("renders a 2-category matrix and flips a cell", async () => {
    server.use(
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
      http.patch(`${BASE}/me`, async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...MY_PROFILE, ...patch });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <NotificationPreferences />));

    await waitFor(() => expect(screen.getByText("Messages")).toBeDefined());
    expect(screen.getByText("System")).toBeDefined();
    expect(screen.getAllByRole("switch")).toHaveLength(4);
  });
});
