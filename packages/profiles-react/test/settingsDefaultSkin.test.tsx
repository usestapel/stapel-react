/**
 * Coverage for the settings surfaces added to this pair per the owner
 * directive (pull not just the auth components but the settings components
 * into the lib too): the headless avatar-upload stopgap, the headless
 * notification-preferences matrix, and the three default-skin components
 * built on top of this pair's existing hooks.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { delay, http, HttpResponse } from "msw";
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
import { useAvatarUpload, useSetAvatar } from "../src/headless/AvatarUpload.js";
import type { AvatarRef } from "../src/headless/AvatarUpload.js";
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
  // Back to jsdom's own viewport, so a test that set a phone width does not
  // hand the next one a bottom sheet it never asked for.
  setViewport(1024);
});
afterAll(() => server.close());

/** jsdom's window is 1024x768 and never resizes itself. Which surface a
 * dialog takes is a real `matchMedia` query evaluated against
 * `window.innerWidth` (see `vitest.setup.ts`), so a test that cares says
 * which viewport it is standing in. */
function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

/** The surface `SkinDialog` actually rendered, as it stamps it on the body
 * wrapper — `"sheet"` (phone) or `"modal"` (tablet/desktop). */
function dialogSurface(): string | null {
  const wrapper = document.querySelector("[data-stapel-dialog-surface]");
  return wrapper === null ? null : wrapper.getAttribute("data-stapel-dialog-surface");
}

// stapel-profiles 0.7.0 (§66 reversal, owner 2026-07-22): display_name and
// theme are HARD-CORE model columns again — always on the GET /me body, never
// field-manifest entries. currency_code/measurement_units stay registry
// opt-ins a project selects via STAPEL_PROFILES["FIELDS"], reflected here as
// PLAIN EXTRA KEYS on the GET /me body (the "open envelope" this pair's
// MyProfile/ProfileUpdate types allow — api/types.ts).
const MY_PROFILE = {
  user_id: "b3f1c0de-0000-4000-8000-000000000001",
  avatar_source: "file",
  avatar: "avatar/ada",
  display_name: "Ada Lovelace",
  theme: "system",
  location_id: 0,
  location_display_name_narrow: "London",
  location_display_name_broad: "United Kingdom",
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

/**
 * `MY_PROFILE` plus a manifest-driven project's extra fields (a swapped
 * Profile model's own columns — this pair's generated schema never declares
 * these; the whole point of the open envelope). Values/examples mirror
 * `stapel-profiles`' own `tests/test_field_manifest.py` +
 * `field_defs.py`'s `STANDARD_FIELDS`.
 */
const MY_PROFILE_EXT = {
  ...MY_PROFILE,
  currency_code: "GBP",
  default_camera_on: true,
  geohash: "gbsuv7z",
};

/**
 * A field-manifest fixture combining an identity preset field, a
 * STANDARD_FIELDS enum + model_ref, and a custom bool + a standard geohash
 * — one example of every `kind` the backend's `GET /field-manifest`
 * documents (`docs/pending/profile-fields.md`, "Owner Addendum" §1).
 */
const FIELD_MANIFEST = [
  {
    name: "currency_code",
    kind: "model_ref",
    docstring:
      "Preferred display currency — references the live stapel-currencies catalog (rates/list are DB-backed, not a fixed enum; see stapel_currencies.models.Currency).",
    required: false,
    order: 0,
    enum_values: null,
  },
  {
    name: "default_camera_on",
    kind: "bool",
    docstring: "Turn the camera on by default when joining a call.",
    required: false,
    order: 1,
    enum_values: null,
  },
  {
    name: "geohash",
    kind: "geohash",
    docstring:
      "Raw geohash of the user's last known point (stapel_geo.geohash.encode), for point-level proximity search — independent of location_id's city-level display cache.",
    required: false,
    order: 2,
    enum_values: null,
  },
];

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
  // The CDN client is based at the CDN ROOT, because the paths are now
  // @stapel/cdn-react's own (`/upload/avatar/`) rather than a whole path this
  // pair used to spell for itself. A host wires the same base its
  // `createCdnRuntime({ baseUrl: "/cdn/api/v1/" })` uses.
  const cdnClient = createStapelClient({ baseUrl: `${CDN_BASE}/cdn/api/v1` });
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

describe("useAvatarUpload (over @stapel/cdn-react's generated client)", () => {
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
    let ref: AvatarRef | null = null;
    await act(async () => {
      ref = await result.current.upload(file);
    });
    // The ref travels WITH its provenance: the upload endpoint is the one
    // place that knows for certain this is a CDN ref, and resolving a bare
    // string there is what let two live profiles store it tagged `file`.
    expect(ref).toEqual({ ref: "avatar/newhash", source: "cdn" });
    expect(receivedContentType).toContain("multipart/form-data");
    await waitFor(() => expect(result.current.uploadedUrl).toBe("https://cdn.stapel.test/avatar/newhash-160.webp"));
  });

  it("useSetAvatar writes the ref AND the source in one PATCH", async () => {
    // The mechanism, under test: there is no intermediate state in which a
    // caller holds a ref and could forget its tag. `{avatar}` alone next to
    // the model default `file` is precisely what 500'd the live stand.
    let patched: Record<string, unknown> | null = null;
    server.use(
      http.post(`${CDN_BASE}/cdn/api/v1/upload/avatar/`, () =>
        HttpResponse.json({
          image: {
            prefix: "avatar/paired",
            variant_160_url: "https://cdn.stapel.test/avatar/paired-160.webp",
          },
        })
      ),
      http.patch(`${BASE}/me`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ user_id: "u1", ...patched });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useSetAvatar(), {
      wrapper: ({ children }) => wrap(runtime, children, { withCdn: true }),
    });

    const file = new File(["x"], "avatar.png", { type: "image/png" });
    await act(async () => {
      await result.current.setAvatar(file);
    });

    expect(patched).toEqual({ avatar: "avatar/paired", avatar_source: "cdn" });
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

describe("<ProfileSettings/> (default skin) — data-driven (§66, docs/pending/profile-fields.md)", () => {
  function serveManifestAndProfile(
    patchHandler?: (patch: Record<string, unknown>) => void
  ): void {
    server.use(
      http.get(`${BASE}/field-manifest`, () => HttpResponse.json(FIELD_MANIFEST)),
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE_EXT)),
      http.patch(`${BASE}/me`, async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        patchHandler?.(patch);
        return HttpResponse.json({ ...MY_PROFILE_EXT, ...patch });
      })
    );
  }

  it("renders the hard-core rows (display_name, theme) plus one row per manifest entry", async () => {
    serveManifestAndProfile();
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));

    // Hard-core display_name — rendered by the skin itself (no manifest
    // entry), pair-owned i18n label, editable-text canon.
    await waitFor(() =>
      expect(screen.getByTestId("profile-field-display_name-value").textContent).toBe("Ada Lovelace")
    );
    expect(screen.getByText("Display name")).toBeDefined();
    // Hard-core theme — Segmented with i18n'd labels (no backend docstring).
    expect(screen.getByText("Theme")).toBeDefined();
    expect(screen.getByText("Light")).toBeDefined();
    expect(screen.getByText("Dark")).toBeDefined();
    expect(screen.getByText("System")).toBeDefined();
    // model_ref -> Select, current value shown.
    expect(screen.getByText("GBP")).toBeDefined();
    // bool -> Switch.
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    // geohash is hidden by default (not rendered as a row at all).
    expect(screen.queryByText(/Raw geohash/)).toBeNull();
  });

  it("an empty manifest still renders the hard-core rows; show* props turn them off", async () => {
    server.use(
      http.get(`${BASE}/field-manifest`, () => HttpResponse.json([])),
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE))
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });

    // Default: core rows are there even with nothing manifest-selected.
    const { unmount } = render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));
    await waitFor(() =>
      expect(screen.getByTestId("profile-field-display_name-value")).toBeDefined()
    );
    expect(screen.getByText("Theme")).toBeDefined();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    unmount();

    // Owner canon: even the default skin must let a host customize or
    // disable them — both off leaves only the avatar block.
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} showDisplayName={false} showTheme={false} />));
    await waitFor(() => expect(screen.getByTestId("profile-settings")).toBeDefined());
    expect(screen.queryByText("Theme")).toBeNull();
    expect(document.querySelectorAll('[data-testid^="profile-field-"]')).toHaveLength(0);
  });

  it("displayNameRow/themeRow slots replace the default core rows (customization canon)", async () => {
    serveManifestAndProfile();
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <ProfileSettings showLanguage={false} showNotifications={false}
          displayNameRow={<div data-testid="custom-name-row">custom name UI</div>}
          themeRow={<div data-testid="custom-theme-row">custom theme UI</div>}
        />
      )
    );

    await waitFor(() => expect(screen.getByTestId("custom-name-row")).toBeDefined());
    expect(screen.getByTestId("custom-theme-row")).toBeDefined();
    // Defaults are fully replaced, not duplicated.
    expect(screen.queryByTestId("profile-field-display_name-value")).toBeNull();
    expect(screen.queryByText("Theme")).toBeNull();
  });

  it("dedupes against a pre-0.7.0 backend whose manifest still lists display_name/theme", async () => {
    // Old backend (profiles <0.7.0): registry still emits display_name/theme
    // as manifest entries — the skin must not render each field twice.
    const OLD_MANIFEST = [
      {
        name: "display_name", kind: "text", docstring: "User's display name.",
        required: false, order: 0, enum_values: null,
      },
      {
        name: "theme", kind: "enum", docstring: "UI theme preference.",
        required: false, order: 1, enum_values: ["light", "dark", "system"],
      },
      ...FIELD_MANIFEST.map((e, i) => ({ ...e, order: i + 2 })),
    ];
    server.use(
      http.get(`${BASE}/field-manifest`, () => HttpResponse.json(OLD_MANIFEST)),
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE_EXT))
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));

    await waitFor(() =>
      expect(screen.getAllByTestId("profile-field-display_name-value")).toHaveLength(1)
    );
    // One theme row (the core one, i18n'd labels) — the manifest twin with
    // its raw lowercase labels/docstring is filtered out.
    expect(screen.getAllByText("Light")).toHaveLength(1);
    expect(screen.queryByText("UI theme preference.")).toBeNull();
    expect(screen.queryByText("light")).toBeNull();
  });

  it("shows a text field read-only; its edit control opens a dialog that saves on its own", async () => {
    let lastPatch: Record<string, unknown> | null = null;
    serveManifestAndProfile((p) => {
      lastPatch = p;
    });
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));

    await waitFor(() =>
      expect(screen.getByTestId("profile-field-display_name-value").textContent).toBe("Ada Lovelace")
    );
    // No inline input for the name pre-edit: the row is read-only until its
    // edit control is activated. That control names what it DOES ("Edit
    // Display name") rather than repeating the label the row already shows —
    // it used to be a 14px pencil whose accessible name was the bare field.
    expect(screen.queryByDisplayValue("Ada Lovelace")).toBeNull();

    screen.getByRole("button", { name: "Edit Display name" }).click();
    const dialogInput = await screen.findByDisplayValue("Ada Lovelace");
    fireEvent.change(dialogInput, { target: { value: "Ada C. Lovelace" } });
    screen.getByText("Save changes").click();

    await waitFor(() => expect(lastPatch).toMatchObject({ display_name: "Ada C. Lovelace" }));
    await waitFor(() =>
      expect(screen.getByTestId("profile-field-display_name-value").textContent).toBe("Ada C. Lovelace")
    );
  });

  it("the edit dialog is a bottom sheet on a phone viewport and a modal at 1024", async () => {
    // The owner's fleet rule (@stapel/tokens-antd/skin), inherited rather than
    // restated here: the shared skin stamps the surface it chose on the body
    // wrapper, so this pair proves it obeys the rule instead of asserting it
    // in prose. This file used to hand-roll `isPhone ? <Drawer> : <Modal>`.
    serveManifestAndProfile();
    const runtime = createProfilesRuntime({ baseUrl: BASE });

    setViewport(390);
    const { unmount } = render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));
    await waitFor(() =>
      expect(screen.getByTestId("profile-field-display_name-value")).toBeDefined()
    );
    expect(dialogSurface()).toBeNull(); // nothing rendered while it is closed
    screen.getByRole("button", { name: "Edit Display name" }).click();
    await screen.findByDisplayValue("Ada Lovelace");
    expect(dialogSurface()).toBe("sheet");
    unmount();

    setViewport(1024);
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));
    await waitFor(() =>
      expect(screen.getByTestId("profile-field-display_name-value")).toBeDefined()
    );
    screen.getByRole("button", { name: "Edit Display name" }).click();
    await screen.findByDisplayValue("Ada Lovelace");
    expect(dialogSurface()).toBe("modal");
  });

  it("an unchanged draft cannot fire a save — and the real save-then-close path still works", async () => {
    // A PATCH that writes the value the server already holds is a write with
    // nothing behind it. Worse, the dialog's dismissal used to hang off that
    // very equality (`draft.trim() === value`), which is true the instant the
    // dialog opens — so an unchanged "save" both wrote and closed as if
    // something had happened.
    const patches: Record<string, unknown>[] = [];
    serveManifestAndProfile((p) => patches.push(p));
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));

    await waitFor(() =>
      expect(screen.getByTestId("profile-field-display_name-value").textContent).toBe("Ada Lovelace")
    );
    screen.getByRole("button", { name: "Edit Display name" }).click();
    const dialogInput = await screen.findByDisplayValue("Ada Lovelace");

    // Untouched draft: Save is off, and Enter — the keyboard path to the same
    // commit — writes nothing either.
    // The gate's stamp, not html `disabled`: Save is `aria-disabled` and alive
    // so it can say "nothing has changed", and a wait keyed on `disabled`
    // would pass instantly in BOTH states.
    expect(
      screen.getByTestId("profile-field-save-gate").getAttribute("data-stapel-gated")
    ).toBe("blocked");
    fireEvent.keyDown(dialogInput, { key: "Enter", code: "Enter", keyCode: 13 });

    // Typing and reverting comes back to the same "nothing to write" state.
    fireEvent.change(dialogInput, { target: { value: "Ada C. Lovelace" } });
    await waitFor(() =>
      expect(
        screen.getByTestId("profile-field-save-gate").getAttribute("data-stapel-gated")
      ).toBe("available")
    );
    fireEvent.change(dialogInput, { target: { value: "Ada Lovelace" } });
    await waitFor(() =>
      expect(
        screen.getByTestId("profile-field-save-gate").getAttribute("data-stapel-gated")
      ).toBe("blocked")
    );

    // A real edit still saves, and the dialog still closes on the way out.
    fireEvent.change(dialogInput, { target: { value: "Ada C. Lovelace" } });
    screen.getByText("Save changes").click();
    await waitFor(() =>
      expect(screen.getByTestId("profile-field-display_name-value").textContent).toBe("Ada C. Lovelace")
    );
    await waitFor(() => expect(screen.queryByDisplayValue("Ada C. Lovelace")).toBeNull());
    // Exactly one write left, and it is the one that changed something.
    expect(patches).toEqual([{ display_name: "Ada C. Lovelace" }]);
  });

  it("the core theme row is a Segmented that PATCHes immediately — no Save button anywhere", async () => {
    let lastPatch: Record<string, unknown> | null = null;
    serveManifestAndProfile((p) => {
      lastPatch = p;
    });
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));
    await waitFor(() => expect(screen.getByText("Dark")).toBeDefined());

    expect(screen.queryByText("Save changes")).toBeNull();
    fireEvent.click(screen.getByText("Dark"));

    await waitFor(() => expect(lastPatch).toMatchObject({ theme: "dark" }));
  });

  it("a model_ref field (currency) renders as a Select that PATCHes immediately", async () => {
    let lastPatch: Record<string, unknown> | null = null;
    serveManifestAndProfile((p) => {
      lastPatch = p;
    });
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));
    await waitFor(() => expect(screen.getByText("GBP")).toBeDefined());

    fireEvent.mouseDown(screen.getByText("GBP")); // MY_PROFILE_EXT's current currency, opens the Select
    await screen.findByTitle("USD");
    screen.getByTitle("USD").click();

    await waitFor(() => expect(lastPatch).toMatchObject({ currency_code: "USD" }));
  });

  it("a bool field renders as a Switch and toggles reactively", async () => {
    let lastPatch: Record<string, unknown> | null = null;
    serveManifestAndProfile((p) => {
      lastPatch = p;
    });
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));
    const toggle = await screen.findByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true"); // MY_PROFILE_EXT.default_camera_on

    fireEvent.click(toggle);
    await waitFor(() => expect(lastPatch).toMatchObject({ default_camera_on: false }));
  });

  it("a field-manifest read that FAILED shows the failure — it does not pass as a project that selected no fields", async () => {
    server.use(
      http.get(`${BASE}/field-manifest`, () =>
        HttpResponse.json({ localizable_error: "", error: "boom", params: {} }, { status: 500 })
      ),
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE))
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));

    await waitFor(() => expect(screen.getByTestId("profile-fields-failed")).toBeDefined());
    expect(screen.getByText("Try again")).toBeDefined();
    // The hard-core rows are the skin's own and keep rendering.
    expect(screen.getByTestId("profile-field-display_name-value")).toBeDefined();
    // ...but no manifest row is invented, and nothing claims there are none.
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("a geohash field is hidden by default; showGeohash opts it back in as an editable text row", async () => {
    serveManifestAndProfile();
    const runtime = createProfilesRuntime({ baseUrl: BASE });

    const { unmount } = render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} />));
    await waitFor(() => expect(screen.getByText("GBP")).toBeDefined());
    expect(screen.queryByTestId("profile-field-geohash-value")).toBeNull();
    unmount();

    render(wrap(runtime, <ProfileSettings showLanguage={false} showNotifications={false} showGeohash />));
    await waitFor(() =>
      expect(screen.getByTestId("profile-field-geohash-value").textContent).toBe("gbsuv7z")
    );
  });
});

describe("<LanguageSettings/> (default skin) — Auto-first reactive picker", () => {
  it("renders 'Auto' as the first option, plus the supported languages, and PATCHes immediately", async () => {
    let lastPatch: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
      http.get(`${BASE}/languages/`, () =>
        HttpResponse.json([
          { code: "en", name: "English", flag: null },
          { code: "ru", name: "Russian", flag: null },
        ])
      ),
      http.patch(`${BASE}/me`, async ({ request }) => {
        lastPatch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...MY_PROFILE, ...lastPatch });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <LanguageSettings />));

    await waitFor(() => expect(screen.getByText("Language")).toBeDefined());
    expect(screen.queryByText("Save changes")).toBeNull();

    fireEvent.mouseDown(screen.getByText("English (EN)")); // MY_PROFILE's current app_language, opens the Select
    // rc-select also renders a hidden width-measurement list (raw values,
    // no labels) that shares `role="option"` — assert on the VISIBLE
    // dropdown option text instead of `findAllByRole`, which picks up both.
    // ("English (EN)" is skipped here: it's ALSO the currently-selected
    // display value shown in the closed control, so it legitimately matches
    // twice once the dropdown is open — not itself in question here.)
    await screen.findByText("Auto");
    expect(screen.getByText("Russian (RU)")).toBeDefined();

    fireEvent.click(screen.getByText("Russian (RU)"));
    await waitFor(() =>
      expect(lastPatch).toMatchObject({ app_language: "ru", use_device_language: false })
    );
  });

  /**
   * The three answers a language catalogue read can give, kept three on the
   * screen (the 2026-08-09 incident class): a failed catalogue used to
   * degrade the picker to a single raw language code and delete the
   * "languages you understand" block outright — a working-looking control
   * built out of nothing.
   */
  describe("the catalogue's three answers stay three", () => {
    it("still loading: a spinner — no picker, no empty copy", async () => {
      server.use(
        http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
        http.get(`${BASE}/languages/`, async () => {
          await delay("infinite");
          return HttpResponse.json([]);
        })
      );
      const runtime = createProfilesRuntime({ baseUrl: BASE });
      render(wrap(runtime, <LanguageSettings />));

      await waitFor(() => expect(screen.getByTestId("language-settings")).toBeDefined());
      expect(screen.getByTestId("language-catalogue-loading")).toBeDefined();
      expect(screen.queryByTestId("language-catalogue-empty")).toBeNull();
      expect(screen.queryByText("Languages you understand")).toBeNull();
    });

    it("loaded and genuinely empty: the empty copy, and only there", async () => {
      server.use(
        http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
        http.get(`${BASE}/languages/`, () => HttpResponse.json([]))
      );
      const runtime = createProfilesRuntime({ baseUrl: BASE });
      render(wrap(runtime, <LanguageSettings />));

      await waitFor(() =>
        expect(screen.getByText("No languages are available to choose from.")).toBeDefined()
      );
      expect(screen.queryByTestId("language-catalogue-failed")).toBeNull();
      expect(screen.queryByText("Languages you understand")).toBeNull();
    });

    it("failed: the error + a retry — NOT the empty copy, and no fake picker", async () => {
      let calls = 0;
      server.use(
        http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
        http.get(`${BASE}/languages/`, () => {
          calls += 1;
          return HttpResponse.json(
            { localizable_error: "error.404.profile_not_found", error: "Not found", params: {} },
            { status: 404 }
          );
        })
      );
      const runtime = createProfilesRuntime({ baseUrl: BASE });
      render(wrap(runtime, <LanguageSettings />));

      await waitFor(() => expect(screen.getByTestId("language-catalogue-failed")).toBeDefined());
      // The whole point: a failed read must never speak the empty sentence.
      expect(screen.queryByText("No languages are available to choose from.")).toBeNull();
      // And it must not hand out a picker made of the one code it happens to
      // hold — the working-looking control built out of nothing.
      expect(screen.queryByText("Auto")).toBeNull();
      expect(screen.queryByText("EN")).toBeNull();
      expect(screen.queryByText("Languages you understand")).toBeNull();

      expect(calls).toBe(1);
      fireEvent.click(screen.getByText("Try again"));
      await waitFor(() => expect(calls).toBe(2));
    });
  });

  it("picking 'Auto' PATCHes use_device_language: true", async () => {
    let lastPatch: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
      http.get(`${BASE}/languages/`, () =>
        HttpResponse.json([{ code: "en", name: "English", flag: null }])
      ),
      http.patch(`${BASE}/me`, async ({ request }) => {
        lastPatch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...MY_PROFILE, ...lastPatch });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <LanguageSettings />));
    await waitFor(() => expect(screen.getByText("Language")).toBeDefined());

    fireEvent.mouseDown(screen.getByText("English (EN)"));
    fireEvent.click(await screen.findByText("Auto"));

    await waitFor(() => expect(lastPatch).toMatchObject({ use_device_language: true }));
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

  it("a preference read that FAILED renders no toggleable switch — just the failure and a retry", async () => {
    // The 2026-08-09 incident class (@stapel/core loadState.ts): the matrix
    // used to render out of `isEnabled`, which answers `false` for every cell
    // when there is no profile. So a failed read drew four live switches, each
    // showing a default rather than the user's real setting — and flipping one
    // PATCHed a preference derived from a state nobody could read.
    let calls = 0;
    server.use(
      http.get(`${BASE}/me`, () => {
        calls += 1;
        return HttpResponse.json(
          { localizable_error: "", error: "boom", params: {} },
          { status: 500 }
        );
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <NotificationPreferences />));

    await waitFor(() =>
      expect(screen.getByTestId("notification-prefs-failed")).toBeDefined()
    );
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    // The card's own heading stays — the screen is not blanked, only the
    // control that would have been made of nothing.
    expect(screen.getByText("Notifications")).toBeDefined();

    expect(calls).toBe(1);
    fireEvent.click(screen.getByText("Try again"));
    await waitFor(() => expect(calls).toBe(2));
  });
});
